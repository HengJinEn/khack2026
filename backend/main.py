from fastapi import FastAPI, HTTPException, WebSocket, File, UploadFile, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import base64
import time
import uuid


import sys
sys.path.append('/app')
from create_episode_engine import generate_complete_episode

from google.cloud import storage

BUCKET_NAME = "veo-video-gen-interactive-episodes"

def gcs_object_name_from_uri(uri: str) -> str:
    if uri.startswith("gs://"):
        parts = uri.replace("gs://", "").split("/", 1)
        if len(parts) == 2:
            return parts[1]
    return uri

def get_signed_url(gcs_uri: str, expiration_minutes: int = 60) -> str:
    try:
        from datetime import timedelta
        from google.oauth2 import service_account
        import os
        
        if gcs_uri.startswith('https://') or gcs_uri.startswith('http://'):
            return gcs_uri
        
        object_name = gcs_object_name_from_uri(gcs_uri)
        
        credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        
        if credentials_path and os.path.exists(credentials_path):
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path,
                scopes=['https://www.googleapis.com/auth/cloud-platform']
            )
            storage_client = storage.Client(credentials=credentials)
        else:
            storage_client = storage.Client()
        
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(object_name)
        
        # Try to generate signed URL
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiration_minutes),
            method="GET"
        )
        return url
    except Exception as e:
        print(f"Error generating signed URL: {e}")
        object_name = gcs_object_name_from_uri(gcs_uri)
        return f"https://storage.googleapis.com/{BUCKET_NAME}/{object_name}"


USER_GENERATED_EPISODES = []
EPISODE_GENERATION_STATUS = {}



app = FastAPI(title="Try Experiences API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/episodes/{episode_id}")
async def get_episode(episode_id: str):

    # Check if episode is being generated
    if episode_id in EPISODE_GENERATION_STATUS:
        status_info = EPISODE_GENERATION_STATUS[episode_id]
        
        # If still generating, return status
        if status_info["status"] in ["pending", "generating"]:
            return {
                "episode_id": episode_id,
                "status": status_info["status"],
                "message": f"Episode is {status_info['status']}. Please wait...",
                "created_at": status_info["created_at"],
                "updated_at": status_info["updated_at"]
            }
        
        # If failed, return error
        if status_info["status"] == "failed":
            return {
                "episode_id": episode_id,
                "status": "failed",
                "error": status_info.get("error", "Unknown error"),
                "created_at": status_info["created_at"],
                "updated_at": status_info["updated_at"]
            }
        
    
    episode = None
    all_episodes = USER_GENERATED_EPISODES
    for ep in all_episodes:
        if ep["episode_id"] == episode_id:
            episode = ep
            break
    
    if not episode:
        raise HTTPException(status_code=404, detail=f"Episode '{episode_id}' not found")
    
    # Build response with signed URLs
    scene_video_urls = []
    scene_feedback_urls = []
    scene_idle_urls = []
    scene_metadata = []
    
    for scene in episode["scenes"]:
        # Get signed URL for main scene video
        scene_video_urls.append(get_signed_url(scene["video_url"]))
        
        # Build metadata for this scene
        metadata = {
            "scene_number": scene["scene_number"],
            "interaction": scene["interaction"],
            "prompt": scene.get("prompt"),
            "dialogue": scene.get("dialogue")
        }
        
        if scene["interaction"]:
            scene_feedback_urls.append({
                "correct_url": get_signed_url(scene["correct_feedback_url"]),
                "incorrect_url": get_signed_url(scene["incorrect_feedback_url"])
            })
            scene_idle_urls.append(get_signed_url(scene["idle_url"]))
            
            metadata["interaction_type"] = scene.get("interaction_type", "quiz")
            metadata["question"] = scene.get("question")
            metadata["options"] = scene.get("options", [])
            metadata["correct_answer_index"] = scene.get("correct_answer_index")
        else:
            # Non-interactive scenes have no feedback/idle
            scene_feedback_urls.append(None)
            scene_idle_urls.append(None)
        
        scene_metadata.append(metadata)
    
    return {
        "episode_id": episode["episode_id"],
        "title": episode["title"],
        "description": episode["description"],
        "skills": episode.get("skills", []),
        "stitched_video_url": scene_video_urls[0],  # For compatibility, use first scene
        "scene_video_urls": scene_video_urls,
        "scene_feedback_urls": scene_feedback_urls,
        "scene_idle_urls": scene_idle_urls,
        "scene_metadata": scene_metadata,
        "character_image": episode.get("character_image"),
        "character_name": episode.get("character_name")
    }



