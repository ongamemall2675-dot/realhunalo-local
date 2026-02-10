import os
import sys
import uuid
import threading
import asyncio
from dotenv import load_dotenv
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

# 환경변수 로드 (가장 먼저 실행되어야 함)
# .env 파일 경로를 명시적으로 지정
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

# 로드 확인
print(f"\n{'='*60}")
print(f"[ENV] .env 파일 로드: {env_path}")
print(f"   파일 존재: {env_path.exists()}")
if env_path.exists():
    print(f"   OPENAI_API_KEY: {'설정됨' if os.getenv('OPENAI_API_KEY') else '없음'}")
    print(f"   GEMINI_API_KEY: {'설정됨' if os.getenv('GEMINI_API_KEY') else '없음'}")
    print(f"   ANTHROPIC_API_KEY: {'설정됨' if os.getenv('ANTHROPIC_API_KEY') else '없음'}")
    print(f"   DEEPSEEK_API_KEY: {'설정됨' if os.getenv('DEEPSEEK_API_KEY') else '없음'}")
    print(f"   REPLICATE_API_TOKEN: {'설정됨' if os.getenv('REPLICATE_API_TOKEN') else '없음'}")
print(f"{'='*60}\n")

from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image

# Pillow 10.0+ 호환성 패치
if not hasattr(Image, 'ANTIALIAS'):
    Image.ANTIALIAS = Image.LANCZOS

# 마이크로 서비스 임포트
from services.utils import OUTPUT_DIR, ASSETS_DIR
from services.script_service import script_service
from services.image_service import image_service
from services.motion_service import motion_service
from services.tts_service import tts_service
from services.video_service import video_service
from services.vrew_service_new import vrew_service_new as vrew_service
from services.trend_service import trend_service
from services.youtube_service import youtube_service
from services.ai_service import ai_service
from services.google_drive_service import google_drive_service
from services.project_service import project_service
from services.shorts_service import shorts_service

app = FastAPI(title="RealHunalo Studio Backend")

# ================================================================
# 비동기 작업 관리자 (Task Manager)
# ================================================================

class TaskManager:
    """백그라운드 작업(영상 생성, Vrew 내보내기 등)을 관리하는 클래스"""
    
    def __init__(self):
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()
    
    def create_task(self, task_type: str) -> str:
        """새로운 작업을 생성하고 고유 ID를 반환합니다."""
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
                "created_at": datetime.now().isoformat()
            }
        return task_id
    
    def update_task(self, task_id: str, status: str = None, progress: int = None, 
                   message: str = None, result: Any = None, error: str = None):
        """작업 상태를 업데이트합니다."""
        with self.lock:
            if task_id not in self.tasks:
                return
            
            task = self.tasks[task_id]
            if status: task["status"] = status
            if progress is not None: task["progress"] = progress
            if message: task["message"] = message
            if result: task["result"] = result
            if error: task["error"] = error
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """작업 정보를 조회합니다."""
        with self.lock:
            return self.tasks.get(task_id)
    
    def cleanup_old_tasks(self, max_age_hours: int = 24):
        """오래된 작업을 정리합니다 (현재는 메모리 기반이므로 선택적)."""
        # TODO: 필요시 구현
        pass

# 전역 TaskManager 인스턴스
task_manager = TaskManager()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 마운트
app.mount("/output", StaticFiles(directory=OUTPUT_DIR), name="output")
app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# --- Pydantic 모델 (Request/Response) ---

class Scene(BaseModel):
    startTime: Optional[float] = 0.0
    endTime: Optional[float] = 0.0
    duration: Optional[float] = 5.0
    visualUrl: Optional[str] = None
    audioUrl: Optional[str] = None
    script: Optional[str] = None

class MergedGroup(BaseModel):
    mergedAudio: str
    totalDuration: float
    scenes: List[Scene]

