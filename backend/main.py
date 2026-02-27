"""
AI Learning StoryBook — Main API Server (Single Local Server)
"""

try:
    from dotenv import load_dotenv
    import os as _os
    load_dotenv(_os.path.join(_os.path.dirname(__file__), ".env"))
except Exception:
    pass

from fastapi import FastAPI, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import time
import uuid

from create_episode_engine import generate_complete_episode

from google.cloud import storage

BUCKET_NAME = os.environ.get("VEO_BUCKET", "veo-video-gen-interactive-episodes")


def gcs_object_name_from_uri(uri: str) -> str:
    if uri.startswith("gs://"):
        parts = uri.replace("gs://", "").split("/", 1)
        if len(parts) == 2:
            return parts[1]
    return uri


def get_signed_url(gcs_uri: str, expiration_minutes: int = 60) -> str:
    """Return a signed URL for a GCS object. Falls back to public URL on error."""
    try:
        from datetime import timedelta
        from google.oauth2 import service_account

        if gcs_uri.startswith("https://") or gcs_uri.startswith("http://"):
            return gcs_uri

        object_name = gcs_object_name_from_uri(gcs_uri)
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

        if credentials_path and os.path.exists(credentials_path):
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            storage_client = storage.Client(credentials=credentials)
        else:
            storage_client = storage.Client()

        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(object_name)
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiration_minutes),
            method="GET",
        )
    except Exception as e:
        print(f"[Signed URL] Error: {e}")
        object_name = gcs_object_name_from_uri(gcs_uri)
        return f"https://storage.googleapis.com/{BUCKET_NAME}/{object_name}"


# ---------------------------------------------------------------------------
# In-memory episode store + status tracker
# ---------------------------------------------------------------------------

USER_GENERATED_EPISODES: List[Dict[str, Any]] = []
EPISODE_GENERATION_STATUS: Dict[str, Dict[str, Any]] = {}

# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(title="AI Learning StoryBook API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# GET /episodes/{episode_id}
# ---------------------------------------------------------------------------

@app.get("/episodes/{episode_id}")
async def get_episode(episode_id: str):
    # Check generation status
    if episode_id in EPISODE_GENERATION_STATUS:
        status_info = EPISODE_GENERATION_STATUS[episode_id]

        if status_info["status"] in ("pending", "generating"):
            return {
                "episode_id": episode_id,
                "status": status_info["status"],
                "message": f"Episode is {status_info['status']}. Please wait...",
                "created_at": status_info["created_at"],
                "updated_at": status_info["updated_at"],
            }

        if status_info["status"] == "failed":
            return {
                "episode_id": episode_id,
                "status": "failed",
                "error": status_info.get("error", "Unknown error"),
                "created_at": status_info["created_at"],
                "updated_at": status_info["updated_at"],
            }

    # Find completed episode
    episode = next((ep for ep in USER_GENERATED_EPISODES if ep["episode_id"] == episode_id), None)
    if not episode:
        raise HTTPException(status_code=404, detail=f"Episode '{episode_id}' not found")

    # Build response — scenes already have signed URLs embedded by engine
    scenes_out = []
    for scene in episode["scenes"]:
        scene_out: Dict[str, Any] = {
            "scene_number": scene["scene_number"],
            "interaction": scene["interaction"],
            "dialogue": scene.get("dialogue", ""),
            "prompt": scene.get("prompt", ""),
            "video_url": scene.get("video_url", ""),
        }
        if scene["interaction"]:
            scene_out["question"] = scene.get("question", "")
            scene_out["options"] = scene.get("options", [])
            scene_out["correct_answer_index"] = scene.get("correct_answer_index", 0)
        scenes_out.append(scene_out)

    return {
        "episode_id": episode["episode_id"],
        "title": episode.get("title", ""),
        "description": episode.get("description", ""),
        "skills": episode.get("skills", []),
        "scenes": scenes_out,
        "character_name": episode.get("character_name", ""),
        "status": "complete",
    }


# ---------------------------------------------------------------------------
# Background generation task
# ---------------------------------------------------------------------------

def _generate_episode_background(
    episode_id: str,
    episode_topic: str,
    story_style: str,
    character_image_base64: str,
    character_name: str,
):
    try:
        print(f"[Background] Starting generation for {episode_id}")
        EPISODE_GENERATION_STATUS[episode_id]["status"] = "generating"
        EPISODE_GENERATION_STATUS[episode_id]["updated_at"] = time.time()

        episode_data = generate_complete_episode(
            episode_topic=episode_topic,
            story_style=story_style,
            character_image_base64=character_image_base64,
            character_name=character_name,
        )

        if isinstance(episode_data, list):
            episode_data = episode_data[0] if episode_data else {}

        episode_data["episode_id"] = episode_id
        episode_data["character_name"] = character_name

        USER_GENERATED_EPISODES.append(episode_data)
        EPISODE_GENERATION_STATUS[episode_id]["status"] = "complete"
        EPISODE_GENERATION_STATUS[episode_id]["updated_at"] = time.time()
        print(f"[Background] Episode {episode_id} complete!")

    except Exception as e:
        error_msg = str(e)
        print(f"[Background] Episode {episode_id} failed: {error_msg}")
        user_msg = (
            "That didn't work — please try again.\n"
            "Make sure your topic is kid-appropriate and doesn't include copyrighted characters."
        )
        EPISODE_GENERATION_STATUS[episode_id]["status"] = "failed"
        EPISODE_GENERATION_STATUS[episode_id]["error"] = user_msg
        EPISODE_GENERATION_STATUS[episode_id]["error_details"] = error_msg
        EPISODE_GENERATION_STATUS[episode_id]["updated_at"] = time.time()


# ---------------------------------------------------------------------------
# POST /generate-episode
# ---------------------------------------------------------------------------

class GenerateEpisodeResponse(BaseModel):
    success: bool
    episode: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@app.post("/generate-episode", response_model=GenerateEpisodeResponse)
async def generate_episode_endpoint(
    background_tasks: BackgroundTasks,
    episode_topic: str = Form(...),
    story_style: str = Form(...),
    character_name: str = Form(...),
    character_image_base64: str = Form(...),
):
    try:
        episode_id = f"ep_{int(time.time())}_{uuid.uuid4().hex[:8]}"

        EPISODE_GENERATION_STATUS[episode_id] = {
            "status": "pending",
            "episode_id": episode_id,
            "topic": episode_topic,
            "created_at": time.time(),
            "updated_at": time.time(),
            "error": None,
        }


        background_tasks.add_task(
            _generate_episode_background,
            episode_id,
            episode_topic,
            story_style,
            character_image_base64,
            character_name,
        )

        print(f"[Generate Episode] Started background task for {episode_id}")

        generate_episode_response = GenerateEpisodeResponse(
            success=True,
            episode={
                "episode_id": episode_id,
                "status": "pending",
                "message": "Episode generation started. Poll GET /episodes/{episode_id} for status.",
            },
        )

        print(f"[Generate Episode] Response: {generate_episode_response}")
        return generate_episode_response

    except Exception as e:
        return GenerateEpisodeResponse(success=False, error=str(e))
