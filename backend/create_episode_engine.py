"""
Create Your Own Episode Engine
Uses Gemini 3 Pro with thinking levels to orchestrate episode generation.
"""

import json
import os
import time
import base64
import tempfile
import subprocess
import uuid
import logging
from typing import Dict, List, Any, Optional

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except Exception:
    pass

from google import genai
from google.genai import types
from google.genai.types import VideoGenerationReferenceImage
from google.cloud import storage

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

GEMINI_MODEL = "gemini-3-pro-preview"

MAX_VALIDATION_RETRIES = 3

REQUIRED_SCENE_COUNT = 8
INTERACTIVE_SCENE_INDICES = {2, 4, 6}
NON_INTERACTIVE_SCENE_INDICES = {1, 3, 5, 7, 8}

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "khack2026")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
BUCKET_NAME = os.environ.get("VEO_BUCKET", "veo-video-gen-interactive-episodes")
VIDEO_MODEL = os.environ.get("VEO_MODEL", "veo-3.0-generate-preview")

# Global style + voice policies (applied to every Veo prompt)
DEFAULT_NEGATIVE_PROMPT = (
    "logos, watermarks, text overlays, harsh tone, deep voice, scary mood, "
    "realistic humans, violence, dark lighting, horror, adult themes"
)
GLOBAL_VOICE_PROMPT = (
    "Use a cartoon-style friendly, warm, and expressive voice. "
    "Use SAME VOICE across all scenes. "
    "Tone should be light, energetic, and natural with clear articulation. "
    "Avoid deep, harsh, monotone, robotic, or overly dramatic delivery."
)
GLOBAL_STYLE_PROMPT = (
    "High-quality 3D animated cartoon style with vibrant color palette and bright lighting. "
    "Expressive character acting and clear facial expressions. "
    "Smooth, lively motion and clean composition with gentle depth of field.\n\n"
    "CRITICAL CHARACTER CONSISTENCY REQUIREMENTS:\n"
    "- The main character MUST match the provided reference image EXACTLY across ALL scenes\n"
    "- NO redesign, reinterpretation, or variation of the character\n"
    "- Keep IDENTICAL: face shape, eyes, mouth, fur/skin tone, markings, outfit, accessories, proportions, and style\n"
    "- Character appearance must be perfectly consistent from scene to scene\n"
    "\n"
    "Add light, upbeat instrumental background music at a low volume under the dialogue."
)


# ---------------------------------------------------------------------------
# GCS / Video Utilities
# ---------------------------------------------------------------------------

def _gcs_client() -> storage.Client:
    return storage.Client(project=PROJECT_ID)


def _get_signed_url(bucket_name: str, blob_name: str, expires_seconds: int = 3600) -> str:
    from google.oauth2 import service_account
    from datetime import timedelta
    credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if credentials_path and os.path.exists(credentials_path):
        credentials = service_account.Credentials.from_service_account_file(credentials_path)
        client = storage.Client(project=PROJECT_ID, credentials=credentials)
    else:
        client = _gcs_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    return blob.generate_signed_url(
        version="v4",
        expiration=timedelta(seconds=expires_seconds),
        method="GET",
    )


def _gcs_object_name_from_uri(gcs_uri: str) -> str:
    gs_prefix = f"gs://{BUCKET_NAME}/"
    if gcs_uri.startswith(gs_prefix):
        return gcs_uri[len(gs_prefix):]
    https_prefix = f"https://storage.googleapis.com/{BUCKET_NAME}/"
    if gcs_uri.startswith(https_prefix):
        return gcs_uri[len(https_prefix):].split("?")[0]
    # Generic gs:// handling
    if gcs_uri.startswith("gs://"):
        parts = gcs_uri.replace("gs://", "").split("/", 1)
        if len(parts) == 2:
            return parts[1]
    raise ValueError(f"Unexpected GCS URI: {gcs_uri[:100]}")


