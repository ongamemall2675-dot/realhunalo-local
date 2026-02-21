from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from typing import List
import os
import shutil
import uuid
from services.vrew_autofill_service import vrew_autofill_service
from services.utils import OUTPUT_DIR
import urllib.parse

router = APIRouter(prefix="/api/vrew", tags=["Vrew Autofill"])

@router.post("/autofill")
async def autofill_vrew(
    vrew_file: UploadFile = File(..., description="Vrew 프로젝트 원본 파일 (.vrew)"),
    media_files: List[UploadFile] = File(..., description="배치할 미디어 파일 목록 (001_xxx.jpg 등)")
):
    """
    [API Endpoint] Vrew 자동 채우기
    - 클라이언트로부터 .vrew 원본 파일과 삽입할 에셋(이미지/영상)들을 Multipart로 받아 처리합니다.
    - 처리 후 생성된 새로운 .vrew(ZIP 아카이브) 파일을 FileResponse로 반환하여 즉시 다운로드 되게 합니다.
    """
    try:
        # 1. 파일 저장용 고유 임시 디렉토리 생성 (충돌 방지)
        task_id = str(uuid.uuid4())
        upload_dir = os.path.join(OUTPUT_DIR, "vrew_uploads", task_id)
        os.makedirs(upload_dir, exist_ok=True)
        
        # 2. Vrew 원본 파일 로컬 저장
        if not vrew_file.filename.endswith('.vrew'):
            vrew_file.filename = f"{vrew_file.filename}.vrew"
            
        vrew_path = os.path.join(upload_dir, "project.vrew")
        with open(vrew_path, "wb") as buffer:
            shutil.copyfileobj(vrew_file.file, buffer)
            
        # 3. 미디어 파일들 로컬 저장
        media_paths = []
        for mf in media_files:
            if not mf.filename:
                continue
            # 파일명에 공백 등이 있을 떄를 대비한 안전한 이름 처리 (여기서는 원본 유지가 중요하므로 원본 이름 사용하되 경로 병합)
            safe_name = mf.filename
            mp = os.path.join(upload_dir, safe_name)
            with open(mp, "wb") as buffer:
                shutil.copyfileobj(mf.file, buffer)
            media_paths.append(mp)
            
        if not media_paths:
            raise HTTPException(status_code=400, detail="유효한 미디어 파일이 업로드되지 않았습니다.")
            
        # 4. 서비스 레이어(조합 엔진) 호출
        output_vrew_path = vrew_autofill_service.process_autofill(vrew_path, media_paths)
        
        # 파일 이름 (예: final_vrew.vrew)
        output_filename = os.path.basename(output_vrew_path)
        
        # 5. 완성된 파일을 클라이언트에 전송 (브라우저 다운로드 유도)
        return FileResponse(
            output_vrew_path,
            media_type="application/zip",
            filename=f"autofilled_{vrew_file.filename}"
        )
        
    except HTTPException as he:
        # 이미 우리가 예측해서 던진 에러는 그대로 반환합니다.
        raise he
    except Exception as e:
        # 예측하지 못한 런타임 에러(JSON 파싱 실패 등)에 대한 처리
        print(f"[ERROR] Vrew Autofill Endpoint Router: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
