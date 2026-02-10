"""
Vrew Formatter Module
TTS 타임스탬프를 Vrew 프로젝트 포맷으로 변환하는 모듈
"""
import os
import uuid
import json
import zipfile
import shutil
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass
from .tts_base import WordTimestamp
from .utils import OUTPUT_DIR, download_file


@dataclass
class VrewClip:
    """Vrew 클립 데이터 구조"""
    id: str
    text: str
    start_time: float      # 초 단위
    duration: float        # 초 단위
    media_id: str          # 오디오 파일 ID
    visual_ids: List[str]  # 비주얼 파일 ID 목록

    def to_dict(self) -> Dict[str, Any]:
        """Vrew project.json 클립 포맷으로 변환"""
        return {
            "id": self.id,
            "text": self.text,
            "startTime": self.start_time,
            "duration": self.duration,
            "aligned": True,
            "type": 0,
            "originalDuration": self.duration,
            "originalStartTime": self.start_time,
            "truncatedWords": [],
            "autoControl": False,
            "mediaId": self.media_id,
            "audioIds": [],
            "assetIds": self.visual_ids,
            "playbackRate": 1
        }


@dataclass
class VrewMediaFile:
    """Vrew 미디어 파일 메타데이터"""
    media_id: str
    name: str
    file_type: str  # "Image", "Video", "AVMedia"
    file_size: int
    local_path: str

    def to_dict(self) -> Dict[str, Any]:
        """Vrew project.json 파일 메타데이터 포맷으로 변환"""
        base = {
            "version": 1,
            "mediaId": self.media_id,
            "sourceOrigin": "USER",
            "fileSize": self.file_size,
            "name": self.name,
            "type": self.file_type,
            "fileLocation": "IN_MEMORY"
        }

        if self.file_type == "AVMedia":
            base["videoAudioMetaInfo"] = {"fileType": "VIDEO_AUDIO"}
            base["path"] = f"./{self.name}"
            base["relativePath"] = f"./{self.name}"
        elif self.file_type == "Image":
            base["isTransparent"] = False

        return base


