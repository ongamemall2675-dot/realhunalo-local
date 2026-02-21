import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from services.script_service import script_service
from services.task_service import task_manager

router = APIRouter(tags=["Script"])
logger = logging.getLogger(__name__)

# --- Request Models ---

class GenerateScriptRequest(BaseModel):
    topic: str
    style: Optional[str] = "engaging"
    model: Optional[str] = "deepseek-reasoner"
    temperature: Optional[float] = 0.7

class SegmentScriptRequest(BaseModel):
    script: str
    model: Optional[str] = "deepseek-reasoner"

# --- Endpoints ---

@router.post("/api/segment-script")
async def api_segment_script(request: SegmentScriptRequest, background_tasks: BackgroundTasks):
    try:
        task_id = task_manager.create_task("script_segmentation")
        
        def process_segmentation(tid: str, req: SegmentScriptRequest):
            try:
                task_manager.update_task(tid, status="processing", progress=10, message="대본 세그멘테이션 중...")
                result = script_service.segment_script(req.script, model=req.model)
                if result.get("success"):
                    task_manager.update_task(
                        tid, 
                        status="completed", 
                        progress=100, 
                        message="대본 세그멘테이션 완료!",
                        result=result
                    )
                else:
                    task_manager.update_task(
                        tid,
                        status="failed",
                        error=result.get("error", "Unknown error")
                    )
            except Exception as e:
                logger.error(f"Segmentation error: {e}")
                task_manager.update_task(tid, status="failed", error=str(e))
        
        background_tasks.add_task(process_segmentation, task_id, request)
        return {"success": True, "taskId": task_id}
    except Exception as e:
        logger.error(f"API segmentation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/generate-script")
async def api_generate_script(request: GenerateScriptRequest, background_tasks: BackgroundTasks):
    if not request.model or request.model in ["gpt-4o-mini", "deepseek-chat"]:
        request.model = "deepseek-reasoner"
    try:
        task_id = task_manager.create_task("script_generation")
        
        def process_script(tid: str, req: GenerateScriptRequest):
            try:
                task_manager.update_task(tid, status="processing", progress=10, message="대본 생성 중...")
                result = script_service.generate(
                    topic=req.topic,
                    style=req.style,
                    model=req.model,
                    temperature=req.temperature
                )
                if result.get("success"):
                    task_manager.update_task(
                        tid, 
                        status="completed", 
                        progress=100, 
                        message="대본 생성 완료!",
                        result=result
                    )
                else:
                    task_manager.update_task(
                        tid,
                        status="failed",
                        error=result.get("error", "Unknown error")
                    )
            except Exception as e:
                logger.error(f"Script generation error: {e}")
                task_manager.update_task(tid, status="failed", error=str(e))
        
        background_tasks.add_task(process_script, task_id, request)
        return {"success": True, "taskId": task_id}
    except Exception as e:
        logger.error(f"API script generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
