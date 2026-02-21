import os
import re
import json
import uuid
import logging
import requests
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, File, UploadFile, Request, Form
from pydantic import BaseModel, Field

from services.image_service import image_service
from services.vision_service import vision_service
from services.prompt_assembler import prompt_assembler
from services.task_service import task_manager
from services.utils import BASE_DIR

router = APIRouter(tags=["Image"])
logger = logging.getLogger(__name__)

CHARACTERS_DIR = os.path.join(BASE_DIR, 'data', 'characters')
os.makedirs(CHARACTERS_DIR, exist_ok=True)

# --- Request Models ---

class ImageGenerationRequest(BaseModel):
    prompt: str
    model: Optional[str] = "black-forest-labs/flux-schnell"
    aspect_ratio: Optional[str] = "16:9"

# --- Endpoints ---

@router.post("/api/generate-image")
def api_generate_image(request: ImageGenerationRequest):
    try:
        result = image_service.generate(
            prompt=request.prompt,
            model=request.model,
            aspect_ratio=request.aspect_ratio
        )
        return result
    except Exception as e:
        logger.error(f"Image generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/generate-motion-prompts-batch")
async def generate_motion_prompts_batch(request: Dict[str, Any], background_tasks: BackgroundTasks):
    try:
        scenes = request.get('scenes', [])
        if not scenes:
            raise HTTPException(status_code=400, detail='데이터가 없습니다')

        task_id = task_manager.create_task("motion_prompts_batch")

        def process_motion_prompts(tid: str, scene_list: list):
            from services.script_service import script_service
            try:
                task_manager.update_task(tid, status="processing", progress=10, message=f"{len(scene_list)}개 모션 프롬프트 생성 중...")
                service_scenes = []
                for scene in scene_list:
                    service_scenes.append({
                        "sceneId": scene.get('sceneId'),
                        "originalScript": scene.get('script', ''),
                        "imagePrompt": scene.get('imagePrompt', '')
                    })

                result = script_service.generate_motion_prompts_from_scenes(service_scenes)
                if not result.get('success'):
                    raise Exception(result.get('error', 'Unknown error'))

                generated_prompts = result.get('prompts', [])
                response_prompts = [
                    {'sceneId': gp.get('sceneId'), 'motionPrompt': gp.get('motionPrompt')}
                    for gp in generated_prompts
                ]

                task_manager.update_task(
                    tid,
                    status="completed",
                    progress=100,
                    message=f"{len(response_prompts)}개 모션 프롬프트 생성 완료!",
                    result={"prompts": response_prompts}
                )
            except Exception as e:
                logger.error(f"Error processing motion prompts: {e}")
                task_manager.update_task(tid, status="failed", error=str(e))

        background_tasks.add_task(process_motion_prompts, task_id, scenes)
        return {"success": True, "taskId": task_id}
    except Exception as e:
        logger.error(f"Motion prompts batch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/generate-image-prompts-batch")