class VideoRequest(BaseModel):
    mergedGroups: List[MergedGroup] = []
    standalone: List[Scene] = []
    subtitleStyle: Optional[dict] = None

class TTSSettings(BaseModel):
    engine: Optional[str] = "elevenlabs"
    voiceId: Optional[str] = "nPczCjzI2devNBz1zQrb"
    stability: Optional[float] = 0.5
    similarity: Optional[float] = 0.75
    speed: Optional[float] = 1.0

class TTSRequest(BaseModel):
    text: str
    sceneId: Optional[Union[str, int]] = "unknown"
    settings: Optional[TTSSettings] = TTSSettings()

class ImageSettings(BaseModel):
    model: Optional[str] = "black-forest-labs/flux-schnell"
    aspectRatio: Optional[str] = "16:9"
    numOutputs: Optional[int] = 1

class ImageRequest(BaseModel):
    prompt: str
    settings: Optional[ImageSettings] = ImageSettings()

class ScriptSettings(BaseModel):
    model: Optional[str] = "gpt-4o-mini"
    temperature: Optional[float] = 0.7

class ScriptRequest(BaseModel):
    topic: str
    style: Optional[str] = "engaging"
    imageStyle: Optional[str] = "none"  # 이미지 화풍
    settings: Optional[ScriptSettings] = ScriptSettings()

class StyleChangeRequest(BaseModel):
    scenes: List[dict]
    newStyle: str

class MotionRequest(BaseModel):
    sceneId: Union[str, int]
    imageUrl: str
    motionPrompt: Optional[str] = "Slow cinematic camera movement"
    duration: Optional[int] = 5
    aspectRatio: Optional[str] = "16:9"
    model: Optional[str] = None

class AIModelTestRequest(BaseModel):
    model: str
    apiKey: str

class AIRecommendRequest(BaseModel):
    baseKeyword: str
    model: Optional[str] = "openai"

class YouTubeChannelRequest(BaseModel):
    channelId: str

class YouTubeKeywordRequest(BaseModel):
    keyword: str
    maxResults: Optional[int] = 10
    sortBy: Optional[str] = "relevance"

class YouTubeNicheRequest(BaseModel):
    topic: str
    model: Optional[str] = "openai"

class MetadataRequest(BaseModel):
    script: str

class ThumbnailPromptsRequest(BaseModel):
    script: str

class ThumbnailImageRequest(BaseModel):
    prompt: str
    aspectRatio: Optional[str] = "16:9"

# --- Service Status & Settings ---

class VideoSettingsRequest(BaseModel):
    resolution: Optional[str] = None
    fps: Optional[int] = None
    preset: Optional[str] = None
    bitrate: Optional[str] = None

class SubtitleStyle(BaseModel):
    enabled: bool = True
    fontFamily: str = "Pretendard-Vrew_700"
    fontSize: int = 100
    fontColor: str = "#ffffff"
    outlineEnabled: bool = True
    outlineColor: str = "#000000"
    outlineWidth: int = 6
    position: str = "bottom"  # bottom, top, center
    yOffset: int = 0
    backgroundColor: str = "rgba(0, 0, 0, 0)"
    alignment: str = "center"  # left, center, right

class ShortsAnalysisRequest(BaseModel):
    fullScript: str
    scenes: List[dict]

class ShortCreationRequest(BaseModel):
    scenes: List[dict]
    startSceneId: int
    endSceneId: int
    title: str

# --- API 엔드포인트 (Routing to Services) ---

