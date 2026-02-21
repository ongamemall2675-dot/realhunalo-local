import os
import uuid
import logging
import asyncio
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, File, UploadFile, Form
import shutil
from fastapi.responses import FileResponse as FastAPIFileResponse
from pydantic import BaseModel, Field

from services.video_service import video_service
from services.motion_service import motion_service
from services.script_service import script_service
from services.task_service import task_manager
from services.project_service import project_service
from services.utils import OUTPUT_DIR, ASSETS_DIR, BASE_DIR

router = APIRouter(tags=["Video"])
logger = logging.getLogger(__name__)

# --- Request Models ---

class SceneData(BaseModel):
    sceneId: int
    script: str
    text: Optional[str] = None
    duration: float
    audioUrl: Optional[str] = None
    visualUrl: Optional[str] = None
    generatedUrl: Optional[str] = None
    videoUrl: Optional[str] = None
    srtData: Optional[str] = None
    
    class Config:
        alias_generator = lambda s: "".join(word.capitalize() if i > 0 else word for i, word in enumerate(s.split("_")))
        populate_by_name = True

class GroupData(BaseModel):
    groupId: str
    mergedAudio: str
    totalDuration: float
    scenes: List[SceneData]
    
    class Config:
        alias_generator = lambda s: "".join(word.capitalize() if i > 0 else word for i, word in enumerate(s.split("_")))
        populate_by_name = True

class VideoRequest(BaseModel):
    merged_groups: List[GroupData] = Field(default_factory=list, alias="mergedGroups")
    standalone: List[SceneData] = Field(default_factory=list)
    resolution: Optional[str] = "1080p"
    
    class Config:
        populate_by_name = True

class VideoSettingsRequest(BaseModel):
    resolution: str = "1080p"
    fps: int = 30
    preset: str = "medium"
    bitrate: str = "5000k"

class VideoGenerationRequest(BaseModel):
    merged_groups: List[GroupData] = Field(default_factory=list, alias="mergedGroups")
    standalone: List[SceneData] = Field(default_factory=list)
    subtitle_style: Optional[Dict[str, Any]] = Field(None, alias="subtitleStyle")
    resolution: str = "1080p"

    class Config:
        populate_by_name = True

class MotionGenerationRequest(BaseModel):
    sceneId: str
    imageUrl: str
    motionPrompt: Optional[str] = "Slow cinematic camera movement"
    duration: Optional[int] = 5
    aspectRatio: Optional[str] = "16:9"
    model: Optional[str] = None

class MotionPromptRequest(BaseModel):
    originalScript: str
    imagePrompt: str

class ProjectSaveRequest(BaseModel):
    data: Dict[str, Any]

class SegmentAudioFromPathRequest(BaseModel):
    audioPath: str
    maxChars: Optional[int] = 30
    originalScript: Optional[str] = None

class BatchVrewRequest(BaseModel):
    audioFolder: str
    timestampFolder: Optional[str] = None
    autoGenerateTimestamps: bool = False
    outputFilename: Optional[str] = "vrew_project.vrew"

# --- Endpoints ---

@router.get("/api/video/status")
async def api_video_status():
    return {
        "status": "ok",
        "service": "Video Service",
        "details": "Ready"
    }

@router.get("/api/motion/status")
async def api_motion_status():
    return {
        "status": "ok",
        "service": "Motion Service",
        "details": "Ready"
    }

@router.get("/api/video/settings")
def api_video_get_settings():
    return video_service.get_settings()

@router.post("/api/video/settings")
def api_video_update_settings(request: VideoSettingsRequest):
    return video_service.update_settings(
        resolution=request.resolution,
        fps=request.fps,
        preset=request.preset,
        bitrate=request.bitrate
    )