def _build_veo_prompt(scene_prompt: str, dialogue: Optional[str]) -> str:
    parts = [scene_prompt, f"Global style rules: {GLOBAL_STYLE_PROMPT}"]
    if dialogue:
        parts.append(f'Spoken dialogue: "{dialogue}"')
    parts.append(f"Voice style rules: {GLOBAL_VOICE_PROMPT}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Veo Video Generation (in-process, no HTTP call)
# ---------------------------------------------------------------------------

def _generate_single_video(
    client: genai.Client,
    prompt: str,
    image_part,
    config_params: dict,
    label: str = "video",
) -> str:
    """Generate one video via Veo SDK and return its GCS URI."""
    print(f"[Veo] Generating {label}...")
    operation = client.models.generate_videos(
        model=VIDEO_MODEL,
        prompt=prompt,
        image=image_part,
        config=types.GenerateVideosConfig(**config_params),
    )
    poll_count = 0
    while not operation.done:
        time.sleep(8)
        poll_count += 1
        if poll_count % 10 == 0:
            print(f"[Veo] Still waiting for {label}... ({poll_count * 8}s elapsed)")
        operation = client.operations.get(operation)

    if not operation.result or not operation.result.generated_videos:
        raise RuntimeError(f"Veo failed to generate {label}: {getattr(operation, 'error', 'unknown error')}")

    uri = operation.result.generated_videos[0].video.uri
    print(f"[Veo] {label} ready: {uri}")
    return uri


def generate_videos_for_episode(
    episode_data: Dict[str, Any],
    character_image_base64: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate Veo videos in-process for every scene in the episode.
    Populates video_url only (no feedback or idle clips).
    """
    veo_client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)
    episode_id = episode_data.get("episode_id", f"ep_{int(time.time())}_{uuid.uuid4().hex[:8]}")

    # Prepare character reference image (asset reference for character consistency)
    asset_reference_config = None
    temp_asset_ref_path = None
    if character_image_base64:
        print("[Veo] Processing character reference image...")
        asset_ref_bytes = base64.b64decode(character_image_base64)
        fd, temp_asset_ref_path = tempfile.mkstemp(suffix="_asset_ref.png")
        with os.fdopen(fd, "wb") as tmp:
            tmp.write(asset_ref_bytes)
        asset_reference_config = VideoGenerationReferenceImage(
            image=types.Image.from_file(location=temp_asset_ref_path),
            reference_type="asset",
        )


    for idx, scene in enumerate(episode_data["scenes"]):
        scene_num = scene["scene_number"]
        print(f"[Veo] Processing scene {scene_num}/{len(episode_data['scenes'])}...")

        final_prompt = _build_veo_prompt(scene["prompt"], scene.get("dialogue"))

        config_params: Dict[str, Any] = {
            "aspect_ratio": "16:9",
            "number_of_videos": 1,
            "duration_seconds": 8,
            "generate_audio": True,
            "negative_prompt": DEFAULT_NEGATIVE_PROMPT,
            "output_gcs_uri": f"gs://{BUCKET_NAME}/episodes/{episode_id}/scenes/scene_{scene_num}",
        }
        if asset_reference_config:
            config_params["reference_images"] = [asset_reference_config]

        scene_uri = _generate_single_video(
            veo_client, final_prompt, None, config_params, label=f"scene_{scene_num}"
        )

        # Update scene with real video URL (signed)
        scene["video_url"] = _get_signed_url(BUCKET_NAME, _gcs_object_name_from_uri(scene_uri))

    # Cleanup temp files
    if temp_asset_ref_path and os.path.exists(temp_asset_ref_path):
        os.remove(temp_asset_ref_path)

    print(f"[Pipeline] All videos generated. Episode: {episode_id} scene {scene_num}")
    return episode_data


# ---------------------------------------------------------------------------
# Schema Validation
# ---------------------------------------------------------------------------

def validate_episode_schema(episode_data: Dict[str, Any]) -> tuple:
    errors = []
    required_fields = ["episode_id", "title", "description", "skills", "scenes"]
    for field in required_fields:
        if field not in episode_data:
            errors.append(f"Missing required field: {field}")

    if "scenes" not in episode_data:
        return False, errors

    scenes = episode_data["scenes"]
    if len(scenes) != REQUIRED_SCENE_COUNT:
        errors.append(f"Expected {REQUIRED_SCENE_COUNT} scenes, got {len(scenes)}")

    for i, scene in enumerate(scenes, start=1):
        scene_num = scene.get("scene_number", i)
        required_scene_fields = ["scene_number", "interaction", "video_url", "prompt", "dialogue"]
        for field in required_scene_fields:
            if field not in scene:
                errors.append(f"Scene {scene_num}: Missing required field '{field}'")

        is_interactive = scene.get("interaction", False)
        should_be_interactive = scene_num in INTERACTIVE_SCENE_INDICES
        if is_interactive != should_be_interactive:
            errors.append(f"Scene {scene_num}: interaction should be {should_be_interactive}, got {is_interactive}")

        if is_interactive:
            for field in ["interaction_type", "question", "options", "correct_answer_index"]:
                if field not in scene:
                    errors.append(f"Scene {scene_num}: Interactive scene missing '{field}'")
            if "options" in scene:
                if not isinstance(scene["options"], list) or len(scene["options"]) != 4:
                    errors.append(f"Scene {scene_num}: 'options' must be a list of exactly 4 items")
            if "correct_answer_index" in scene:
                idx = scene["correct_answer_index"]
                if not isinstance(idx, int) or idx < 0 or idx > 3:
                    errors.append(f"Scene {scene_num}: 'correct_answer_index' must be 0-3")

    return len(errors) == 0, errors


# ---------------------------------------------------------------------------
# Gemini Clients + Episode Plan
# ---------------------------------------------------------------------------

def get_gemini_client() -> genai.Client:
    return genai.Client(vertexai=True, project=PROJECT_ID, location="global")


def generate_episode_plan(
    client: genai.Client,
    episode_topic: str,
    story_style: str,
    character_description: Optional[str] = None
) -> Dict[str, Any]:
    """Phase A: Generate complete 8-scene episode plan using Gemini with HIGH thinking."""

    reference_episode = '''
{
  "episode_id": "ecology_explorers_photosynthesis",
  "title": "Lumi's Nature Lab: How Plants Make Food!",
  "description": "Join Lumi the Bunny in an outdoor ecology learning lab to uncover the three key ingredients plants use to make food — and the oxygen they share with the world.",
  "skills": ["Early Biology", "Scientific Thinking"],
  "scenes": [
    {
      "scene_number": 1,
      "interaction": false,
      "video_url": "gs://placeholder/scene1.mp4",
      "prompt": "Cinematic 2D storybook-style outdoor ecology lab. Lumi the Bunny kneels beside a drooping plant, gently lifting a leaf. Warm morning sunlight, NO readable text.",
      "dialogue": "Oh no… this little plant is tired. Have you ever wondered how plants make their food?"
    },
    {
      "scene_number": 2,
      "interaction": true,
      "interaction_type": "quiz",
      "video_url": "gs://placeholder/scene2.mp4",
      "prompt": "Same outdoor ecology lab. Lumi stands front and center, thinking and curious about plants. Background shows various potted plants at different stages of growth. Lighting is bright and encouraging. No readable text anywhere.",
      "dialogue": "Plants need three things to make their food. Do you remember what sunlight does?",
      "question": "What does sunlight help plants do?",
      "options": ["Make food", "Take a nap", "Hide from bugs", "Drink water"],
      "correct_answer_index": 0
    }
  ]
}
'''

    planning_prompt = f"""
You are an expert educational content designer creating interactive episodes for children.

USER REQUEST:
- Episode Topic: {episode_topic}
- Story Style: {story_style}
{f"- Character: {character_description}" if character_description else ""}

REFERENCE EPISODE (schema and style guide):
{reference_episode}

CRITICAL REQUIREMENTS:
You must generate a complete episode JSON that follows this EXACT structure and rules:

1. CHARACTER CONSISTENCY (CRITICAL - MUST FOLLOW):
   ⚠️ ONLY ONE CHARACTER: The character from the reference image is the ONLY character in the entire episode
   - NO other characters should appear in any scene - NOT EVEN IN THE BACKGROUND
   - NO other characters should speak or be mentioned
   - NO new characters should be introduced in later scenes
   - NO friends, companions, helpers, or background characters of any kind
   - This character is the sole guide, teacher, and companion throughout
   - All prompts must feature ONLY this character
   - All dialogue is spoken by ONLY this character
   - The character is ALWAYS ALONE in every single scene
   
   ⚠️ EPISODE DESCRIPTION FORMAT:
   - Use the character's NAME (not their species/type)
   - Focus on WHAT the lesson teaches, not WHO the character is
   - Format: "[Character Name] explores [lesson topic]" or "[Character Name] discovers [concept]"
   - Example: "Lumi explores how plants make food through photosynthesis"
   - NOT: "Join Lumi the Bunny in learning about..." (avoid mentioning species)

2. EPISODE STRUCTURE (NON-NEGOTIABLE):
   - Exactly 8 scenes
   - Scenes 2, 4, 6 → interaction: true (quiz MCQ)
   - Scenes 1, 3, 5, 7, 8 → interaction: false

3. SCENE PURPOSE BY INDEX:
   - Scene 1: Introduce the main concept (non-interactive)
   - Scene 2: First interaction checkpoint (INTERACTIVE)
   - Scene 3: Deepen understanding (non-interactive)
   - Scene 4: Second interaction checkpoint (INTERACTIVE)
   - Scene 5: Expand the concept (non-interactive)
   - Scene 6: Third interaction checkpoint (INTERACTIVE)
   - Scene 7: Connect to real-world application (non-interactive)
   - Scene 8: Celebrate learning and recap (non-interactive)

4. REQUIRED JSON SCHEMA:
{{
  "episode_id": "unique_id",
  "title": "Episode Title",
  "description": "[Character Name] explores [topic]",
  "skills": ["Skill1", "Skill2"],
  "scenes": [
    {{
      "scene_number": 1,
      "interaction": false,
      "video_url": "gs://placeholder/scene1.mp4",
      "prompt": "Detailed Veo video generation prompt for this scene",
      "dialogue": "What the character says in this scene"
    }},
    {{
      "scene_number": 2,
      "interaction": true,
      "interaction_type": "quiz",
      "video_url": "gs://placeholder/scene2.mp4",
      "prompt": "Detailed Veo video generation prompt",
      "dialogue": "What the character asks/says",
      "question": "The question to ask the child",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer_index": 0
    }},
    ... (continue for all 8 scenes)
  ]
}}

5. DIALOGUE REQUIREMENTS (CRITICAL - MUST FOLLOW EXACTLY):
   ⚠️ HARD CONSTRAINT: All dialogue must be concise and speakable within 6-8 seconds maximum.
   
   Style Guidelines:
   - Use short, simple sentences (prefer one sentence, maximum two if very brief)
   - Warm, clear, conversational, and energetic tone
   - NOT instructional or overly explanatory
   - Avoid compound explanations or multiple concepts in one line
   - Optimize for early-child comprehension
   
   Examples from Try Experiences episodes:
   ✅ "Oh no… this little plant is tired. Have you ever wondered how plants make their food?"
   ✅ "Plants need sunlight! What in the sky can help our plant get sunlight?"
   ✅ "Let's help this room save energy!"
   ❌ "Today we are going to learn several important ways to conserve electrical power…"
   ❌ "Now I want you to think carefully about all the different types of…"

6. INTERACTION DESIGN FRAMEWORK (CRITICAL - DEMONSTRATE-EXPLAIN-TRANSFER):
   
   ⚠️ PEDAGOGICAL STRUCTURE - Follow this 3-step learning pattern:
   
   Step 1: DEMONSTRATE
   - Show one clear example visually in the video
   - Make the concept concrete and observable
   
   Step 2: EXPLAIN
   - Briefly explain the idea using short, child-friendly dialogue
   - Connect the demonstration to the underlying concept
   
   Step 3: TRANSFER TASK (The Interaction Checkpoint)
   - Present a NEW situation where the learner must APPLY the idea
   - This is where the interaction happens
   - The child must transfer their understanding to a novel context
   
   ⚠️ MCQ QUIZ INTERACTION DESIGN (FOR SCENES 2, 4, 6):
   
   Each interactive scene MUST have:
   - A clear QUESTION that tests understanding
   - FOUR answer OPTIONS (always exactly 4 choices)
   - CORRECT_ANSWER_INDEX (0-3, the index of the correct option)
   
   Quiz questions must require the learner to:
   • Recall information learned in previous scenes
   • Apply concepts to new situations
   • Identify correct solutions
   • Choose the best answer from multiple options
   
   ⚠️ MCQ DIALOGUE FORMAT:
   Dialogue should naturally present the context, while the question field contains the exact question.
   
   Examples:
   ✅ GOOD MCQ:
        dialogue: I cut this pizza into four slices. If I eat three, is that more or less than one slice?
        question: Which fraction shows more pizza?
        options: ["3/4", "1/4", "They are equal", "None"]
        correct_answer_index: 0
    ✅ dialogue: "I have an apple and a banana. Which one starts with the letter A?
        question: "Which word begins with A?
        options: ["Apple", "Banana", "Both", "Neither"]
        correct_answer_index: 0
   ❌ BAD MCQ:
      dialogue: "Can you help me pick the right answer?"
      question: "What happens when plants get sunlight?"
      options: ["Make food", "Sleep", "Change color", "Hide"]
      correct_answer_index: 0
   
   ❌ BAD MCQ:
      dialogue: "Let's test what you learned!"
      question: "Which fraction is bigger: 3/4 or 1/4?"
      options: ["3/4", "1/4", "They're equal", "Neither"]
      correct_answer_index: 0
   ⚠️ TASK VARIETY IN MCQ:
   Ensure the 3 quiz questions (scenes 2, 4, 6) test different skills:
   • Scene 2: Recall/comprehension of main concept
   • Scene 4: Application of concept to new situation
   • Scene 6: Synthesis/deeper understanding or real-world application

7. VEO PROMPT GUIDELINES:
   - Each prompt should be detailed and specific for video generation
   - Maintain visual consistency across scenes
   - Include character actions, environment, and key visual elements
   - Keep prompts focused and clear
   - Use "NO readable text" to avoid unwanted text in videos
   
   ⚠️ CHARACTER CONSISTENCY IN PROMPTS:
   - ONLY the user's character should appear in every scene
   - NO other characters, companions, friends, or background characters
   - NO new characters introduced in Scene 2, 3, 4, or any later scenes
   - The character is ALWAYS ALONE, interacting directly with the viewer
   - Reference the character by NAME only in prompts (e.g., "Lumi", not "Lumi the bunny")
   - Maintain the EXACT SAME character design, appearance, and personality throughout
   - If you need multiple entities, use INANIMATE OBJECTS (plants, objects, items) NOT other characters
   
   ⚠️ CRITICAL VEO CONTENT POLICY - SAFETY REQUIREMENTS (MUST FOLLOW):
   
   FORBIDDEN WORDS - NEVER use these terms (violate Google's Responsible AI practices):
   - "child", "children", "kid", "kids", "toddler", "baby", "infant"
   - "human", "person", "people", "man", "woman", "boy", "girl"
   - Any age-specific human descriptors
   
   FORBIDDEN THEMES & CONTENT - NEVER include:
   - Violence, weapons, fighting, danger, harm, injury
   - Scary, dark, horror, frightening, threatening content
   - Negative emotions: fear, sadness, anger, distress
   - Inappropriate objects: guns, knives, alcohol, drugs, cigarettes
   - Mature themes: romance, dating, adult situations
   - Religious or political content
   - Death, dying, illness, medical procedures
   - Bullying, meanness, exclusion, conflict
   - Disasters, accidents, emergencies
   - Anything that could frighten or upset young viewers
   
   REQUIRED SAFE ALTERNATIVES:
   ✅ Characters: Animal characters (bunny, fox, bear), fantasy creatures (dragon, unicorn), robots
   ✅ Use "young character", "learner", "student", "viewer", "friend" instead of human terms
   ✅ Themes: Positive, educational, encouraging, joyful, curious, friendly
   ✅ Tone: Warm, bright, cheerful, supportive, gentle, playful
   ✅ Settings: Colorful, safe, inviting, magical, nature-based, learning environments
   ✅ Actions: Exploring, discovering, learning, helping, creating, solving puzzles
   
   All characters MUST be non-human animated characters.
   All content must be age-appropriate, positive, and educational.

8. EPISODE TOPIC INTEGRATION:
   - The episode_topic "{episode_topic}" should be the central theme
   - Build a complete learning arc across all 8 scenes
   - Make learning engaging and age-appropriate
   - Each scene should build on previous scenes

Generate the complete 8-scene episode JSON now. Think carefully about the educational flow and interaction design. Use the reference episode as a style and quality guide.
"""

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=planning_prompt,
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(
                thinking_level=types.ThinkingLevel.HIGH,
                include_thoughts=False,
            ),
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)


def expand_scene(
    client: genai.Client,
    scene_stub: Dict[str, Any],
    episode_context: Dict[str, Any],
    thinking_level: str
) -> Dict[str, Any]:
    """Expand a scene stub into a fuller scene with detailed Veo prompt."""
    scene_num = scene_stub.get("scene_number")
    is_interactive = scene_stub.get("interaction", False)
    expansion_prompt = f"""
You are refining scene {scene_num} of an educational episode.

EPISODE CONTEXT:
- Title: {episode_context.get('title')}
- Description: {episode_context.get('description')}
- Skills: {', '.join(episode_context.get('skills', []))}

SCENE STUB:
{json.dumps(scene_stub, indent=2)}

CHARACTER CONSISTENCY (CRITICAL - MUST FOLLOW):
⚠️ ONLY ONE CHARACTER: The character from the reference image is the ONLY character in this scene
- NO other characters should appear or be mentioned
- This character is alone, interacting directly with the viewer
- Reference the character by NAME only (not species/type)
- All dialogue is spoken by ONLY this character

TASK:
{"INTERACTIVE SCENE (MCQ QUIZ) - " if is_interactive else "NON-INTERACTIVE SCENE - "}
Enhance this scene with:
1. A detailed Veo video generation prompt (150-250 words)
2. Concise, warm dialogue (6-8 seconds max when spoken)
{"3. Clear MCQ question, 4 options, correct_answer_index (0-3)" if is_interactive else ""}

DIALOGUE REQUIREMENTS (MUST FOLLOW):
⚠️ HARD CONSTRAINT: All dialogue must be concise and speakable within 6-8 seconds maximum.
- Use short, simple sentences (prefer one sentence, maximum two if very brief)
- Warm, clear, conversational, and energetic tone
- NOT instructional or overly explanatory
- Avoid compound explanations or multiple concepts in one line
- Optimize for early-child comprehension

Examples:
✅ "Oh no… this little plant is tired. Have you ever wondered how plants make their food?"
✅ "Plants need sunlight! Can you draw a bright sun in the sky to help our plant?"
✅ "Let's help this room save energy!"
❌ "Today we are going to learn several important ways to conserve electrical power…"

{"MCQ QUIZ INTERACTION DESIGN (FOR INTERACTIVE SCENES):" if is_interactive else ""}
{"" if is_interactive else ""}
{"⚠️ MCQ STRUCTURE:" if is_interactive else ""}
{"- Question: Clear, grounded in previous scene content or visual context" if is_interactive else ""}
{"- Options: Exactly 4 choices, plausible and age-appropriate" if is_interactive else ""}
{"- Design: One obviously correct answer, others are reasonable distractors" if is_interactive else ""}
{"" if is_interactive else ""}
{"⚠️ MCQ DIALOGUE FORMAT:" if is_interactive else ""}
{"Dialogue should naturally set up the quiz without revealing the answer." if is_interactive else ""}
{"" if is_interactive else ""}
{"Examples:" if is_interactive else ""}
{"✅ dialogue: 'It's cloudy today! The plants cannot grow. Do you know why they need it?'" if is_interactive else ""}
{"   question: 'What do plants do with sunlight?'" if is_interactive else ""}
{"   options: ['Make food', 'Sleep', 'Change color', 'Hide']" if is_interactive else ""}
{"   correct_answer_index: 0" if is_interactive else ""}
{"" if is_interactive else ""}
{"✅ dialogue: 'I cut this pizza into four slices. If I eat three, is that more or less than one slice?'" if is_interactive else ""}
{"   question: 'Which fraction shows more pizza?'" if is_interactive else ""}
{"   options: ['3/4', '1/4', 'They are equal', 'Neither']" if is_interactive else ""}
{"   correct_answer_index: 0" if is_interactive else ""}


⚠️ CRITICAL VEO CONTENT POLICY - SAFETY REQUIREMENTS (MUST FOLLOW):

FORBIDDEN WORDS - NEVER use these terms (violate Google's Responsible AI practices):
- "child", "children", "kid", "kids", "toddler", "baby", "infant"
- "human", "person", "people", "man", "woman", "boy", "girl"
- Any age-specific human descriptors

FORBIDDEN THEMES & CONTENT - NEVER include:
- Violence, weapons, fighting, danger, harm, injury
- Scary, dark, horror, frightening, threatening content
- Negative emotions: fear, sadness, anger, distress
- Inappropriate objects: guns, knives, alcohol, drugs, cigarettes
- Mature themes: romance, dating, adult situations
- Religious or political content
- Death, dying, illness, medical procedures
- Bullying, meanness, exclusion, conflict
- Disasters, accidents, emergencies
- Anything that could frighten or upset young viewers

REQUIRED SAFE ALTERNATIVES:
✅ Characters: Animal characters (bunny, fox, bear), fantasy creatures (dragon, unicorn), robots
✅ Use "young character", "learner", "student", "viewer", "friend" instead of human terms
✅ Themes: Positive, educational, encouraging, joyful, curious, friendly
✅ Tone: Warm, bright, cheerful, supportive, gentle, playful
✅ Settings: Colorful, safe, inviting, magical, nature-based, learning environments
✅ Actions: Exploring, discovering, learning, helping, creating, solving puzzles

All characters MUST be non-human animated characters.
All content must be age-appropriate, positive, and educational.

Return the complete scene JSON with all required fields.
"""

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=expansion_prompt,
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(
                thinking_level=thinking_level,
                include_thoughts=False
            ),
            response_mime_type="application/json"
        )
    )
    
    expanded_scene = json.loads(response.text)
    
    # FIX: Unwrap if Gemini returned a list instead of a dict
    if isinstance(expanded_scene, list) and len(expanded_scene) > 0:
        expanded_scene = expanded_scene[0]
    elif not isinstance(expanded_scene, dict):
        print(f"[WARNING] Scene {scene_num} expansion returned unexpected type, using original")
        return scene_stub
    
    return expanded_scene


def expand_all_scenes(
    client: genai.Client,
    episode_plan: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Phase B: Expand all scenes with appropriate thinking levels.
    HIGH thinking for scenes 2, 4, 6 (interactive)
    LOW thinking for scenes 1, 3, 5, 7, 8 (non-interactive)
    """
    
    expanded_scenes = []
    
    for scene in episode_plan["scenes"]:
        scene_num = scene.get("scene_number")
        
        # Determine thinking level based on scene type
        if scene_num in INTERACTIVE_SCENE_INDICES:
            thinking_level = types.ThinkingLevel.HIGH
        else:
            thinking_level = types.ThinkingLevel.LOW
        
        # Expand the scene
        expanded_scene = expand_scene(
            client=client,
            scene_stub=scene,
            episode_context={
                "title": episode_plan.get("title"),
                "description": episode_plan.get("description"),
                "skills": episode_plan.get("skills", [])
            },
            thinking_level=thinking_level
        )
        
        expanded_scenes.append(expanded_scene)
    
    # Update episode with expanded scenes
    episode_plan["scenes"] = expanded_scenes
    return episode_plan


def repair_episode_with_gemini(
    client: genai.Client,
    episode_data: Dict[str, Any],
    validation_errors: List[str]
) -> Dict[str, Any]:
    repair_prompt = f"""
The following episode JSON has validation errors. Fix them and return a corrected version.

VALIDATION ERRORS:
{chr(10).join(f"- {error}" for error in validation_errors)}

CURRENT EPISODE JSON:
{json.dumps(episode_data, indent=2)}

REQUIREMENTS:
- Exactly 8 scenes
- Only scenes 2, 4, 6 should have "interaction": true
- Interactive scenes MUST have: interaction_type, question, options (array of 4), correct_answer_index
- Non-interactive scenes MUST NOT have those fields
- All scenes must have: scene_number, interaction, video_url, prompt, dialogue

Return the corrected episode JSON.
"""
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=repair_prompt,
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(
                thinking_level=types.ThinkingLevel.HIGH,
                include_thoughts=False,
            ),
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)


# ---------------------------------------------------------------------------
# Main Pipeline
# ---------------------------------------------------------------------------

def generate_episode_json(
    episode_topic: str,
    story_style: str,
    character_image_base64: Optional[str] = None,
    character_description: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a validated episode JSON using Gemini (no videos yet)."""
    client = get_gemini_client()

    print("[Phase A] Generating episode plan with Gemini...")
    episode_plan = generate_episode_plan(
        client=client,
        episode_topic=episode_topic,
        story_style=story_style,
        character_description=character_description,
    )

    print("[Phase B] Expanding scenes...")
    complete_episode = expand_all_scenes(client, episode_plan)

    for attempt in range(MAX_VALIDATION_RETRIES):
        print(f"[Validation] Attempt {attempt + 1}/{MAX_VALIDATION_RETRIES}")
        is_valid, errors = validate_episode_schema(complete_episode)
        if is_valid:
            print("[Validation] Episode valid!")
            return complete_episode
        print(f"[Validation] Errors: {errors}")
        if attempt < MAX_VALIDATION_RETRIES - 1:
            complete_episode = repair_episode_with_gemini(client, complete_episode, errors)
        else:
            raise ValueError(f"Episode generation failed after {MAX_VALIDATION_RETRIES} attempts. Errors: {errors}")

    raise ValueError("Episode generation failed unexpectedly")


def generate_complete_episode(
    episode_topic: str,
    story_style: str,
    character_image_base64: Optional[str] = None,
    character_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full pipeline: Gemini JSON → Veo videos → complete episode with signed URLs.
    This is the main entry point called from main.py background task.
    """
    print("[Pipeline] Step 1: Generating episode JSON with Gemini...")
    episode_data = generate_episode_json(
        episode_topic=episode_topic,
        story_style=story_style,
        character_image_base64=character_image_base64,
        character_description=character_name,
    )
    print(f"[Pipeline] Episode JSON: {episode_data.get('episode_id')}")

    print("[Pipeline] Step 2: Generating videos with Veo...")
    complete_episode = generate_videos_for_episode(
        episode_data=episode_data,
        character_image_base64=character_image_base64,
    )
    print(f"[Pipeline] Complete! Episode ready: {complete_episode.get('episode_id')}")
    return complete_episode