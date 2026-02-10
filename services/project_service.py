import os
import json
import uuid
import shutil
from datetime import datetime
from typing import List, Dict, Optional, Any
from .utils import BASE_DIR, log_debug, log_error

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
        projects = []
        try:
            if not os.path.exists(self.projects_dir):
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
            return projects

        except Exception as e:
            log_error(f"Error listing projects: {str(e)}")
            return []

    def load_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Load full project data by ID"""
        try:
            filepath = self._get_project_path(project_id)
            if not os.path.exists(filepath):
                return None
            
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
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
                return True
            return False
        except Exception as e:
            log_error(f"Error deleting project {project_id}: {str(e)}")
            return False

project_service = ProjectService()