class VrewFormatter:
    """
    TTS 타임스탬프를 Vrew 프로젝트로 변환하는 포맷터

    주요 기능:
    - WordTimestamp → VrewClip 변환
    - project.json 생성
    - ZIP 패키징 (.vrew 파일 생성)
    """

    def __init__(self):
        self.temp_dir = os.path.join(OUTPUT_DIR, "temp_vrew")

    def timestamps_to_clips(
        self,
        timestamps: List[WordTimestamp],
        audio_media_id: str,
        visual_ids: List[str] = None,
        group_by_sentence: bool = False
    ) -> List[VrewClip]:
        """
        TTS 타임스탬프를 Vrew 클립으로 변환

        Args:
            timestamps: TTS에서 생성된 WordTimestamp 목록
            audio_media_id: 오디오 파일의 미디어 ID
            visual_ids: 비주얼 에셋 ID 목록 (없으면 빈 리스트)
            group_by_sentence: True면 문장 단위로 그룹화

        Returns:
            VrewClip 목록
        """
        if not timestamps:
            return []

        visual_ids = visual_ids or []
        clips = []

        if group_by_sentence:
            # 문장 단위 그룹화 (마침표, 물음표, 느낌표 기준)
            sentence_ends = {'.', '?', '!', '。', '？', '！'}
            current_sentence = []
            sentence_start = 0.0

            for ts in timestamps:
                current_sentence.append(ts.text)

                # 문장 끝 감지
                if any(ts.text.endswith(end) for end in sentence_ends) or ts == timestamps[-1]:
                    sentence_text = ' '.join(current_sentence)
                    sentence_duration = ts.end_seconds - sentence_start

                    clips.append(VrewClip(
                        id=str(uuid.uuid4())[:10],
                        text=sentence_text,
                        start_time=sentence_start,
                        duration=sentence_duration,
                        media_id=audio_media_id,
                        visual_ids=visual_ids
                    ))

                    current_sentence = []
                    sentence_start = ts.end_seconds
        else:
            # 단어 단위 클립 생성
            for ts in timestamps:
                clips.append(VrewClip(
                    id=str(uuid.uuid4())[:10],
                    text=ts.text,
                    start_time=ts.start_seconds,
                    duration=ts.duration_seconds,
                    media_id=audio_media_id,
                    visual_ids=visual_ids
                ))

        return clips

    def build_project_json(
        self,
        clips: List[VrewClip],
        media_files: List[VrewMediaFile],
        resolution: tuple = (1920, 1080),
        project_id: str = None
    ) -> Dict[str, Any]:
        """
        Vrew project.json 구조 생성

        Args:
            clips: VrewClip 목록
            media_files: VrewMediaFile 목록
            resolution: 영상 해상도 (width, height)
            project_id: 프로젝트 고유 ID (없으면 자동 생성)

        Returns:
            project.json 딕셔너리
        """
        project_id = project_id or str(uuid.uuid4())

        # 전체 duration 계산
        total_duration = 0.0
        if clips:
            last_clip = max(clips, key=lambda c: c.start_time + c.duration)
            total_duration = last_clip.start_time + last_clip.duration

        return {
            "version": 15,
            "files": [mf.to_dict() for mf in media_files],
            "transcript": {
                "version": 1,
                "clips": [clip.to_dict() for clip in clips]
            },
            "props": {
                "version": 2,
                "duration": total_duration,
                "resolution": {
                    "width": resolution[0],
                    "height": resolution[1]
                }
            },
            "comment": "Generated by RealHunalo Studio",
            "projectId": project_id,
            "statistics": {},
            "lastTTSSettings": {}
        }

    def create_vrew_package(
        self,
        project_data: Dict[str, Any],
        media_files: List[VrewMediaFile],
        output_filename: str = None
    ) -> str:
        """
        Vrew 프로젝트를 ZIP으로 패키징 (.vrew 파일 생성)

        Args:
            project_data: build_project_json()에서 생성된 데이터
            media_files: VrewMediaFile 목록 (로컬 경로 포함)
            output_filename: 출력 파일명 (없으면 자동 생성)

        Returns:
            생성된 .vrew 파일의 URL
        """
        # 임시 작업 디렉토리 생성
        work_id = str(uuid.uuid4())
        work_dir = os.path.join(self.temp_dir, work_id)
        media_dir = os.path.join(work_dir, "media")
        os.makedirs(media_dir, exist_ok=True)

        try:
            # 미디어 파일 복사
            for mf in media_files:
                if os.path.exists(mf.local_path):
                    shutil.copy(mf.local_path, os.path.join(media_dir, mf.name))

            # project.json 저장
            project_json_path = os.path.join(work_dir, "project.json")
            with open(project_json_path, 'w', encoding='utf-8') as f:
                json.dump(project_data, f, ensure_ascii=False, indent=2)

            # ZIP 생성
            output_filename = output_filename or f"project_{int(datetime.now().timestamp())}.vrew"
            vrew_path = os.path.join(OUTPUT_DIR, output_filename)

            with zipfile.ZipFile(vrew_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                zf.write(project_json_path, "project.json")

                for media_file in os.listdir(media_dir):
                    media_path = os.path.join(media_dir, media_file)
                    zf.write(media_path, f"media/{media_file}")

            print(f"✅ Vrew 패키지 생성 완료: {output_filename}")
            return f"http://localhost:8000/output/{output_filename}"

        finally:
            # 임시 디렉토리 정리
            if os.path.exists(work_dir):
                shutil.rmtree(work_dir)


class VrewProjectBuilder:
    """
    TTS 결과와 미디어 에셋을 조합하여 Vrew 프로젝트를 빌드하는 고수준 빌더
    """

    def __init__(self):
        self.formatter = VrewFormatter()
        self.media_files: List[VrewMediaFile] = []
        self.all_clips: List[VrewClip] = []
        self.current_time_offset = 0.0

    def add_scene(
        self,
        timestamps: List[WordTimestamp],
        audio_path: str,
        visual_path: str = None,
        scene_id: str = None
    ) -> 'VrewProjectBuilder':
        """
        씬 추가 (타임스탬프 + 오디오 + 비주얼)

        Args:
            timestamps: TTS 타임스탬프
            audio_path: 오디오 파일 경로 또는 URL
            visual_path: 비주얼 파일 경로 또는 URL (선택)
            scene_id: 씬 ID (로깅용)

        Returns:
            self (체이닝 지원)
        """
        if not timestamps or not audio_path:
            print(f"⚠️ Scene {scene_id}: 타임스탬프 또는 오디오 없음, 스킵")
            return self

        # 오디오 파일 처리
        audio_local = self._resolve_file(audio_path, ".mp3")
        if not audio_local:
            print(f"⚠️ Scene {scene_id}: 오디오 다운로드 실패")
            return self

        audio_id = str(uuid.uuid4())
        audio_name = f"{audio_id}.mp3"

        self.media_files.append(VrewMediaFile(
            media_id=audio_id,
            name=audio_name,
            file_type="AVMedia",
            file_size=os.path.getsize(audio_local),
            local_path=audio_local
        ))

        # 비주얼 파일 처리 (있는 경우)
        visual_ids = []
        if visual_path:
            visual_ext = ".mp4" if "video" in visual_path.lower() or visual_path.endswith(".mp4") else ".png"
            visual_local = self._resolve_file(visual_path, visual_ext)

            if visual_local:
                visual_id = str(uuid.uuid4())
                visual_name = f"{visual_id}{visual_ext}"
                visual_type = "Video" if visual_ext == ".mp4" else "Image"

                self.media_files.append(VrewMediaFile(
                    media_id=visual_id,
                    name=visual_name,
                    file_type=visual_type,
                    file_size=os.path.getsize(visual_local),
                    local_path=visual_local
                ))
                visual_ids.append(visual_id)

        # 타임스탬프 → 클립 변환 (시간 오프셋 적용)
        offset_timestamps = []
        for ts in timestamps:
            offset_timestamps.append(WordTimestamp(
                text=ts.text,
                start_ms=ts.start_ms + int(self.current_time_offset * 1000),
                end_ms=ts.end_ms + int(self.current_time_offset * 1000)
            ))

        clips = self.formatter.timestamps_to_clips(
            timestamps=offset_timestamps,
            audio_media_id=audio_id,
            visual_ids=visual_ids,
            group_by_sentence=False
        )

        self.all_clips.extend(clips)

        # 시간 오프셋 업데이트
        if timestamps:
            scene_duration = timestamps[-1].end_seconds
            self.current_time_offset += scene_duration

        print(f"✅ Scene {scene_id}: {len(clips)}개 클립 추가됨")
        return self

    def build(self, output_filename: str = None) -> str:
        """
        최종 Vrew 프로젝트 빌드

        Args:
            output_filename: 출력 파일명 (선택)

        Returns:
            생성된 .vrew 파일 URL
        """
        if not self.all_clips:
            raise ValueError("빌드할 클립이 없습니다. add_scene()을 먼저 호출하세요.")

        project_data = self.formatter.build_project_json(
            clips=self.all_clips,
            media_files=self.media_files
        )

        return self.formatter.create_vrew_package(
            project_data=project_data,
            media_files=self.media_files,
            output_filename=output_filename
        )

    def _resolve_file(self, path_or_url: str, default_ext: str) -> Optional[str]:
        """파일 경로 또는 URL을 로컬 파일로 해석"""
        if not path_or_url:
            return None

        # 이미 로컬 파일인 경우
        if os.path.exists(path_or_url):
            return path_or_url

        # Base64 데이터 URL인 경우
        if path_or_url.startswith("data:"):
            return self._decode_base64_url(path_or_url, default_ext)

        # HTTP URL인 경우
        if path_or_url.startswith(("http://", "https://")):
            return download_file(path_or_url, default_ext)

        return None

    def _decode_base64_url(self, data_url: str, default_ext: str) -> Optional[str]:
        """Base64 데이터 URL을 파일로 저장"""
        import base64

        try:
            # data:audio/mpeg;base64,XXXX 형식 파싱
            header, encoded = data_url.split(",", 1)
            data = base64.b64decode(encoded)

            filename = f"temp_{uuid.uuid4()}{default_ext}"
            filepath = os.path.join(OUTPUT_DIR, filename)

            with open(filepath, "wb") as f:
                f.write(data)

            return filepath
        except Exception as e:
            print(f"⚠️ Base64 디코딩 실패: {e}")
            return None


# 싱글톤 인스턴스
vrew_formatter = VrewFormatter()
