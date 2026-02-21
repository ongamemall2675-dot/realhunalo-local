import os
import json
import uuid
import shutil
from datetime import datetime
from typing import List, Dict, Optional, Any
from .utils import BASE_DIR, log_debug, log_error
from .cache_service import cache_service

PROJECTS_DIR = os.path.join(BASE_DIR, "projects")

# Ensure projects directory exists
os.makedirs(PROJECTS_DIR, exist_ok=True)

class ProjectService:
    def __init__(self):
        self.projects_dir = PROJECTS_DIR

    def _get_project_path(self, project_id: str) -> str:
        return os.path.join(self.projects_dir, f"{project_id}.json")

    def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects with metadata (sorted by updated_at desc)"""
        # 캐시 키 생성
        cache_key = "projects:list"
        
        # 캐시에서 먼저 조회
        cached = cache_service.get(cache_key)
        if cached is not None:
            print(f"[CACHE] 프로젝트 목록 캐시 히트")
            return cached
        
        projects = []
        try:
            if not os.path.exists(self.projects_dir):
                cache_service.set(cache_key, [], ttl=30)  # 빈 목록도 캐싱
                return []

            for filename in os.listdir(self.projects_dir):
                if not filename.endswith(".json"):
                    continue
                
                filepath = os.path.join(self.projects_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        # Extract metadata only for the list
                        projects.append({
                            "id": data.get("id"),
                            "name": data.get("name", "Untitled Project"),
                            "createdAt": data.get("createdAt"),
                            "updatedAt": data.get("updatedAt"),
                            "sceneCount": len(data.get("scenes", [])),
                            "thumbnail": data.get("scenes", [{}])[0].get("visualUrl") if data.get("scenes") else None
                        })
                except Exception as e:
                    log_error(f"Error reading project file {filename}: {str(e)}")
                    continue

            # Sort by updatedAt descending (newest first)
            projects.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
            
            # 캐시에 저장 (30초 TTL)
            cache_service.set(cache_key, projects, ttl=30)
            
            return projects

        except Exception as e:
            log_error(f"Error listing projects: {str(e)}")
            return []

    def load_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Load full project data by ID"""
        # 캐시 키 생성
        cache_key = f"project:{project_id}"
        
        # 캐시에서 먼저 조회
        cached = cache_service.get(cache_key)
        if cached is not None:
            print(f"[CACHE] 프로젝트 로드 캐시 히트: {project_id}")
            return cached
        
        try:
            filepath = self._get_project_path(project_id)
            if not os.path.exists(filepath):
                # 존재하지 않는 프로젝트도 캐싱 (짧은 TTL)
                cache_service.set(cache_key, None, ttl=60)
                return None
            
            with open(filepath, 'r', encoding='utf-8') as f:
                project_data = json.load(f)
                
                # 캐시에 저장 (5분 TTL)
                cache_service.set(cache_key, project_data, ttl=300)
                
                return project_data
        except Exception as e:
            log_error(f"Error loading project {project_id}: {str(e)}")
            return None

    def save_project(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Save project data (create new or update existing)"""
        try:
            project_id = data.get("id")
            now = datetime.now().isoformat()

            if not project_id:
                # Create new project
                project_id = str(uuid.uuid4())
                data["id"] = project_id
                data["createdAt"] = now
            
            data["updatedAt"] = now
            
            # Ensure name exists
            if not data.get("name"):
                data["name"] = f"Project {now[:10]}"

            filepath = self._get_project_path(project_id)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            log_debug(f"Project saved: {project_id} ({data['name']})")
            
            # 캐시 무효화
            cache_service.delete(f"project:{project_id}")
            cache_service.delete("projects:list")
            
            print(f"[CACHE] 프로젝트 저장 후 캐시 무효화: {project_id}")
            
            return data

        except Exception as e:
            log_error(f"Error saving project: {str(e)}")
            raise e

    def delete_project(self, project_id: str) -> bool:
        """Delete a project by ID"""
        try:
            filepath = self._get_project_path(project_id)
            if os.path.exists(filepath):
                os.remove(filepath)
                log_debug(f"Project deleted: {project_id}")
                
                # 캐시 무효화
                cache_service.delete(f"project:{project_id}")
                cache_service.delete("projects:list")
                
                print(f"[CACHE] 프로젝트 삭제 후 캐시 무효화: {project_id}")
                return True
            return False
        except Exception as e:
            log_error(f"Error deleting project {project_id}: {str(e)}")
            return False

project_service = ProjectService()