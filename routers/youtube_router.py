from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.youtube_metadata_service import get_youtube_metadata_service
import logging

# 라우터 설정
router = APIRouter(tags=["YouTube"])
logger = logging.getLogger(__name__)

# --- Request Models ---

class YouTubeMetadataRequest(BaseModel):
    script: str

# --- Endpoints ---

@router.post("/api/youtube/metadata")
async def generate_youtube_metadata(request: YouTubeMetadataRequest):
    """
    유튜브 메타데이터 생성 엔드포인트
    """
    try:
        service = get_youtube_metadata_service()
        if not service:
             raise HTTPException(status_code=503, detail="YouTube Metadata Service is not initialized")

        # 서비스 호출
        metadata = await service.generate_metadata(request.script)

        return {
            "success": True,
            "titles": metadata.get("titles", []),
            "description": metadata.get("description", ""),
            "tags": metadata.get("tags", []),
            "thumbnail_ideas": metadata.get("thumbnail_ideas", []),
            "analytics": metadata.get("analytics", {})
        }

    except Exception as e:
        logger.error(f"Error generating YouTube metadata: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

class ThumbnailPromptRequest(BaseModel):
    script: str

@router.post("/api/youtube/thumbnail/prompts")
async def generate_thumbnail_prompts(request: ThumbnailPromptRequest):
    try:
        service = get_youtube_metadata_service()
        prompts = await service.generate_thumbnail_prompts(request.script)
        return {"success": True, "prompts": prompts}
    except Exception as e:
        logger.error(f"Error generating thumbnail prompts: {e}")
        return {"success": False, "error": str(e)}

class ThumbnailImageRequest(BaseModel):
    prompt: str
    aspectRatio: str = "16:9"

@router.post("/api/youtube/thumbnail/image")
async def generate_thumbnail_image(request: ThumbnailImageRequest):
    try:
        service = get_youtube_metadata_service()
        # image_service 호출은 service 내부에서 처리
        image_url = await service.generate_thumbnail_image(request.prompt)
        return {"success": True, "imageUrl": image_url}
    except Exception as e:
        logger.error(f"Error generating thumbnail image: {e}")
        return {"success": False, "error": str(e)}

