import os
import uuid
import shutil
import requests
import base64
import gdown
from datetime import datetime
from dotenv import load_dotenv

# .env 파일 로드 (프로젝트 루트 디렉토리에서)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# --- 설정 및 경로 ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
TEMP_DIR = os.path.join(BASE_DIR, "temp")
ASSETS_DIR = os.path.join(BASE_DIR, "assets")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

def log_debug(msg):
    try:
        with open(os.path.join(BASE_DIR, "debug_download.log"), "a", encoding="utf-8") as f:
            f.write(f"{datetime.now().isoformat()} - {msg}\n")
    except:
        pass

def log_error(msg):
    try:
        with open(os.path.join(BASE_DIR, "error.log"), "a", encoding="utf-8") as f:
            f.write(f"{datetime.now().isoformat()} - {msg}\n")
    except:
        pass

# API Keys (환경 변수에서 로드, 기본값 제거)
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN")

if REPLICATE_API_TOKEN:
    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

# --- 유틸리티 함수 ---

def download_file(url, extension=".mp3"):
    """URL에서 파일을 다운로드하거나 Base64 데이터를 파일로 저장합니다."""
    if not url: return None
    log_debug(f"⬇️ Downloading: {url[:100]}...")
    filename = f"{uuid.uuid4()}{extension}"
    filepath = os.path.join(TEMP_DIR, filename)

    try:
        # Base64 처리
        if url.startswith("data:"):
            if ";base64," in url:
                base64_data = url.split(";base64,")[1]
                with open(filepath, "wb") as f:
                    f.write(base64.b64decode(base64_data))
                return filepath
            else:
                raise Exception("Invalid Base64 format")
        
        # 로컬 에셋 직접 처리 (Self-Request Deadlock 방지)
        if "localhost" in url or "127.0.0.1" in url:
            if "/assets/" in url:
                asset_filename = url.split("/assets/")[1]
                local_asset_path = os.path.join(ASSETS_DIR, asset_filename)
                
                log_debug(f"🔍 DEBUG: URL={url}")
                log_debug(f"🔍 DEBUG: CWD={os.getcwd()}")
                log_debug(f"🔍 DEBUG: ASSETS_DIR={ASSETS_DIR}")
                log_debug(f"🔍 DEBUG: Local Path={local_asset_path}")
                log_debug(f"🔍 DEBUG: Abs Path={os.path.abspath(local_asset_path)}")
                log_debug(f"🔍 DEBUG: Exists?={os.path.exists(local_asset_path)}")

                if os.path.exists(local_asset_path):
                    shutil.copy(local_asset_path, filepath)
                    return filepath
        
        # Google Drive 처리
        is_drive = "drive.google.com" in url or "docs.google.com" in url
        if is_drive:
            output = gdown.download(url, filepath, quiet=True, fuzzy=True)
            if not output:
                raise Exception("gdown download failed")
        else:
            # 일반 URL 처리
            response = requests.get(url, stream=True)
            response.raise_for_status()
            with open(filepath, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
        
        # 유효성 검사
        if os.path.exists(filepath):
            if os.path.getsize(filepath) == 0:
                raise Exception("File is empty")
            # HTML 여부 체크 (에러 페이지 다운로드 방지)
            with open(filepath, "rb") as f:
                head = f.read(100).lower()
                if b"<html" in head or b"<!doctype" in head:
                    raise Exception("Downloaded HTML instead of binary")

        return filepath

    except Exception as e:
        print(f"❌ Download failed: {e}")
        if os.path.exists(filepath):
            try: os.remove(filepath)
            except: pass
        raise e

def cleanup_temp():
    """임시 폴더를 비웁니다."""
    try:
        shutil.rmtree(TEMP_DIR)
        os.makedirs(TEMP_DIR, exist_ok=True)
    except Exception as e:
        print(f"⚠️ Cleanup error: {e}")
