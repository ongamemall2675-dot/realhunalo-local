import os
import json
import uuid
import zipfile
import shutil
import cv2  # 비디오 메타데이터 추출용
from pathlib import Path
from typing import List
from services.utils import OUTPUT_DIR

class VrewAutoFillService:
    """
    VrewAutoFillService
    - 역할: 대본 텍스트만 구성된 Vrew 프로젝트 파일(.vrew)을 파싱하여, 숫자로 네이밍된 외부 미디어 파일들을
            알맞은 클립 위치에 자동으로 삽입(배치)합니다.
    - 배경: 시니어 작업자가 매번 에셋을 클립마다 수동으로 드래그 앤 드롭하는 물리적/시간적 리소스를 
            최소화하기 위해 도입된 '자동화 공장' 역할의 서비스입니다.
    """
    def __init__(self):
        # 최종 결과물을 저장할 출력 폴더 (서버 내 로컬 스토리지) 지정
        self.output_dir = os.path.join(OUTPUT_DIR, "vrew_autofill")
        os.makedirs(self.output_dir, exist_ok=True)
        
    def _extract_video_metadata(self, file_path: str):
        """
        OpenCV를 사용하여 비디오 파일의 해상도, 프레임 레이트, 재생 시간을 추출합니다.
        """
        try:
            cap = cv2.VideoCapture(file_path)
            if not cap.isOpened():
                return None
                
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            duration = 0.0
            if fps > 0:
                duration = frame_count / fps
                
            cap.release()
            
            return {
                "width": width,
                "height": height,
                "fps": round(fps, 2),
                "duration": round(duration, 2)
            }
        except Exception as e:
            print(f"[VrewAutoFill] 메타데이터 추출 실패 ({file_path}): {e}")
            return None
        
    def process_autofill(self, vrew_file_path: str, media_file_paths: List[str]) -> str:
        """
        [핵심 로직] 원본 Vrew 해체 -> JSON 조작(미디어 매핑) -> Vrew 로 다시 포장
        
        오류에 대비하기 위해(Defensive Coding), 임시 폴더를 생성해 격리된 환경에서 안전하게 
        zip을 압축 해제하고 JSON을 다룹니다.
        """
        task_id = str(uuid.uuid4())
        temp_dir = os.path.join(self.output_dir, f"temp_{task_id}")
        os.makedirs(temp_dir, exist_ok=True)
        
        try:
            # 1. 압축 해제 (Vrew 파일은 사실상 ZIP 파일)
            with zipfile.ZipFile(vrew_file_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
                
            json_path = os.path.join(temp_dir, 'project.json')
            if not os.path.exists(json_path):
                raise Exception("유효한 Vrew 프로젝트 파일이 아닙니다. (project.json 없음)")
                
            with open(json_path, 'r', encoding='utf-8') as f:
                project = json.load(f)
                
            # 2. 클립(Scene) 데이터 구조 추출
            # 여러 개의 씬이 있을 수 있으나, Vrew 특화 스크립트 특성상 보통 1개의 씬(Scene 0)에 
            # 여러 개의 클립(Clips)이 배치되므로 첫 번째 씬의 클립 리스트를 확보합니다.
            try:
                clips = project['transcript']['scenes'][0]['clips']
            except (KeyError, IndexError) as e:
                raise Exception(f"대본 클립 데이터를 파싱하지 못했습니다. (빈 프로젝트 혹은 깨진 JSON): {str(e)}")
                
            # 3. 미디어 파일 매칭 및 JSON 구조에 주입 (Appending)
            for media_path in media_file_paths:
                filename = os.path.basename(media_path)
                try:
                    # 파일명 앞의 접두어(예: '001')를 숫자로 치환하여 배열 인덱스로 사용
                    # 주의: 유저가 넣는 번호는 1부터 시작하고, Array의 인덱스는 0부터 시작하므로 -1 처리
                    if '_' not in filename:
                        continue
                    prefix = filename.split('_')[0]
                    if not prefix.isdigit():
                        continue
                        
                    clip_idx = int(prefix) - 1
                    
                    # 방어적 코드: 유저가 실수로 클립 갯수를 초과하는 번호(예: 050_추가사항.jpg)를 올렸을 때 에러 없이 무시
                    if clip_idx < 0 or clip_idx >= len(clips):
                        print(f"[VrewAutoFill] 예외 처리: 유효하지 않은 클립 인덱스 (파일: {filename}, 최대 허용: {len(clips)-1})")
                        continue
                        
                    # Vrew JSON 규격에 맞게 난수(UUID) 기반 식별자를 발급
                    media_id = str(uuid.uuid4())
                    asset_id = str(uuid.uuid4())
                    ext = os.path.splitext(filename)[1].lower()
                    is_video = ext in ['.mp4', '.mov']
                    
                    # 미디어 파일을 Vrew 패키지 내부(media 폴더)로 복사
                    # 올바른 Vrew IN_MEMORY 형식: media/[mediaId][확장자]
                    media_folder = os.path.join(temp_dir, 'media')
                    os.makedirs(media_folder, exist_ok=True)
                    
                    internal_filename = f"{media_id}{ext}"
                    dest_path = os.path.join(media_folder, internal_filename)
                    shutil.copy2(media_path, dest_path)
                    
                    # 'files' 영역에 리소스 정보 추가 (IN_MEMORY 형식)
                    new_file_entry = {
                        "version": 1,
                        "mediaId": media_id,
                        "sourceOrigin": "USER",
                        "name": filename,
                        "type": "AVMedia" if is_video else "Image",
                        "fileLocation": "IN_MEMORY",
                        "sourceFileType": "ASSET_VIDEO" if is_video else "IMAGE",
                        "fileSize": os.path.getsize(dest_path)
                    }
                    
                    if is_video:
                        meta = self._extract_video_metadata(dest_path)
                        
                        # Vrew 형식을 위한 기본 메타데이터 세팅
                        v_width = meta["width"] if meta and meta["width"] > 0 else 1920
                        v_height = meta["height"] if meta and meta["height"] > 0 else 1080
                        v_fps = meta["fps"] if meta and meta["fps"] > 0 else 30
                        v_duration = meta["duration"] if meta and meta["duration"] > 0 else 10.0
                        
                        new_file_entry["videoAudioMetaInfo"] = {
                            "videoInfo": {
                                "size": {"width": v_width, "height": v_height},
                                "frameRate": v_fps,
                                "codec": "h264"
                            },
                            "audioInfo": {
                                "sampleRate": 44100,
                                "codec": "aac",
                                "channelCount": 2
                            },
                            "duration": v_duration,
                            "presumedDevice": "unknown",
                            "mediaContainer": "mp4"
                        }
                        original_aspect_ratio = v_width / v_height if v_height > 0 else 1.777
                    else:
                        new_file_entry["isTransparent"] = False
                        original_aspect_ratio = 1.0
                    
                    if 'files' not in project:
                        project['files'] = []
                    project['files'].append(new_file_entry)
                    
                    # 해당 클립에 assetId 연결
                    if 'assetIds' not in clips[clip_idx]:
                        clips[clip_idx]['assetIds'] = []
                    clips[clip_idx]['assetIds'].append(asset_id)
                    
                    # 'props.assets'에 시각적 속성 정의 (전체 화면 배치)
                    if 'props' not in project:
                        project['props'] = {"assets": {}}
                    if 'assets' not in project['props']:
                        project['props']['assets'] = {}
                        
                    project['props']['assets'][asset_id] = {
                        "mediaId": media_id,
                        "xPos": 0 if is_video else 0.15,
                        "yPos": 0 if is_video else 0.144,
                        "height": 1 if is_video else 0.711,
                        "width": 1 if is_video else 0.7,
                        "rotation": 0,
                        "zIndex": 1,
                        "type": "video" if is_video else "image",
                        "originalWidthHeightRatio": original_aspect_ratio,
                        "editInfo": {}
                    }
                    
                    if is_video:
                        project['props']['assets'][asset_id].update({
                            "sourceIn": 0,
                            "volume": 0.5,
                            "isTrimmable": True,
                            "hasAlphaChannel": False
                        })
                    else:
                        project['props']['assets'][asset_id].update({
                            "importType": "drag_and_drop",
                            "stats": {}
                        })
                    print(f"[VrewAutoFill] 매칭 성공: {filename} -> 클립 #{clip_idx+1}")
                    
                    
                except Exception as e:
                    # 특정 미디어 파일 처리 중 예외가 발생하더라도, 전체 반복문이 멈추지 않도록(Crash 방지) 예외를 흘려보냅니다.
                    print(f"[VrewAutoFill] 개별 파일 매칭 실패 ({filename}): {str(e)}")
                    continue
                    
            # 4. 수정한 데이터를 다시 JSON 파일로 기록 (덮어쓰기)
            # Vrew 파서가 텍스트를 제대로 읽도록 ensure_ascii=False 옵션을 필수적으로 적용합니다.
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(project, f, ensure_ascii=False, indent=2)
                
            # 5. 다시 압축하여 최종 Vrew 파일 생성
            output_filename = f"autofill_{uuid.uuid4().hex[:8]}.vrew"
            output_filepath = os.path.join(self.output_dir, output_filename)
            
            with zipfile.ZipFile(output_filepath, 'w', zipfile.ZIP_DEFLATED) as zip_out:
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        # temp_dir 이후의 상대 경로 계산
                        arcname = os.path.relpath(file_path, temp_dir)
                        zip_out.write(file_path, arcname)
                        
            return output_filepath
            
        except Exception as main_e:
            print(f"[VrewAutoFill] 치명적 오류 발생: {str(main_e)}")
            raise main_e
            
        finally:
            # 최종 정리 로직 (Garbage Collection 보조)
            # 성공 여부와 상관없이 무조건 찌꺼기(Temp 폴더)를 지워 하드디스크 용량 누수를 막습니다.
            try:
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)
            except Exception as e:
                print(f"[VrewAutoFill] 임시 폴더 삭제 실패: {e}")

vrew_autofill_service = VrewAutoFillService()
