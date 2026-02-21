"""
Vrew 프로젝트 파일 (.vrew) 생성 헬퍼 클래스

사용 예시:
    builder = VrewBuilder()
    builder.add_video("video.mp4", duration=60.0)
    builder.add_clip("안녕하세요", start_time=0, duration=2.0)
    builder.save("output.vrew")
"""

import json
import zipfile
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
import mimetypes


class VrewBuilder:
    """Vrew 프로젝트 파일 생성기"""

    def __init__(self, width: int = 1920, height: int = 1080):
        """
        Args:
            width: 비디오 너비
            height: 비디오 높이
        """
        self.width = width
        self.height = height
        self.ratio = width / height

        self.project_id = str(uuid.uuid4())
        self.files: List[Dict] = []
        self.clips: List[Dict] = []
        self.media_files_to_include: List[tuple] = []  # (source_path, media_id, extension)

    def add_video(self,
                  video_path: str,
                  duration: float,
                  include_in_archive: bool = True) -> str:
        """
        비디오 파일 추가

        Args:
            video_path: 비디오 파일 경로
            duration: 비디오 길이 (초)
            include_in_archive: True면 IN_MEMORY, False면 LOCAL

        Returns:
            생성된 media_id
        """
        media_id = str(uuid.uuid4())
        video_path_obj = Path(video_path)

        file_data = {
            "version": 1,
            "mediaId": media_id,
            "sourceOrigin": "USER",
            "fileSize": video_path_obj.stat().st_size if video_path_obj.exists() else 0,
            "name": video_path_obj.name,
            "type": "AVMedia",
            "videoAudioMetaInfo": {
                "videoInfo": {
                    "size": {"width": self.width, "height": self.height},
                    "frameRate": 30.0,
                    "codec": "h264"
                },
                "audioInfo": {
                    "sampleRate": 44100,
                    "codec": "aac",
                    "channelCount": 2
                },
                "duration": duration,
                "presumedDevice": "unknown",
                "mediaContainer": video_path_obj.suffix[1:]  # .mp4 -> mp4
            },
            "sourceFileType": "VIDEO_AUDIO"
        }

        if include_in_archive:
            file_data["fileLocation"] = "IN_MEMORY"
            file_data["relativePath"] = f"./{video_path_obj.name}"
            self.media_files_to_include.append((video_path, media_id, video_path_obj.suffix[1:]))
        else:
            file_data["fileLocation"] = "LOCAL"
            file_data["path"] = str(video_path_obj.absolute())
            file_data["relativePath"] = f"./{video_path_obj.name}"

        self.files.append(file_data)
        return media_id

    def add_audio(self,
                  audio_path: str,
                  duration: float,
                  include_in_archive: bool = True) -> str:
        """
        오디오 파일 추가

        Args:
            audio_path: 오디오 파일 경로
            duration: 오디오 길이 (초)
            include_in_archive: True면 IN_MEMORY, False면 LOCAL

        Returns:
            생성된 media_id
        """
        media_id = str(uuid.uuid4())
        audio_path_obj = Path(audio_path)

        file_data = {
            "version": 1,
            "mediaId": media_id,
            "sourceOrigin": "USER",
            "fileSize": audio_path_obj.stat().st_size if audio_path_obj.exists() else 0,
            "name": audio_path_obj.name,
            "type": "AVMedia",
            "videoAudioMetaInfo": {
                "audioInfo": {
                    "sampleRate": 44100,
                    "codec": "mp3",
                    "channelCount": 1
                },
                "duration": duration,
                "presumedDevice": "unknown",
                "mediaContainer": audio_path_obj.suffix[1:]
            },
            "sourceFileType": "VIDEO_AUDIO"
        }

        if include_in_archive:
            file_data["fileLocation"] = "IN_MEMORY"
            file_data["relativePath"] = f"./{audio_path_obj.name}"
            self.media_files_to_include.append((audio_path, media_id, audio_path_obj.suffix[1:]))
        else:
            file_data["fileLocation"] = "LOCAL"
            file_data["path"] = str(audio_path_obj.absolute())
            file_data["relativePath"] = f"./{audio_path_obj.name}"

        self.files.append(file_data)
        return media_id

    def add_image(self,
                  image_path: str,
                  include_in_archive: bool = True) -> str:
        """
        이미지 파일 추가

        Args:
            image_path: 이미지 파일 경로
            include_in_archive: True면 IN_MEMORY, False면 LOCAL

        Returns:
            생성된 media_id
        """
        media_id = str(uuid.uuid4())
        image_path_obj = Path(image_path)

        file_data = {
            "version": 1,
            "mediaId": media_id,
            "sourceOrigin": "USER",
            "fileSize": image_path_obj.stat().st_size if image_path_obj.exists() else 0,
            "name": f"{media_id}{image_path_obj.suffix}",
            "type": "Image",
            "isTransparent": False
        }

        if include_in_archive:
            file_data["fileLocation"] = "IN_MEMORY"
            self.media_files_to_include.append((image_path, media_id, image_path_obj.suffix[1:]))
        else:
            file_data["fileLocation"] = "LOCAL"
            file_data["path"] = str(image_path_obj.absolute())

        self.files.append(file_data)
        return media_id

    def add_clip(self,
                 text: str,
                 start_time: float,
                 duration: float,
                 media_id: Optional[str] = None) -> str:
        """
        자막 클립 추가

        Args:
            text: 자막 텍스트
            start_time: 시작 시간 (초)
            duration: 지속 시간 (초)
            media_id: 연결할 미디어 ID (없으면 첫 번째 미디어 사용)

        Returns:
            생성된 clip_id
        """
        if media_id is None and self.files:
            media_id = self.files[0]["mediaId"]

        clip_id = str(uuid.uuid4())
        word_id = str(uuid.uuid4())

        word = {
            "id": word_id,
            "text": text,
            "startTime": start_time,
            "duration": duration,
            "aligned": True,
            "type": 0,  # 0 = 단어, 1 = 무음, 2 = 종료
            "originalDuration": duration,
            "originalStartTime": start_time,
            "truncatedWords": [],
            "autoControl": False,
            "mediaId": media_id or "",
            "audioIds": [],
            "assetIds": [],
            "playbackRate": 1
        }

        # 종료 마커
        end_marker = {
            "id": str(uuid.uuid4()),
            "text": "",
            "startTime": start_time + duration,
            "duration": 0,
            "aligned": False,
            "type": 2,  # 종료 마커
            "originalDuration": 0,
            "originalStartTime": start_time + duration,
            "truncatedWords": [],
            "autoControl": False,
            "mediaId": media_id or "",
            "audioIds": [],
            "assetIds": [],
            "playbackRate": 1
        }

        clip = {
            "id": clip_id,
            "words": [word, end_marker],
            "captionMode": "TRANSCRIPT",
            "captions": [
                {"text": [{"insert": f"{text}\n"}]},
                {"text": [{"insert": "\n"}]}
            ],
            "assetIds": [],
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

        self.clips.append(clip)
        return clip_id

    def add_silence(self,
                    start_time: float,
                    duration: float,
                    media_id: Optional[str] = None) -> str:
        """
        무음 구간 추가

        Args:
            start_time: 시작 시간 (초)
            duration: 지속 시간 (초)
            media_id: 연결할 미디어 ID

        Returns:
            생성된 clip_id
        """
        if media_id is None and self.files:
            media_id = self.files[0]["mediaId"]

        clip_id = str(uuid.uuid4())

        silence_word = {
            "id": str(uuid.uuid4()),
            "text": "",
            "startTime": start_time,
            "duration": duration,
            "aligned": True,
            "type": 1,  # 무음
            "originalDuration": duration,
            "originalStartTime": start_time,
            "truncatedWords": [],
            "autoControl": False,
            "mediaId": media_id or "",
            "audioIds": [],
            "assetIds": [],
            "playbackRate": 1
        }

        end_marker = {
            "id": str(uuid.uuid4()),
            "text": "",
            "startTime": start_time + duration,
            "duration": 0,
            "aligned": False,
            "type": 2,
            "originalDuration": 0,
            "originalStartTime": start_time + duration,
            "truncatedWords": [],
            "autoControl": False,
            "mediaId": media_id or "",
            "audioIds": [],
            "assetIds": [],
            "playbackRate": 1
        }

        clip = {
            "id": clip_id,
            "words": [silence_word, end_marker],
            "captionMode": "TRANSCRIPT",
            "captions": [
                {"text": [{"insert": "\n"}]},
                {"text": [{"insert": "\n"}]}
            ],
            "assetIds": [],
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

        self.clips.append(clip)
        return clip_id

    def build(self) -> Dict[str, Any]:
        """
        프로젝트 JSON 데이터 생성

        Returns:
            완전한 Vrew 프로젝트 딕셔너리
        """
        now = datetime.now()
        iso_date = now.strftime("%Y-%m-%dT%H:%M:%S+09:00")

        return {
            "version": 15,
            "projectId": self.project_id,
            "comment": f"3.5.4\t{now.isoformat()}Z",

            "files": self.files,

            "transcript": {
                "scenes": [
                    {
                        "id": str(uuid.uuid4()),
                        "clips": self.clips,
                        "name": "",
                        "dirty": {"video": False}
                    }
                ]
            },

            "props": {
                "assets": {},
                "audios": {},
                "overdubInfos": {},
                "backgroundMap": {},
                "flipSetting": {},
                "ttsClipInfosMap": {},

                "analyzeDate": now.strftime("%Y-%m-%d %H:%M:%S"),
                "videoRatio": self.ratio,
                "videoSize": {"width": self.width, "height": self.height},
                "initProjectVideoSize": {"width": self.width, "height": self.height},

                "globalVideoTransform": {
                    "zoom": 1,
                    "xPos": 0,
                    "yPos": 0,
                    "rotation": 0
                },

                "captionDisplayMode": {"0": True, "1": False},

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
                        "scaleFactor": self.ratio
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

    def save(self, output_path: str):
        """
        .vrew 파일 저장

        Args:
            output_path: 저장할 파일 경로
        """
        project_data = self.build()

        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            # project.json 추가
            zf.writestr('project.json', json.dumps(project_data, ensure_ascii=False, indent=2))

            # 미디어 파일들 추가
            for source_path, media_id, extension in self.media_files_to_include:
                source_path_obj = Path(source_path)
                if source_path_obj.exists():
                    zf.write(source_path, f'media/{media_id}.{extension}')
                else:
                    print(f"경고: 파일을 찾을 수 없음 - {source_path}")

        print(f"✅ Vrew 파일 생성 완료: {output_path}")


# ==================== 사용 예시 ====================

if __name__ == "__main__":
    # 기본 사용법
    builder = VrewBuilder(width=1920, height=1080)

    # 비디오 추가 (아카이브에 포함)
    video_id = builder.add_video(
        video_path="sample_video.mp4",
        duration=60.0,
        include_in_archive=True
    )

    # 자막 추가
    builder.add_clip("안녕하세요", start_time=0, duration=2.0, media_id=video_id)
    builder.add_silence(start_time=2.0, duration=0.5, media_id=video_id)
    builder.add_clip("반갑습니다", start_time=2.5, duration=2.0, media_id=video_id)

    # 이미지 추가
    image_id = builder.add_image("thumbnail.png", include_in_archive=True)

    # 저장
    builder.save("output.vrew")

    # JSON만 출력
    # project_dict = builder.build()
    # print(json.dumps(project_dict, ensure_ascii=False, indent=2))