@router.get("/api/download-video/{filename}")
def download_video(filename: str):
    """output 폴더의 영상 파일을 Content-Disposition: attachment로 강제 다운로드"""
    safe_name = os.path.basename(filename)
    file_path = os.path.join(OUTPUT_DIR, safe_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
    return FastAPIFileResponse(
        path=file_path,
        media_type="video/mp4",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'}
    )

@router.post("/api/generate-motion-prompt")
def generate_motion_prompt(request: MotionPromptRequest):
    try:
        scenes = [{
            "sceneId": 1,
            "originalScript": request.originalScript,
            "imagePrompt": request.imagePrompt
        }]
        result = script_service.generate_motion_prompts_from_scenes(scenes)
        if result.get("success"):
            prompts = result.get("prompts", [])
            if prompts:
                return {"success": True, "motionPrompt": prompts[0].get("motionPrompt")}
        return {"success": False, "error": "Failed to generate prompt"}
    except Exception as e:
        logger.error(f"Motion prompt error: {e}")
        return {"success": False, "error": str(e)}

@router.post("/api/generate-motion")
def api_generate_motion(request: MotionGenerationRequest):
    try:
        return motion_service.generate(
            image_url=request.imageUrl,
            prompt=request.motionPrompt,
            duration=request.duration,
            aspect_ratio=request.aspectRatio,
            scene_id=request.sceneId,
            model=request.model
        )
    except Exception as e:
        logger.error(f"Motion generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/generate-video")
async def api_generate_video(background_tasks: BackgroundTasks, request: VideoGenerationRequest):
    try:
        task_id = task_manager.create_task("video_generation")
        
        def process_video_generation(tid: str, req: VideoGenerationRequest):
            try:
                task_manager.update_task(tid, status="processing", progress=10, message="영상 생성 준비 중...")
                
                def callback(progress, message):
                    task_manager.update_task(tid, progress=progress, message=message)
                result = video_service.generate_final_video(
                    merged_groups=[g.dict(by_alias=True) for g in req.merged_groups],
                    standalone=[s.dict(by_alias=True) for s in req.standalone],
                    resolution=req.resolution,
                    progress_callback=callback
                )

                if result.get("success"):
                    task_manager.update_task(tid, status="completed", progress=100, message="영상 생성 완료!", result=result)
                else:
                    task_manager.update_task(tid, status="failed", error=result.get("error", "Unknown error"))
            except Exception as e:
                logger.error(f"Video process error: {e}")
                task_manager.update_task(tid, status="failed", error=str(e))

        background_tasks.add_task(process_video_generation, task_id, request)
        return {"success": True, "taskId": task_id}
    except Exception as e:
        logger.error(f"API video generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/get-task/{task_id}")
def api_get_task(task_id: str):
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="태스크를 찾을 수 없습니다.")
    return task