class GenerateEpisodeResponse(BaseModel):
    success: bool
    episode: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    validation_errors: Optional[List[str]] = None


def generate_episode_background(
    episode_id: str,
    episode_topic: str,
    story_style: str,
    character_image_base64: str,
    character_name: str
):
    try:
        print(f"[Background] Starting episode generation for {episode_id}")
        EPISODE_GENERATION_STATUS[episode_id]["status"] = "generating"
        EPISODE_GENERATION_STATUS[episode_id]["updated_at"] = time.time()
        
        # Generate the complete episode (Gemini JSON + Veo videos)
        episode_data = generate_complete_episode(
            episode_topic=episode_topic,
            story_style=story_style,
            character_image_base64=character_image_base64,
            character_name=character_name
        )
        
        # Handle case where Gemini returns a list instead of dict
        if isinstance(episode_data, list):
            if len(episode_data) > 0:
                episode_data = episode_data[0]
            else:
                raise ValueError("Episode data is an empty list")
        
        # Add metadata
        episode_data["episode_id"] = episode_id
        episode_data["character_image"] = f"data:image/png;base64,{character_image_base64}"
        episode_data["character_name"] = character_name
        
        # Store completed episode
        USER_GENERATED_EPISODES.append(episode_data)
        EPISODE_GENERATION_STATUS[episode_id]["status"] = "complete"
        EPISODE_GENERATION_STATUS[episode_id]["data"] = episode_data
        EPISODE_GENERATION_STATUS[episode_id]["updated_at"] = time.time()
        
        print(f"[Background] Episode {episode_id} generation complete")
        
    except Exception as e:
        error_msg = str(e)
        print(f"[Background] Episode {episode_id} generation failed: {error_msg}")
        
        # User-friendly error message for frontend
        user_error_msg = "That didn't work — please try again.\nMake sure your character is original and doesn't resemble any copyrighted characters. Use kid-appropriate themes only."
        
        EPISODE_GENERATION_STATUS[episode_id]["status"] = "failed"
        EPISODE_GENERATION_STATUS[episode_id]["error"] = user_error_msg
        EPISODE_GENERATION_STATUS[episode_id]["error_details"] = error_msg  # Keep technical details for debugging
        EPISODE_GENERATION_STATUS[episode_id]["updated_at"] = time.time()


@app.post("/generate-episode", response_model=GenerateEpisodeResponse)
async def generate_episode_endpoint(
    background_tasks: BackgroundTasks,
    episode_topic: str = Form(...),
    story_style: str = Form(...),
    character_name: str = Form(...),
    character_image_base64: str = Form(...)
):

    try:
        episode_id = f"ep_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        
        EPISODE_GENERATION_STATUS[episode_id] = {
            "status": "pending",
            "episode_id": episode_id,
            "topic": episode_topic,
            "created_at": time.time(),
            "updated_at": time.time(),
            "data": None,
            "error": None
        }
        
        background_tasks.add_task(
            generate_episode_background,
            episode_id,
            episode_topic,
            story_style,
            character_image_base64,
            character_name
        )
        
        print(f"[Generate Episode] Started background generation for {episode_id}")
        
        return GenerateEpisodeResponse(
            success=True,
            episode={
                "episode_id": episode_id,
                "status": "pending",
                "message": "Episode generation started. Poll GET /episodes/{episode_id} for status."
            }
        )
    
    except Exception as e:
        error_msg = f"Failed to start episode generation: {str(e)}"
        print(f"[Generate Episode] Error: {error_msg}")
        return GenerateEpisodeResponse(
            success=False,
            error=error_msg
        )