async def api_generate_image_prompts_batch(request: dict, background_tasks: BackgroundTasks):
    try:
        scenes = request.get('scenes', [])
        img_settings = request.get('imgSettings', {})
        if not scenes:
            raise HTTPException(status_code=400, detail="씬 데이터가 없습니다.")

        task_id = task_manager.create_task("image_prompts_batch")
        background_tasks.add_task(process_prompts, task_id, scenes, img_settings)
        return {"success": True, "taskId": task_id}
    except Exception as e:
        logger.error(f"Batch image prompt error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_prompts(tid: str, scene_list: list, img_settings: dict):
    try:
        deepseek_key = os.getenv('DEEPSEEK_API_KEY')
        if not deepseek_key:
            raise Exception("DEEPSEEK_API_KEY가 설정되지 않았습니다.")

        task_manager.update_task(tid, status="processing", progress=5, message="프롬프트 생성준비 중...")
        results = []
        total = len(scene_list)
        
        style_info = img_settings.get('stylePrompt')
        style_prompt = ""
        if isinstance(style_info, dict):
            style_prompt = style_info.get('prompt', '')
        else:
            style_prompt = str(style_info or '')

        for i, scene in enumerate(scene_list):
            scene_id = scene.get('sceneId')
            script = scene.get('script', '')
            
            task_manager.update_task(tid, progress=int((i/total)*90), message=f"[{i+1}/{total}] 장면 분석 및 프롬프트 조립 중...")
            
            # Step 1: Background context extraction via LLM
            bg_system = "Analyze the provided script and extract background context in JSON format. JSON keys: location, time_of_day, weather, mood, cultural_elements."
            bg_resp = requests.post(
                'https://api.deepseek.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {deepseek_key}', 'Content-Type': 'application/json'},
                json={
                    'model': 'deepseek-chat',
                    'messages': [
                        {'role': 'system', 'content': bg_system},
                        {'role': 'user', 'content': f'대본: {script}\n\nJSON만 출력하세요:'}
                    ],
                    'max_tokens': 300,
                    'temperature': 0.3
                },
                timeout=30
            )
            
            bg_context = {}
            if bg_resp.status_code == 200:
                bg_text = bg_resp.json()['choices'][0]['message']['content']
                json_match = re.search(r'\{.*?\}', bg_text, re.DOTALL)
                if json_match:
                    try:
                        bg_context = json.loads(json_match.group())
                    except Exception:
                        pass

            # Step 2: Prompt Assembler (Safe join fix included)
            scene_json = {
                "action": script,
                "background": ", ".join(
                    (", ".join(p) if isinstance(p, list) else str(p))
                    for p in [
                        bg_context.get('location', ''),
                        bg_context.get('time_of_day', ''),
                        bg_context.get('weather', ''),
                        bg_context.get('mood', ''),
                        bg_context.get('cultural_elements', '')
                    ] if p
                )
            }
            
            style_json = {
                "base_style": style_prompt if style_prompt else "High quality, highly detailed",
                "camera": "cinematic lighting, photorealistic details"
            }
            
            character_json_input = img_settings.get("json_profile")
            if character_json_input and not isinstance(character_json_input, list):
                character_json_input = [character_json_input]

            assembled_prompt = prompt_assembler.assemble_prompt(
                scene_json=scene_json,
                style_json=style_json,
                character_json=character_json_input
            )
            
            system_guardrails = prompt_assembler.build_system_prompt_for_llm(
                style_json=style_json,
                character_json=character_json_input
            )

            prompt_text = f"""Translate and refine the following Assembled Prompt into a highly descriptive English image prompt.
Remember: 50-80 words, ONLY output the prompt text itself.
[Assembled Base Prompt]
{assembled_prompt}"""

            final_resp = requests.post(
                'https://api.deepseek.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {deepseek_key}', 'Content-Type': 'application/json'},
                json={
                    'model': 'deepseek-chat',
                    'messages': [
                        {'role': 'system', 'content': system_guardrails},
                        {'role': 'user', 'content': prompt_text}
                    ],
                    'max_tokens': 300,
                    'temperature': 0.2
                },
                timeout=30
            )

            if final_resp.status_code == 200:
                final_prompt = final_resp.json()['choices'][0]['message']['content'].strip()
                results.append({"sceneId": scene_id, "imagePrompt": final_prompt})
            else:
                results.append({"sceneId": scene_id, "imagePrompt": assembled_prompt})

        task_manager.update_task(tid, status="completed", progress=100, message="모든 프롬프트 생성 완료!", result={"prompts": results})
    except Exception as e:
        logger.error(f"Error in process_prompts: {e}")
        task_manager.update_task(tid, status="failed", error=str(e))

# --- Characters API ---

@router.post("/api/analyze-character-image")
async def api_analyze_character_image(request: Request):
    """base64 이미지를 분석하여 Character JSON 스키마 반환"""
    try:
        body = await request.json()
        # 프론트엔드는 'image' 필드로 base64 전송
        base64_image = body.get('image')
        if not base64_image:
            raise HTTPException(status_code=400, detail="이미지 데이터를 is required")
        json_profile = vision_service.analyze_character_image(base64_image)
        if not json_profile:
            raise HTTPException(status_code=500, detail="Vision API 분석 실패")
        return {"success": True, "json_profile": json_profile}
    except Exception as e:
        logger.error(f"Vision analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/characters")
async def api_save_character(request: Request):
    """Character JSON를 파일로 저장"""
    try:
        data = await request.json()
        char_id = data.get("id", str(uuid.uuid4())[:8])
        name = data.get("name", "Unnamed")
        json_profile = data.get("json_profile", {})
        char_data = {
            "id": char_id,
            "name": name,
            "json_profile": json_profile,
            "created_at": datetime.now().isoformat()
        }
        filepath = os.path.join(CHARACTERS_DIR, f"{char_id}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(char_data, f, ensure_ascii=False, indent=2)
        return {"success": True, "character": char_data}
    except Exception as e:
        logger.error(f"Error saving character: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/characters")
async def api_get_characters():
    """Character 목록 조회"""
    try:
        characters = []
        if os.path.exists(CHARACTERS_DIR):
            for filename in os.listdir(CHARACTERS_DIR):
                if filename.endswith(".json"):
                    with open(os.path.join(CHARACTERS_DIR, filename), 'r', encoding='utf-8') as f:
                        characters.append(json.load(f))
        return {"success": True, "characters": characters}
    except Exception as e:
        logger.error(f"Error getting characters: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/characters/{char_id}")
async def api_delete_character(char_id: str):
    """Character 파일 삭제"""
    try:
        filepath = os.path.join(CHARACTERS_DIR, f"{char_id}.json")
        if os.path.exists(filepath):
            os.remove(filepath)
            return {"success": True}
        else:
            raise HTTPException(status_code=404, detail="캐릭터를 찾을 수 없습니다.")
    except Exception as e:
        logger.error(f"Error deleting character: {e}")
        raise HTTPException(status_code=500, detail=str(e))