@app.post("/api/generate-script")
async def api_generate_script(request: ScriptRequest):
    try:
        return script_service.generate(
            topic=request.topic,
            style=request.style,
            image_style=request.imageStyle,  # 이미지 화풍 전달
            model=request.settings.model,
            temperature=request.settings.temperature
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/regenerate-prompts-with-style")
async def api_regenerate_prompts_with_style(request: StyleChangeRequest):
    """기존 씬들의 이미지 프롬프트를 새로운 스타일로 재생성"""
    try:
        return script_service.regenerate_prompts_with_style(
            scenes=request.scenes,
            new_style=request.newStyle
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-image")
async def api_generate_image(request: ImageRequest):
    """이미지 생성 (최대 3회 재시도)"""
    max_retries = 3
    last_error = None

    for attempt in range(max_retries):
        try:
            print(f"[IMAGE] 이미지 생성 시도 {attempt + 1}/{max_retries}")
            result = image_service.generate(
                prompt=request.prompt,
                model=request.settings.model,
                aspect_ratio=request.settings.aspectRatio,
                num_outputs=request.settings.numOutputs
            )

            # 성공하면 즉시 반환
            if result and result.get("success"):
                if attempt > 0:
                    print(f"[OK] 이미지 생성 성공 (재시도 {attempt}회 후)")
                return result
            else:
                last_error = result.get("error", "알 수 없는 오류") if result else "응답 없음"
                print(f"[WARN] 이미지 생성 실패 (시도 {attempt + 1}): {last_error}")

        except Exception as e:
            last_error = str(e)
            print(f"[ERROR] 이미지 생성 예외 (시도 {attempt + 1}): {last_error}")

        # 마지막 시도가 아니면 1초 대기 후 재시도
        if attempt < max_retries - 1:
            await asyncio.sleep(1)

    # 모든 재시도 실패
    print(f"[ERROR] 이미지 생성 최종 실패 ({max_retries}회 시도)")
    raise HTTPException(
        status_code=500,
        detail=f"이미지 생성 실패 ({max_retries}회 재시도): {last_error}"
    )

@app.post("/api/generate-motion")
async def api_generate_motion(request: MotionRequest):
    try:
        return motion_service.generate(
            image_url=request.imageUrl,
            prompt=request.motionPrompt,
            duration=request.duration,
            aspect_ratio=request.aspectRatio,
            scene_id=request.sceneId,
            model=request.model if hasattr(request, 'model') else None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-tts")
async def api_generate_tts(request: TTSRequest):
    """TTS 생성 (최대 3회 재시도)"""
    # TTS 서비스 사용 가능 여부 확인
    if tts_service is None:
        raise HTTPException(
            status_code=503,
            detail="TTS 서비스를 사용할 수 없습니다. Azure 또는 ElevenLabs API 키를 환경변수에 설정하세요."
        )

    max_retries = 3
    last_error = None

    for attempt in range(max_retries):
        try:
            print(f"[TTS] TTS 생성 시도 {attempt + 1}/{max_retries}")
            result = tts_service.generate(
                text=request.text,
                voice_id=request.settings.voiceId,
                language="ko-KR",  # 한국어 기본값
                stability=request.settings.stability,
                similarity=request.settings.similarity,
                speed=request.settings.speed,
                engine=request.settings.engine,
                scene_id=request.sceneId
            )

            # 결과 검증
            if result and result.get("success"):
                if attempt > 0:
                    print(f"[OK] TTS 생성 성공 (재시도 {attempt}회 후)")
                return result
            else:
                last_error = result.get("error", "알 수 없는 오류") if result else "TTS 서비스 응답 없음"
                print(f"[WARN] TTS 생성 실패 (시도 {attempt + 1}): {last_error}")

        except HTTPException:
            raise
        except Exception as e:
            last_error = str(e)
            print(f"[ERROR] TTS 생성 예외 (시도 {attempt + 1}): {last_error}")

        # 마지막 시도가 아니면 1초 대기 후 재시도
        if attempt < max_retries - 1:
            await asyncio.sleep(1)

    # 모든 재시도 실패
    print(f"[ERROR] TTS 생성 최종 실패 ({max_retries}회 시도)")
    raise HTTPException(
        status_code=500,
        detail=f"TTS 생성 실패 ({max_retries}회 재시도): {last_error}"
    )

@app.get("/api/tts/voices")
async def api_get_tts_voices(engine: Optional[str] = "elevenlabs"):
    """사용 가능한 성우 목록 조회"""
    try:
        if not tts_service:
            raise HTTPException(status_code=503, detail="TTS 서비스를 사용할 수 없습니다.")
        
        # 엔진 인스턴스 가져오기
        engine_instance = tts_service.engines.get(engine)
        if not engine_instance:
            return {"success": False, "error": f"엔진 '{engine}'을 찾을 수 없습니다."}
        
        # 음성 목록 반환
        voices = []
        if engine == "azure" and hasattr(engine_instance, 'get_voices_list'):
            voices = engine_instance.get_voices_list()
        elif engine == "elevenlabs":
            # ElevenLabs는 현재 프론트엔드에 하드코딩되어 있거나
            # 필요시 API 호출로 가져올 수 있음. 여기서는 기본값 처리.
            pass
            
        return {"success": True, "voices": voices}
    except Exception as e:
        print(f"[ERROR] TTS Voices 에러: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-video")
async def api_generate_video(request: VideoRequest, background_tasks: BackgroundTasks):
    """비동기 영상 생성 - 즉시 taskId를 반환하고 백그라운드에서 처리합니다."""
    try:
        # 작업 생성
        task_id = task_manager.create_task("video_generation")
        
        # 백그라운드 작업 등록
        def process_video():
            try:
                task_manager.update_task(task_id, status="processing", progress=0, message="영상 생성 준비 중...")
                
                # 진행률 업데이트 콜백
                def on_progress(progress: int, message: str):
                    task_manager.update_task(task_id, progress=progress, message=message)
                
                # 영상 생성
                video_url = video_service.generate_final_video(
                    merged_groups=[g.dict() for g in request.mergedGroups],
                    standalone=[s.dict() for s in request.standalone],
                    subtitle_style=request.subtitleStyle,
                    progress_callback=on_progress
                )
                
                task_manager.update_task(
                    task_id, 
                    status="completed", 
                    progress=100, 
                    message="영상 생성 완료!",
                    result={"videoUrl": video_url}
                )
                
            except Exception as e:
                task_manager.update_task(
                    task_id,
                    status="failed",
                    error=str(e)
                )
        
        background_tasks.add_task(process_video)
        
        return {"success": True, "taskId": task_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/export-vrew")
async def api_export_vrew(request: VideoRequest, background_tasks: BackgroundTasks):
    """Vrew 프로젝트 파일 내보내기 - 비동기 처리"""
    try:
        # 작업 생성
        task_id = task_manager.create_task("vrew_export")
        
        # 백그라운드 작업 등록
        def process_vrew():
            try:
                task_manager.update_task(task_id, status="processing", progress=0, message="Vrew 프로젝트 생성 중...")
                
                # Vrew 파일 생성
                timeline_data = {
                    "mergedGroups": [g.dict() for g in request.mergedGroups],
                    "standalone": [s.dict() for s in request.standalone]
                }
                
                task_manager.update_task(task_id, progress=30, message="에셋 수집 중...")
                vrew_url = vrew_service.generate_vrew_project(timeline_data, request.subtitleStyle)
                
                task_manager.update_task(
                    task_id,
                    status="completed",
                    progress=100,
                    message="Vrew 파일 생성 완료!",
                    result={"vrewUrl": vrew_url}
                )
                
            except Exception as e:
                task_manager.update_task(
                    task_id,
                    status="failed",
                    error=str(e)
                )
        
        background_tasks.add_task(process_vrew)
        
        return {"success": True, "taskId": task_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/import-vrew")
async def api_import_vrew(file: UploadFile = File(...)):
    """Vrew 프로젝트 파일 가져오기"""
    try:
        # .vrew 파일인지 확인
        if not file.filename.endswith('.vrew'):
            raise HTTPException(status_code=400, detail="VREW 파일(.vrew)만 업로드 가능합니다.")

        # 파일 저장
        content = await file.read()
        temp_filename = f"import_{uuid.uuid4()}_{file.filename}"
        temp_filepath = os.path.join(OUTPUT_DIR, temp_filename)

        with open(temp_filepath, "wb") as f:
            f.write(content)

        # VREW 파일 파싱
        timeline_data = vrew_service.import_vrew_project(temp_filepath)

        # 임시 파일 삭제
        try:
            os.remove(temp_filepath)
        except:
            pass

        return {
            "success": True,
            "data": timeline_data,
            "message": f"{len(timeline_data.get('standalone', []))}개 씬을 가져왔습니다."
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload-asset")
async def api_upload_asset(data: UploadFile = File(...)):
    try:
        content = await data.read()
        filename = f"upload_{uuid.uuid4()}_{data.filename}"
        filepath = os.path.join(ASSETS_DIR, filename)
        
        with open(filepath, "wb") as f:
            f.write(content)
            
        url = f"http://localhost:8000/assets/{filename}"
        return {"success": True, "url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TrendRequest(BaseModel):
    keyword: str

@app.post("/api/analyze-trend")
async def api_analyze_trend(request: TrendRequest):
    """네이버와 구글 트렌드를 동시에 가져와 비교 데이터 반환"""
    try:
        # 두 소스 모두에서 데이터 가져오기
        naver_data = trend_service.analyze_naver(request.keyword)
        google_data = trend_service.analyze_google(request.keyword)
        
        # 에러 체크
        naver_error = naver_data.get("error")
        google_error = google_data.get("error")
        
        # 둘 다 실패한 경우
        if naver_error and google_error:
            return {
                "error": f"Naver: {naver_error}, Google: {google_error}"
            }
        
        # 성공한 데이터 반환 (하나라도 성공하면 OK)
        return {
            "keyword": request.keyword,
            "naver": naver_data if not naver_error else None,
            "google": google_data if not google_error else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# AI Service API
# ================================================================

class SaveAPIKeyRequest(BaseModel):
    key: str  # Model key (e.g., 'gemini', 'openai', 'anthropic')
    type: str  # Type: 'ai', 'youtube', 'tts', etc.
    apiKey: str

@app.post("/api/save-api-key")
async def save_api_key(request: SaveAPIKeyRequest):
    """API 키를 .env 파일에 저장"""
    try:
        # API 키 타입별 환경변수 이름 매핑
        key_mapping = {
            'gemini': 'GEMINI_API_KEY',
            'openai': 'OPENAI_API_KEY',
            'anthropic': 'ANTHROPIC_API_KEY',
            'deepseek': 'DEEPSEEK_API_KEY',
            'perplexity': 'PERPLEXITY_API_KEY'
        }

        env_var_name = key_mapping.get(request.key)
        if not env_var_name:
            return {"success": False, "error": f"알 수 없는 키 타입: {request.key}"}

        # .env 파일 경로
        env_file = '.env'

        # 기존 .env 파일 읽기
        env_lines = []
        if os.path.exists(env_file):
            with open(env_file, 'r', encoding='utf-8') as f:
                env_lines = f.readlines()

        # 해당 키가 이미 있는지 확인하고 업데이트
        key_found = False
        for i, line in enumerate(env_lines):
            if line.startswith(f'{env_var_name}='):
                env_lines[i] = f'{env_var_name}={request.apiKey}\n'
                key_found = True
                break

        # 키가 없으면 추가
        if not key_found:
            env_lines.append(f'{env_var_name}={request.apiKey}\n')

        # .env 파일에 쓰기
        with open(env_file, 'w', encoding='utf-8') as f:
            f.writelines(env_lines)

        # 환경변수 업데이트 (현재 세션)
        os.environ[env_var_name] = request.apiKey

        print(f"[OK] API 키 저장됨: {env_var_name}")
        return {"success": True, "message": f"{env_var_name} 저장 완료"}

    except Exception as e:
        print(f"[X] API 키 저장 실패: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/check-saved-keys")
async def check_saved_keys():
    """저장된 API 키 확인"""
    try:
        key_mapping = {
            'gemini': 'GEMINI_API_KEY',
            'openai': 'OPENAI_API_KEY',
            'anthropic': 'ANTHROPIC_API_KEY',
            'deepseek': 'DEEPSEEK_API_KEY',
            'perplexity': 'PERPLEXITY_API_KEY'
        }

        saved_keys = {}
        for key, env_var in key_mapping.items():
            saved_keys[key] = bool(os.getenv(env_var))

        return {"success": True, "savedKeys": saved_keys}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/test-ai-model")
async def api_test_ai_model(request: AIModelTestRequest):
    """AI 모델 API 키 테스트"""
    try:
        result = ai_service.test_model(request.model, request.apiKey)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai-recommend-keywords")
async def api_ai_recommend_keywords(request: AIRecommendRequest):
    """AI 기반 트렌드 키워드 추천"""
    try:
        result = ai_service.recommend_keywords(request.baseKeyword, request.model)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-metadata")
async def api_generate_metadata(request: MetadataRequest):
    """YouTube 메타데이터 생성 (제목 5개, 설명, 태그)"""
    try:
        print(f"\n{'='*60}")
        print(f"[META] 메타데이터 생성 요청 받음")
        print(f"{'='*60}")
        print(f"스크립트 길이: {len(request.script)} 글자")

        result = ai_service.generate_metadata(request.script)

        print(f"[OK] 메타데이터 생성 결과: success={result.get('success')}")
        if result.get('success'):
            print(f"   - 제목: {len(result.get('titles', []))}개")
            print(f"   - 설명 길이: {len(result.get('description', ''))} 글자")
            print(f"   - 태그: {len(result.get('tags', []))}개")
        else:
            print(f"   - 에러: {result.get('error')}")
        print(f"{'='*60}\n")

        return result
    except Exception as e:
        print(f"[ERROR] 메타데이터 생성 예외: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-thumbnail-prompts")
async def api_generate_thumbnail_prompts(request: ThumbnailPromptsRequest):
    """YouTube 썸네일 프롬프트 생성 (4개, 다양한 스타일)"""
    try:
        print(f"\n{'='*60}")
        print(f"[THUMB] 썸네일 프롬프트 생성 요청 받음")
        print(f"{'='*60}")
        print(f"스크립트 길이: {len(request.script)} 글자")

        result = ai_service.generate_thumbnail_prompts(request.script)

        print(f"[OK] 썸네일 프롬프트 생성 결과: success={result.get('success')}")
        if result.get('success'):
            print(f"   - 프롬프트: {len(result.get('prompts', []))}개")
        else:
            print(f"   - 에러: {result.get('error')}")
        print(f"{'='*60}\n")

        return result
    except Exception as e:
        print(f"[ERROR] 썸네일 프롬프트 생성 예외: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-thumbnail-image")
async def api_generate_thumbnail_image(request: ThumbnailImageRequest):
    """썸네일 이미지 생성"""
    try:
        result = image_service.generate(
            prompt=request.prompt,
            aspect_ratio=request.aspectRatio
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# Service Status / Settings / Tasks
# ================================================================

@app.get("/api/tts/status")
async def api_tts_status():
    """TTS ?쒕퉬???곹깭"""
    if not tts_service:
        return {"available": False, "error": "TTS service unavailable"}
    status = tts_service.get_status()
    status["available"] = True
    return status

@app.post("/api/tts/validate")
async def api_tts_validate():
    """TTS API ???좏슚??寃利?"""
    if not tts_service:
        return {"success": False, "error": "TTS service unavailable"}
    return tts_service.validate_api_keys()

@app.get("/api/tts/voices")
async def api_tts_voices(engine: str = "azure"):
    """
    TTS 엔진별 사용 가능한 음성 목록 반환

    Args:
        engine: TTS 엔진 이름 (azure, elevenlabs)

    Returns:
        음성 목록 및 메타데이터
    """
    try:
        if not tts_service:
            return {"success": False, "error": "TTS service unavailable"}

        # Azure 엔진의 경우
        if engine == "azure":
            from services.tts_azure import azure_tts_engine
            if azure_tts_engine:
                voices = azure_tts_engine.get_voices_list()
                return {
                    "success": True,
                    "engine": "azure",
                    "voices": voices,
                    "total": len(voices)
                }
            else:
                return {"success": False, "error": "Azure TTS engine not available"}

        # ElevenLabs 엔진의 경우
        elif engine == "elevenlabs":
            # ElevenLabs는 기존 방식 유지
            return {
                "success": True,
                "engine": "elevenlabs",
                "voices": [],  # ElevenLabs는 별도 처리
                "message": "ElevenLabs voices are managed separately"
            }

        else:
            return {"success": False, "error": f"Unknown engine: {engine}"}

    except Exception as e:
        print(f"[ERROR] TTS voices API 에러: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@app.get("/api/motion/status")
async def api_motion_status():
    """Motion ?쒕퉬???곹깭"""
    return motion_service.get_status()

@app.get("/api/video/status")
async def api_video_status():
    """Video ?쒕퉬???곹깭"""
    status = video_service.get_status()
    status["settings"] = video_service.get_settings()
    return status

@app.get("/api/ai/status")
async def api_ai_status():
    """AI 서비스 상태 (API 키 확인)"""
    available_keys = {}
    for model_name, key in ai_service.api_keys.items():
        available_keys[model_name] = bool(key)

    return {
        "available": any(available_keys.values()),
        "keys": available_keys,
        "message": "API 키 상태" if any(available_keys.values()) else "사용 가능한 AI API 키가 없습니다."
    }

@app.get("/api/video/settings")
async def api_video_get_settings():
    """Video ?ㅼ젙 議고쉶"""
    return video_service.get_settings()

@app.post("/api/video/settings")
async def api_video_update_settings(request: VideoSettingsRequest):
    """Video ?ㅼ젙 ?낅뜲?댄듃"""
    return video_service.update_settings(
        resolution=request.resolution,
        fps=request.fps,
        preset=request.preset,
        bitrate=request.bitrate
    )

@app.get("/api/tasks/{task_id}")
async def api_get_task(task_id: str):
    """鍮꾨룞湲??묒뾽 ?곹깭 議고쉶"""
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

# ================================================================
# YouTube Service API
# ================================================================

class SaveYouTubeKeyRequest(BaseModel):
    apiKey: str

@app.post("/api/save-youtube-key")
async def save_youtube_key(request: SaveYouTubeKeyRequest):
    """YouTube API 키 저장"""
    try:
        env_file = '.env'
        env_lines = []
        if os.path.exists(env_file):
            with open(env_file, 'r', encoding='utf-8') as f:
                env_lines = f.readlines()

        key_found = False
        for i, line in enumerate(env_lines):
            if line.startswith('YOUTUBE_API_KEY='):
                env_lines[i] = f'YOUTUBE_API_KEY={request.apiKey}\n'
                key_found = True
                break

        if not key_found:
            env_lines.append(f'YOUTUBE_API_KEY={request.apiKey}\n')

        with open(env_file, 'w', encoding='utf-8') as f:
            f.writelines(env_lines)

        os.environ['YOUTUBE_API_KEY'] = request.apiKey
        print("[OK] YouTube API 키 저장됨")
        return {"success": True, "message": "YouTube API 키 저장 완료"}

    except Exception as e:
        print(f"[X] YouTube API 키 저장 실패: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/youtube/analyze-channel")
async def api_youtube_analyze_channel(request: YouTubeChannelRequest):
    """YouTube 채널 분석"""
    try:
        if not youtube_service:
            raise HTTPException(status_code=503, detail="YouTube 서비스를 사용할 수 없습니다. API 키를 확인하세요.")

        result = youtube_service.analyze_channel(request.channelId)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/youtube/search-keyword")
async def api_youtube_search_keyword(request: YouTubeKeywordRequest):
    """YouTube 키워드 검색"""
    try:
        if not youtube_service:
            raise HTTPException(status_code=503, detail="YouTube 서비스를 사용할 수 없습니다. API 키를 확인하세요.")

        result = youtube_service.search_by_keyword(
            keyword=request.keyword,
            max_results=request.maxResults,
            sort_by=request.sortBy
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/youtube/discover-niche")
async def api_youtube_discover_niche(request: YouTubeNicheRequest):
    """YouTube 틈새 키워드 발굴 (AI 추천)"""
    try:
        if not ai_service:
            raise HTTPException(status_code=503, detail="AI 서비스를 사용할 수 없습니다.")

        result = ai_service.discover_niche(request.topic, request.model)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# Google Drive Service API
# ================================================================

class GoogleDriveUploadRequest(BaseModel):
    filePath: str
    filename: Optional[str] = None

@app.get("/api/google-drive/status")
async def get_google_drive_status():
    """Google Drive 인증 상태 조회"""
    try:
        return google_drive_service.get_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/google-drive/auth-url")
async def get_google_drive_auth_url():
    """Google Drive OAuth 인증 URL 생성"""
    try:
        result = google_drive_service.get_authorization_url()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/google-drive/callback")
async def google_drive_oauth_callback(code: str):
    """Google Drive OAuth 콜백 처리"""
    try:
        result = google_drive_service.handle_oauth_callback(code)
        if result.get("success"):
            # 성공 시 메인 페이지로 리다이렉트
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url="/?drive_auth=success")
        else:
            return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/google-drive/upload")
async def upload_to_google_drive(request: GoogleDriveUploadRequest):
    """파일을 Google Drive에 업로드"""
    try:
        if not google_drive_service.is_authenticated():
            raise HTTPException(status_code=401, detail="Google Drive 인증이 필요합니다.")

        result = google_drive_service.upload_file(request.filePath, request.filename)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# Project Service API
# ================================================================

class ProjectSaveRequest(BaseModel):
    data: Dict[str, Any]

@app.get("/api/projects")
async def api_list_projects():
    """프로젝트 목록 조회"""
    return project_service.list_projects()

@app.get("/api/projects/{project_id}")
async def api_load_project(project_id: str):
    """프로젝트 상세 조회 (불러오기)"""
    project = project_service.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.post("/api/projects")
async def api_save_project(request: ProjectSaveRequest):
    """프로젝트 저장 (생성/수정)"""
    try:
        return project_service.save_project(request.data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/projects/{project_id}")
async def api_delete_project(project_id: str):
    """프로젝트 삭제"""
    success = project_service.delete_project(project_id)
    if not success:
         raise HTTPException(status_code=404, detail="Project not found or failed to delete")
    return {"success": True, "id": project_id}

# === Shorts 관련 API ===

@app.post("/api/analyze-shorts")
async def api_analyze_shorts(request: ShortsAnalysisRequest):
    """스크립트를 분석하여 Shorts 후보 5개 추천"""
    try:
        return shorts_service.analyze_script_for_shorts(
            full_script=request.fullScript,
            scenes=request.scenes
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/create-short")
async def api_create_short(request: ShortCreationRequest):
    """선택한 구간으로 Shorts용 씬 추출"""
    try:
        extracted_scenes = shorts_service.extract_short_scenes(
            scenes=request.scenes,
            start_scene_id=request.startSceneId,
            end_scene_id=request.endSceneId
        )

        return {
            "success": True,
            "title": request.title,
            "scenes": extracted_scenes,
            "sceneCount": len(extracted_scenes)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def read_root():
    return FileResponse('index.html')

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend:app", host="0.0.0.0", port=8000, reload=True)
