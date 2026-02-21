from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict
from services.shorts_service import shorts_service
import logging

# 라우터 설정
router = APIRouter(prefix="/api/shorts", tags=["Shorts"])
logger = logging.getLogger(__name__)

# 서비스 인스턴스 (싱글톤 사용)
# shorts_service = ShortsService() # Imported instance is used directly

# --- Request Models ---

class ScriptRequest(BaseModel):
    script: str
    options: Optional[Dict] = None

class ProjectAnalysisRequest(BaseModel):
    project_path: str

class HighlightRequest(BaseModel):
    original_project_path: str
    highlight_type: str # 'summary', 'hook_first', 'qna'
    scenes: List[Dict]

# --- Endpoints ---

@router.post("/create/script")
async def create_shorts_from_script(request: ScriptRequest, background_tasks: BackgroundTasks):
    """
    [Mode A] 텍스트 대본으로 쇼츠 프로젝트를 생성합니다.
    """
    try:
        # 비동기 작업으로 처리할 수도 있음 (현재는 동기 호출 후 결과 반환)
        # 하지만 생성이 오래 걸리므로 비동기가 좋지만, 현재 구조상 await로 기다림
        # UI에서 타임아웃 날 수 있으니 나중에는 taskId 반환 구조로 변경 필요
        # 일단은 기다리게 함 (n8n 대체)
        result = await shorts_service.create_shorts_from_script(request.script, request.options)
        return result
    except Exception as e:
        logger.error(f"Error creating shorts from script: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-project")
async def analyze_project(request: ProjectAnalysisRequest):
    """
    [Mode B] 기존 프로젝트를 분석하여 하이라이트 대본을 추출합니다.
    """
    try:
        result = await shorts_service.analyze_project(request.project_path)
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error"))
        return result
    except Exception as e:
        logger.error(f"Error analyzing project: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create/highlight")
async def create_shorts_from_highlight(request: HighlightRequest):
    """
    [Mode B] 선택된 하이라이트 대본으로 쇼츠 프로젝트를 생성합니다.
    """
    try:
        result = await shorts_service.create_shorts_from_highlight(
            request.highlight_type, 
            request.scenes, 
            request.original_project_path
        )
        return result
    except Exception as e:
        logger.error(f"Error creating highlight shorts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
