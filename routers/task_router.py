from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from services.task_service import task_manager

router = APIRouter(
    prefix="/api/tasks",
    tags=["tasks"]
)

@router.get("/{task_id}")
async def get_task_status(task_id: str) -> Dict[str, Any]:
    """
    Get the status and result of a background task.
    """
    task = task_manager.get_task(task_id)
    if not task:
        # 프런트엔드가 404를 계속 받으면 문제가 되므로 명확한 오류 반환
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task
