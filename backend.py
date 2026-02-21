import os
import sys
import uuid
import threading
import asyncio
import shutil
import json
import re
import requests
from dotenv import load_dotenv
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
from datetime import datetime

# Windows 콘솔 인코딩 문제 해결 (cp949 -> utf-8)
def _configure_console_streams() -> None:
    import io
    if hasattr(sys.stdout, "reconfigure"):
        try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        except Exception: pass
    elif sys.stdout and not hasattr(sys.stdout, "encoding"):
        if hasattr(sys.stdout, "buffer"):
             sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, "reconfigure"):
        try: sys.stderr.reconfigure(encoding='utf-8', errors='replace')
        except Exception: pass
    elif sys.stderr and not hasattr(sys.stderr, "encoding"):
        if hasattr(sys.stderr, "buffer"):
             sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

_configure_console_streams()

# 환경변수 로드
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image

# Pillow 10.0+ 호환성 패치
if not hasattr(Image, 'ANTIALIAS'):
    Image.ANTIALIAS = Image.LANCZOS

from services.utils import OUTPUT_DIR, ASSETS_DIR, BASE_DIR
from services.task_service import task_manager

# 라우터 임포트
from routers import shorts_router, tts_router, youtube_router, optimization_router
from routers import image_router, script_router, video_router, task_router, vrew_router

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    _configure_console_streams()
    print("\n" + "="*60)
    print("[OK] RealHunalo Backend Modularized Started")
    print("[OK] All routers (Image, Script, Video, TTS, Shorts, YouTube) registered")
    print("="*60 + "\n")
    yield

app = FastAPI(title="RealHunalo Studio Backend", lifespan=lifespan)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(shorts_router.router)
app.include_router(tts_router.router)
app.include_router(youtube_router.router)
app.include_router(optimization_router.router)
app.include_router(image_router.router)
app.include_router(script_router.router)
app.include_router(video_router.router)
app.include_router(task_router.router)
app.include_router(vrew_router.router)

# 정적 파일 마운트
app.mount("/output", StaticFiles(directory=OUTPUT_DIR), name="output")
app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# --- Common/Util Endpoints ---

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    icon_path = os.path.join(ASSETS_DIR, "placeholder.png")
    if os.path.exists(icon_path):
        return FileResponse(icon_path, media_type="image/png")
    raise HTTPException(status_code=404, detail="favicon not found")

@app.get("/api/check-saved-keys")
async def check_saved_keys():
    try:
        key_mapping = {
            'gemini': 'GEMINI_API_KEY',
            'openai': 'OPENAI_API_KEY',
            'anthropic': 'ANTHROPIC_API_KEY',
            'deepseek': 'DEEPSEEK_API_KEY',
            'perplexity': 'PERPLEXITY_API_KEY'
        }
        saved_keys = {key: bool(os.getenv(env_var)) for key, env_var in key_mapping.items()}
        return {"success": True, "savedKeys": saved_keys}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/debug-tasks")
def api_debug_tasks():
    return task_manager.tasks

@app.get("/")
async def read_index():
    return FileResponse('index.html')

if __name__ == "__main__":
    import uvicorn
    # Timeout increased to 20 minutes for long processes
    uvicorn.run("backend:app", host="0.0.0.0", port=8000, reload=False, timeout_keep_alive=1200)