import threading
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

class TaskManager:
    """
    비동기 작업 상태를 추적하는 클래스 (이미지 생성, 영상 렌더링 등)
    """
    def __init__(self):
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()

    def create_task(self, task_type: str) -> str:
        task_id = str(uuid.uuid4())
        with self.lock:
            self.tasks[task_id] = {
                "id": task_id,
                "type": task_type,
                "status": "pending",
                "progress": 0,
                "message": "작업 대기 중...",
                "result": None,
                "error": None,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
        return task_id

    def update_task(self, task_id: str, status: str = None, progress: int = None, 
                       message: str = None, result: Any = None, error: str = None):
        with self.lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                if status: task["status"] = status
                if progress is not None: task["progress"] = progress
                if message: task["message"] = message
                if result is not None: task["result"] = result
                if error: task["error"] = error
                task["updated_at"] = datetime.now().isoformat()

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            return self.tasks.get(task_id)

    def cleanup_old_tasks(self, max_age_hours: int = 24):
        # TODO: 필요시 구현
        pass

# 전역 인스턴스
task_manager = TaskManager()
