"""
Vrew Formatter Module
TTS 타임스탬프를 Vrew 프로젝트 포맷으로 변환하는 모듈
[업데이트] 양도세 중과유예.vrew 분석 결과를 반영한 완전한 구조
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
        """
        Vrew project.json 클립 포맷으로 변환
        [업데이트] 완전한 Clip 구조 (words, captions, captionMode 포함)
        """
        word_id = str(uuid.uuid4())
        end_marker_id = str(uuid.uuid4())

        # Word 구조 (실제 텍스트)
        word = {
            "id": word_id,
            "text": self.text,
            "startTime": self.start_time,
            "duration": self.duration,
            "aligned": True,
            "type": 0,  # 0 = 단어
            "originalDuration": self.duration,
            "originalStartTime": self.start_time,
            "truncatedWords": [],
            "autoControl": False,
            "mediaId": self.media_id,
            "audioIds": [],
            "assetIds": self.visual_ids,
            "playbackRate": 1
        }

        # 종료 마커 (필수!)
        end_marker = {
            "id": end_marker_id,
            "text": "",
            "startTime": self.start_time + self.duration,
            "duration": 0,
            "aligned": False,
            "type": 2,  # 2 = 종료 마커
            "originalDuration": 0,
            "originalStartTime": self.start_time + self.duration,
            "truncatedWords": [],
            "autoControl": False,
            "mediaId": self.media_id,
            "audioIds": [],
            "assetIds": [],
            "playbackRate": 1
        }

        # 완전한 Clip 구조
        return {
            "id": self.id,
            "words": [word, end_marker],  # words 배열
            "captionMode": "TRANSCRIPT",
            "captions": [  # Quill 델타 형식
                {"text": [{"insert": f"{self.text}\n"}]},
                {"text": [{"insert": "\n"}]}
            ],
            "assetIds": self.visual_ids,
            "audioIds": [],
            "dirty": {
                "blankDeleted": False,
                "caption": False,
                "video": False
            },
            "translationModified": {
                "result": False,
                "source": False
            }
        }


@dataclass
class VrewMediaFile:
    """Vrew 미디어 파일 메타데이터"""
    media_id: str
    name: str
    file_type: str  # "Image", "Video", "AVMedia"
    file_size: int
    local_path: str
    duration: float = 0.0  # 오디오/비디오 길이 (초)

    def to_dict(self) -> Dict[str, Any]:
        """
        Vrew project.json 파일 메타데이터 포맷으로 변환
        [업데이트] 완전한 미디어 파일 구조
        """
        # 가상의 로컬 경로 생성 (실제로는 ZIP 내부에 있지만 Vrew는 LOCAL 형식 선호)
        fake_local_path = os.path.abspath(self.name)

        base = {
            "version": 1,
            "mediaId": self.media_id,
            "sourceOrigin": "USER",
            "fileSize": self.file_size,
            "name": self.name,
            "type": self.file_type,
            "fileLocation": "IN_MEMORY", # Reverted to IN_MEMORY based on analysis
            # "path": f"media/{self.name}",  # Removed as Vrew does not use this field for packaged files
            # "relativePath": f"./media/{self.name}" # Removed as Vrew does not use this field for packaged files
        }

        if self.file_type in ["AVMedia", "Video"]:
            # 오디오/비디오 메타 정보
            ext = os.path.splitext(self.name)[1].lower()
            base["type"] = "AVMedia"

            base["videoAudioMetaInfo"] = {
                "audioInfo": {
                    "sampleRate": 44100,
                    "codec": "mp3" if ext == ".mp3" else "aac",
                    "channelCount": 1 if ext == ".mp3" else 2
                },
                "duration": self.duration,
                "presumedDevice": "unknown",
                "mediaContainer": ext[1:]  # .mp3 -> mp3
            }
            
            if ext in [".mp4", ".mov"]:
                base["videoAudioMetaInfo"]["videoInfo"] = {
                    "size": {
                        "width": 1080, # default 9:16 vertical video
                        "height": 1920
                    },
                    "frameRate": 30.0,
                    "codec": "h264"
                }
                base["sourceFileType"] = "ASSET_VIDEO"
            else:
                base["sourceFileType"] = "VIDEO_AUDIO"

        elif self.file_type == "Image":
            base["isTransparent"] = False
            base["sourceFileType"] = "IMAGE"

        return base


class VrewFormatter:
    """
    TTS 타임스탬프를 Vrew 프로젝트로 변환하는 포맷터

    주요 기능:
    - WordTimestamp → VrewClip 변환
    - project.json 생성 (완전한 구조)
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
                        id=str(uuid.uuid4()),
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
                    id=str(uuid.uuid4()),
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
        [업데이트] 완전한 Vrew 프로젝트 구조 (scenes, props, statistics 포함)

        Args:
            clips: VrewClip 목록
            media_files: VrewMediaFile 목록
            resolution: 영상 해상도 (width, height)
            project_id: 프로젝트 고유 ID (없으면 자동 생성)

        Returns:
            project.json 딕셔너리
        """
        project_id = project_id or str(uuid.uuid4())
        now = datetime.now()
        iso_date = now.strftime("%Y-%m-%dT%H:%M:%S+09:00")

        # 전체 duration 계산
        total_duration = 0.0
        if clips:
            last_clip = max(clips, key=lambda c: c.start_time + c.duration)
            total_duration = last_clip.start_time + last_clip.duration

        width, height = resolution
        video_ratio = width / height

        return {
            "version": 15,
            "projectId": project_id,
            "comment": f"3.5.4\t{now.isoformat()}Z",

            # 파일 목록
            "files": [mf.to_dict() for mf in media_files],

            # Transcript (Scene 구조로 감싸기!)
            "transcript": {
                "scenes": [
                    {
                        "id": str(uuid.uuid4()),
                        "clips": [clip.to_dict() for clip in clips],
                        "name": "",
                        "dirty": {"video": False}
                    }
                ]
            },

            # Props (완전한 구조)
            "props": {
                "assets": {},
                "audios": {},
                "overdubInfos": {},
                "backgroundMap": {},
                "flipSetting": {},
                "ttsClipInfosMap": {},

                "analyzeDate": now.strftime("%Y-%m-%d %H:%M:%S"),
                "videoRatio": video_ratio,
                "videoSize": {"width": width, "height": height},
                "initProjectVideoSize": {"width": width, "height": height},

                "globalVideoTransform": {
                    "zoom": 1,
                    "xPos": 0,
                    "yPos": 0,
                    "rotation": 0
                },

                "captionDisplayMode": {"0": True, "1": False},

                # 자막 스타일
                "globalCaptionStyle": {
                    "captionStyleSetting": {
                        "mediaId": "uc-0010-simple-textbox",
                        "yAlign": "bottom",
                        "yOffset": 0,
                        "xOffset": 0,
                        "rotation": 0,
                        "width": 0.96,
                        "customAttributes": [
                            {
                                "attributeName": "--textbox-color",
                                "type": "color-hex",
                                "value": "rgba(0, 0, 0, 0)"
                            },
                            {
                                "attributeName": "--textbox-align",
                                "type": "textbox-align",
                                "value": "center"
                            }
                        ],
                        "scaleFactor": video_ratio
                    },
                    "quillStyle": {
                        "font": "Pretendard-Vrew_700",
                        "size": "100",
                        "color": "#ffffff",
                        "outline-on": "true",
                        "outline-color": "#000000",
                        "outline-width": "6"
                    }
                },

                "mediaEffectMap": {},
                "markerNames": {},

                # TTS 설정
                "lastTTSSettings": {
                    "pitch": 0,
                    "speed": 1,
                    "volume": 0,
                    "speaker": {
                        "age": "middle",
                        "gender": "female",
                        "lang": "ko-KR",
                        "name": "va19",
                        "speakerId": "va19",
                        "provider": "vrew",
                        "versions": ["v2"],
                        "tags": ["voice_actor"]
                    },
                    "version": "v2"
                },

                "pronunciationDisplay": True,
                "projectAudioLanguage": "ko",
                "audioLanguagesMap": {},
                "originalClipsMap": {}
            },

            # Statistics (완전한 구조)
            "statistics": {
                "wordCursorCount": {},
                "wordSelectionCount": {},
                "wordCorrectionCount": {},
                "projectStartMode": "video_audio",

                "saveInfo": {
                    "created": {
                        "version": "3.5.4",
                        "date": iso_date,
                        "stage": "release"
                    },
                    "updated": {
                        "version": "3.5.4",
                        "date": iso_date,
                        "stage": "release"
                    },
                    "loadCount": 0,
                    "saveCount": 1
                },

                "savedStyleApplyCount": 0,
                "cumulativeTemplateApplyCount": 0,
                "ratioChangedByTemplate": False,
                "videoRemixInfos": {},
                "isAIWritingUsed": False,

                "sttLinebreakOptions": {
                    "mode": 0,
                    "maxLineLength": 30
                },
                "clientLinebreakExecuteCount": 0,

                "agentStats": {
                    "isEdited": False,
                    "requestCount": 0,
                    "responseCount": 0,
                    "toolCallCount": 0,
                    "toolErrorCount": 0
                }
            }
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
            print(f"\n[Vrew Formatter] ZIP 패키징 시작...")

            # 미디어 파일 복사
            for mf in media_files:
                if os.path.exists(mf.local_path):
                    dest_path = os.path.join(media_dir, mf.name)
                    shutil.copy(mf.local_path, dest_path)
                    print(f"  ✓ 미디어 복사: {mf.name} ({mf.file_size} bytes)")
                else:
                    print(f"  ⚠️ 파일 없음: {mf.local_path}")

            # project.json 저장
            project_json_path = os.path.join(work_dir, "project.json")
            with open(project_json_path, 'w', encoding='utf-8') as f:
                json.dump(project_data, f, ensure_ascii=False, indent=2)
            print(f"  ✓ project.json 생성")

            # ZIP 생성 (ZIP_STORED 사용 - 압축 없음, Vrew 호환성 향상)
            output_filename = output_filename or f"project_{int(datetime.now().timestamp())}.vrew"
            vrew_path = os.path.join(OUTPUT_DIR, output_filename)

            with zipfile.ZipFile(vrew_path, 'w', zipfile.ZIP_STORED) as zf:
                zf.write(project_json_path, "project.json", compress_type=zipfile.ZIP_STORED)

                for media_file in os.listdir(media_dir):
                    media_path = os.path.join(media_dir, media_file)
                    zf.write(media_path, f"media/{media_file}", compress_type=zipfile.ZIP_STORED)

            # ZIP 파일 검증 (PK 헤더 확인)
            if os.path.exists(vrew_path):
                with open(vrew_path, 'rb') as f:
                    header = f.read(2)
                    if header == b'PK':
                        print(f"  ✓ ZIP 파일 검증 성공 (PK 헤더 확인)")
                    else:
                        print(f"  ⚠️ 경고: ZIP 헤더 이상 - {header.hex()}")

            file_size = os.path.getsize(vrew_path)
            print(f"  ✓ ZIP 생성 완료: {output_filename} ({file_size:,} bytes)")
            print(f"[OK] Vrew 패키지 생성 완료!\n")

            return f"http://localhost:8000/output/{output_filename}"

        finally:
            # 임시 디렉토리 정리
            if os.path.exists(work_dir):
                shutil.rmtree(work_dir)


class VrewProjectBuilder:
    """
    TTS 결과와 미디어 에셋을 조합하여 Vrew 프로젝트를 빌드하는 고수준 빌더
    [업데이트] 완전한 Vrew 구조 적용
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

        # 오디오 duration 계산
        audio_duration = 0.0
        if timestamps:
            audio_duration = timestamps[-1].end_seconds

        self.media_files.append(VrewMediaFile(
            media_id=audio_id,
            name=audio_name,
            file_type="AVMedia",
            file_size=os.path.getsize(audio_local),
            local_path=audio_local,
            duration=audio_duration  # duration 추가!
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
                    local_path=visual_local,
                    duration=audio_duration if visual_ext == ".mp4" else 0.0
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
