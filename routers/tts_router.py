from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
from services.tts_service import tts_service
import logging

# 라우터 설정
router = APIRouter(tags=["TTS"])
logger = logging.getLogger(__name__)

# --- Request Models ---

class TTSSettings(BaseModel):
    engine: str = "azure"
    voiceId: Optional[str] = None
    stability: float = 0.5
    speed: float = 1.0

class TTSRequest(BaseModel):
    sceneId: str
    text: str
    settings: TTSSettings

# --- Endpoints ---

@router.get("/api/tts/status")
async def api_tts_status():
    """TTS 서비스 상태를 반환 (프론트엔드 서비스 모니터용)"""
    status = "ok" if tts_service else "error"
    return {
        "status": status,
        "service": "TTS Service",
        "details": "Ready" if status == "ok" else "Service not initialized"
    }

@router.post("/api/generate-tts")
def generate_tts(request: TTSRequest):
    """
    TTS 오디오 생성 엔드포인트
    """
    try:
        # TTS 서비스 초기화 확인
        if tts_service is None:
            raise HTTPException(status_code=503, detail="TTS Service is not initialized")

        # Voice ID 처리 (settings에서 가져옴)
        voice_id = request.settings.voiceId

        # Debug logging
        logger.info(f"[TTS Router] Generating TTS:")
        logger.info(f"  Engine: {request.settings.engine}")
        logger.info(f"  Voice ID: {voice_id}")
        logger.info(f"  Text length: {len(request.text)}")

        # 서비스 호출
        # generate(self, text, voice_id=None, language="ko-KR", speed=1.0, scene_id="unknown", engine=None, enable_fallback=True, **kwargs)
        result = tts_service.generate(
            text=request.text,
            voice_id=voice_id,
            language="ko-KR", # 기본값
            speed=request.settings.speed,
            scene_id=request.sceneId,
            engine=request.settings.engine,
            stability=request.settings.stability,
            settings=request.settings.dict()  # Google TTS가 settings 객체를 사용할 수 있도록 전달
        )

        logger.info(f"[TTS Router] Result: success={result.get('success')}, engine={result.get('usedEngine')}")

        if not result.get("success"):
             raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))

        return result

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error generating TTS: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/tts/voices")
def get_voices():
    """
    사용 가능한 TTS 성우 목록 반환
    """
    try:
        if tts_service is None:
             raise HTTPException(status_code=503, detail="TTS Service is not initialized")
        
        return {
            "success": True,
            "voices": tts_service.get_voices_list()
        }
    except Exception as e:
        logger.error(f"Error fetching voices: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "voices": {"azure": [], "elevenlabs": []}
        }