@router.post("/api/export-vrew")
async def api_export_vrew(request: VideoRequest, background_tasks: BackgroundTasks):
    from services.vrew_service import vrew_service
    try:
        task_id = task_manager.create_task("vrew_export")
        def process_vrew():
            try:
                task_manager.update_task(task_id, status="processing", progress=10, message="Vrew 프로젝트 생성 중...")
                timeline_data = {
                    "mergedGroups": [g.dict(by_alias=True) for g in request.merged_groups],
                    "standalone": [s.dict(by_alias=True) for s in request.standalone]
                }
                vrew_url = vrew_service.generate_vrew_project(timeline_data)
                task_manager.update_task(task_id, status="completed", progress=100, message="Vrew 파일 생성 완료!", result={"vrewUrl": vrew_url})
            except Exception as e:
                task_manager.update_task(task_id, status="failed", error=str(e))
        background_tasks.add_task(process_vrew)
        return {"success": True, "taskId": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/segment-audio")
async def api_segment_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    maxChars: int = Form(30),
    originalScript: Optional[str] = Form(None)
):
    from services.audio_segmentation_service import audio_segmentation_service
    try:
        task_id = task_manager.create_task("audio_segmentation")
        
        # Save uploaded file
        temp_dir = os.path.join(BASE_DIR, "temp")
        os.makedirs(temp_dir, exist_ok=True)
        fpath = os.path.join(temp_dir, f"{uuid.uuid4()}_{file.filename}")
        with open(fpath, "wb") as buffer:
            buffer.write(await file.read())

        def process_segmentation(tid: str, path: str, chars: int, script: Optional[str]):
            try:
                task_manager.update_task(tid, status="processing", progress=10, message="오디오 분석 및 세그멘테이션 중...")
                session, scenes, prompt = audio_segmentation_service.segment_audio(path, max_chars=chars, original_script=script)
                from dataclasses import asdict
                segments_data = []
                for s in scenes:
                    segments_data.append({
                        "index": s.index,
                        "text": s.text,
                        "startTime": s.start_time,
                        "endTime": s.end_time,
                        "audioPath": s.audio_path,
                        "timestampPath": s.timestamp_path,
                        "timestamps": [asdict(ts) for ts in s.timestamps]
                    })
                
                success_result = {
                    "success": True,
                    "sessionFolder": session,
                    "segments": segments_data,
                    "masterCharacterPrompt": prompt
                }
                task_manager.update_task(tid, status="completed", progress=100, message="세그멘테이션 완료!", result=success_result)
            except Exception as e:
                task_manager.update_task(tid, status="failed", error=str(e))
            finally:
                if os.path.exists(path): os.remove(path)

        background_tasks.add_task(process_segmentation, task_id, fpath, maxChars, originalScript)
        return {"success": True, "taskId": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/segment-audio-from-path")
async def api_segment_audio_from_path(background_tasks: BackgroundTasks, request: SegmentAudioFromPathRequest):
    from services.audio_segmentation_service import audio_segmentation_service
    try:
        task_id = task_manager.create_task("audio_segmentation")
        def process_segmentation(tid: str, path: str, chars: int, script: Optional[str]):
            try:
                task_manager.update_task(tid, status="processing", progress=10, message="오디오 분석 중...")
                session, scenes, prompt = audio_segmentation_service.segment_audio(path, max_chars=chars, original_script=script)
                from dataclasses import asdict
                segments_data = []
                for s in scenes:
                    segments_data.append({
                        "index": s.index,
                        "text": s.text,
                        "startTime": s.start_time,
                        "endTime": s.end_time,
                        "audioPath": s.audio_path,
                        "timestampPath": s.timestamp_path,
                        "timestamps": [asdict(ts) for ts in s.timestamps]
                    })
                
                success_result = {
                    "success": True,
                    "sessionFolder": session,
                    "segments": segments_data,
                    "masterCharacterPrompt": prompt
                }
                task_manager.update_task(tid, status="completed", progress=100, result=success_result)
            except Exception as e:
                task_manager.update_task(tid, status="failed", error=str(e))

        background_tasks.add_task(process_segmentation, task_id, request.audioPath, request.maxChars, request.originalScript)
        return {"success": True, "taskId": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/batch-vrew-from-folder")
async def api_batch_vrew_from_folder(request: BatchVrewRequest, background_tasks: BackgroundTasks):
    from services.vrew_service import vrew_service
    try:
        task_id = task_manager.create_task("vrew_batch")
        def process_vrew_batch(tid: str, folder: str, filename: str):
            try:
                task_manager.update_task(tid, status="processing", progress=10, message="Vrew 배치 프로젝트 생성 중...")
                result = vrew_service.create_vrew_from_folder(folder, output_filename=filename)
                if result.get("success"):
                    task_manager.update_task(tid, status="completed", progress=100, result=result)
                else:
                    task_manager.update_task(tid, status="failed", error=result.get("error"))
            except Exception as e:
                task_manager.update_task(tid, status="failed", error=str(e))
        background_tasks.add_task(process_vrew_batch, task_id, request.audioFolder, request.outputFilename)
        return {"success": True, "taskId": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/download-vrew/{project_folder}/{filename}")
async def api_download_vrew(project_folder: str, filename: str):
    """Vrew 프로젝트 파일을 강제로 다운로드하도록 처리"""
    try:
        safe_folder = os.path.basename(project_folder)
        safe_filename = os.path.basename(filename)
        file_path = os.path.join(OUTPUT_DIR, safe_folder, safe_filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        return FastAPIFileResponse(
            path=file_path, 
            filename=safe_filename,
            media_type='application/octet-stream',
            headers={"Content-Disposition": f"attachment; filename={safe_filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/download-vrew-direct/{filename}")
async def api_download_vrew_direct(filename: str):
    """output 폴더 상위의 Vrew ZIP 파일을 직접 다운로드"""
    try:
        safe_filename = os.path.basename(filename)
        file_path = os.path.join(OUTPUT_DIR, safe_filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        return FastAPIFileResponse(
            path=file_path, 
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/upload-asset")
async def api_upload_asset(data: UploadFile = File(...)):
    """로컬 파일을 assets 폴더로 업로드"""
    try:
        os.makedirs(ASSETS_DIR, exist_ok=True)
        filename = os.path.basename(data.filename)
        file_path = os.path.join(ASSETS_DIR, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(data.file, buffer)
            
        return {
            "success": True, 
            "filename": filename,
            "url": f"/assets/{filename}"
        }
    except Exception as e:
        logger.error(f"Asset upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Project Service APIs ---

@router.get("/api/projects")
async def api_list_projects():
    return project_service.list_projects()

@router.get("/api/projects/{project_id}")
async def api_load_project(project_id: str):
    project = project_service.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/api/projects")
async def api_save_project(request: ProjectSaveRequest):
    try:
        return project_service.save_project(request.data)
    except Exception as e:
        logger.error(f"Project save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/projects/{project_id}")
async def api_delete_project(project_id: str):
    success = project_service.delete_project(project_id)
    if not success:
         raise HTTPException(status_code=404, detail="Project not found or failed to delete")
    return {"success": True, "id": project_id}
