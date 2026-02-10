"""
Vrew Service - 올바른 VREW 포맷 생성
실제 VREW 프로젝트 구조 기반
"""
import os
import json
import uuid
import zipfile
import shutil
from typing import Dict, Any, List
from datetime import datetime
from services.utils import OUTPUT_DIR

class VrewServiceNew:
    """실제 VREW 포맷을 생성하는 서비스"""

    def __init__(self):
        self.output_dir = OUTPUT_DIR
        print("[OK] Vrew Service (New) 초기화 완료")

    def generate_vrew_project(self, timeline_data: Dict[str, Any], subtitle_style: Dict[str, Any] = None) -> str:
        """
        VREW 프로젝트 파일 생성 (실제 VREW 포맷)

        Args:
            timeline_data: 타임라인 데이터
            subtitle_style: 자막 스타일 설정 (None이면 기본값 사용)

        Returns:
            생성된 .vrew 파일 URL
        """
        try:
            print("\n" + "="*60)
            print("VREW 프로젝트 생성 시작 (New Format)")
            print("="*60)

            # 모든 씬 수집
            merged_groups = timeline_data.get('mergedGroups', [])
            standalone = timeline_data.get('standalone', [])

            all_scenes = []
            for group in merged_groups:
                all_scenes.extend(group.get('scenes', []))
            all_scenes.extend(standalone)

            if not all_scenes:
                raise ValueError("씬이 없습니다.")

            print(f"[Vrew] 총 {len(all_scenes)}개 씬 처리")

            # 1. 미디어 파일 정보 생성
            # VREW는 모든 오디오를 하나의 미디어 파일로 취급
            # 여기서는 첫 번째 씬의 오디오를 대표 미디어로 사용
            media_id = str(uuid.uuid4())
            first_audio = all_scenes[0].get('audioUrl', '') if all_scenes else ''

            files_info = {
                "version": 1,
                "mediaId": media_id,
                "sourceOrigin": "USER",
                "fileSize": 0,  # 실제로는 파일 크기를 계산해야 하지만, 여기서는 0으로
                "name": "merged_audio.mp3",
                "type": "AVMedia",
                "fileLocation": "IN_MEMORY",  # 메모리에서 처리
                "sourceFileType": "AUDIO"
            }

            # 2. Transcript (자막) 데이터 생성
            vrew_scenes = []
            current_time = 0.0

            for i, scene in enumerate(all_scenes):
                scene_id = str(uuid.uuid4())[:10]
                srt_data = scene.get('srtData', '')
                duration = scene.get('duration', 5.0)

                print(f"\n[Vrew] 씬 {i+1} 처리:")
                print(f"  - SRT: {'있음' if srt_data else '없음'}")
                print(f"  - Duration: {duration}초")

                # SRT 파싱해서 words 생성
                words = []
                if srt_data:
                    words = self._parse_srt_to_vrew_words(
                        srt_data,
                        media_id,
                        current_time
                    )
                else:
                    # SRT 없으면 더미 단어 생성
                    script = scene.get('script', scene.get('originalScript', ''))
                    words = [{
                        "id": str(uuid.uuid4())[:10],
                        "text": script,
                        "startTime": current_time,
                        "duration": duration,
                        "aligned": True,
                        "type": 0,
                        "originalDuration": duration,
                        "originalStartTime": current_time,
                        "truncatedWords": [],
                        "autoControl": False,
                        "mediaId": media_id,
                        "audioIds": [],
                        "assetIds": [],
                        "playbackRate": 1
                    }]

                # 씬 끝 마커 추가
                if words:
                    last_time = words[-1]["startTime"] + words[-1]["duration"]
                    words.append({
                        "id": str(uuid.uuid4())[:10],
                        "text": "",
                        "startTime": last_time,
                        "duration": 0,
                        "aligned": False,
                        "type": 2,  # 씬 끝
                        "originalDuration": 0,
                        "originalStartTime": last_time,
                        "truncatedWords": [],
                        "autoControl": False,
                        "mediaId": media_id,
                        "audioIds": [],
                        "assetIds": [],
                        "playbackRate": 1
                    })

                vrew_scene = {
                    "words": words,
                    "captionMode": "TRANSCRIPT",
                    "captions": [{"text": [{"insert": "\n"}]}, {"text": [{"insert": "\n"}]}],
                    "assetIds": [],
                    "dirty": {
                        "blankDeleted": False,
                        "caption": False,
                        "video": False
                    },
                    "translationModified": {
                        "result": False,
                        "source": False
                    },
                    "id": scene_id,
                    "audioIds": []
                }

                vrew_scenes.append(vrew_scene)
                current_time += duration

            # 3. 전체 프로젝트 구조 생성
            project_data = {
                "version": 15,
                "files": [files_info],
                "transcript": {
                    "scenes": vrew_scenes,
                    "name": "",
                    "dirty": {"video": False}
                },
                "props": {
                    "assets": {},
                    "audios": {},
                    "overdubInfos": {},
                    "analyzeDate": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "captionDisplayMode": {"0": True, "1": False},
                    "mediaEffectMap": {},
                    "markerNames": {str(i): "" for i in range(6)},
                    "flipSetting": {},
                    "videoRatio": 16/9,
                    "globalVideoTransform": {
                        "zoom": 1,
                        "xPos": 0,
                        "yPos": 0,
                        "rotation": 0
                    },
                    "videoSize": {
                        "width": 1920,
                        "height": 1080
                    },
                    "backgroundMap": {},
                    "globalCaptionStyle": self._generate_caption_style(subtitle_style),
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
                            "badge": "Recommended",
                            "versions": ["v2"],
                            "tags": ["voice_actor", "limber", "soft"]
                        },
                        "version": "v2"
                    },
                    "initProjectVideoSize": {
                        "width": 1920,
                        "height": 1080
                    },
                    "pronunciationDisplay": True,
                    "projectAudioLanguage": "ko",
                    "audioLanguagesMap": {},
                    "originalClipsMap": {},
                    "ttsClipInfosMap": {}
                },
                "comment": f"RealHunalo\t{datetime.now().isoformat()}",
                "projectId": str(uuid.uuid4()),
                "statistics": {
                    "wordCursorCount": {str(i): 0 for i in range(8)},
                    "wordSelectionCount": {str(i): 0 for i in range(8)},
                    "wordCorrectionCount": {str(i): 0 for i in range(8)},
                    "projectStartMode": "video_audio",
                    "saveInfo": {
                        "created": {
                            "version": "3.5.4",
                            "date": datetime.now().isoformat(),
                            "stage": "release"
                        },
                        "updated": {
                            "version": "3.5.4",
                            "date": datetime.now().isoformat(),
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
                },
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
                        "badge": "Recommended",
                        "versions": ["v2"],
                        "tags": ["voice_actor", "limber", "soft"]
                    },
                    "version": "v2"
                }
            }

            # 4. ZIP 파일 생성
            vrew_filename = f"vrew_project_{uuid.uuid4().hex[:8]}.vrew"
            vrew_path = os.path.join(self.output_dir, vrew_filename)

            # 임시 디렉토리에 project.json 생성
            temp_dir = os.path.join(self.output_dir, f"temp_vrew_{uuid.uuid4().hex[:8]}")
            os.makedirs(temp_dir, exist_ok=True)

            try:
                project_json_path = os.path.join(temp_dir, "project.json")
                with open(project_json_path, 'w', encoding='utf-8') as f:
                    json.dump(project_data, f, ensure_ascii=False)

                # ZIP 생성
                with zipfile.ZipFile(vrew_path, 'w', zipfile.ZIP_STORED) as zf:
                    zf.write(project_json_path, "project.json")

                print(f"[OK] VREW 프로젝트 생성 완료: {vrew_filename}")
                print("="*60 + "\n")

                return f"http://localhost:8000/output/{vrew_filename}"

            finally:
                # 임시 디렉토리 정리
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir, ignore_errors=True)

        except Exception as e:
            print(f"[X] VREW 생성 오류: {e}")
            import traceback
            traceback.print_exc()
            raise

    def _parse_srt_to_vrew_words(self, srt_content: str, media_id: str, time_offset: float = 0.0) -> List[Dict]:
        """
        SRT 자막을 VREW words 형식으로 변환

        Args:
            srt_content: SRT 형식 자막
            media_id: 미디어 ID
            time_offset: 시간 오프셋

        Returns:
            VREW words 리스트
        """
        words = []
        blocks = srt_content.strip().split('\n\n')

        for block in blocks:
            lines = block.strip().split('\n')
            if len(lines) < 3:
                continue

            # 타임라인 파싱
            timeline = lines[1]
            if '-->' not in timeline:
                continue

            try:
                start_str, end_str = timeline.split('-->')
                start_sec = self._srt_time_to_seconds(start_str.strip()) + time_offset
                end_sec = self._srt_time_to_seconds(end_str.strip()) + time_offset
                duration = end_sec - start_sec

                # 텍스트
                text = ' '.join(lines[2:]).strip()

                word = {
                    "id": str(uuid.uuid4())[:10],
                    "text": text,
                    "startTime": start_sec,
                    "duration": duration,
                    "aligned": True,
                    "type": 0,  # 일반 단어
                    "originalDuration": duration,
                    "originalStartTime": start_sec,
                    "truncatedWords": [],
                    "autoControl": False,
                    "mediaId": media_id,
                    "audioIds": [],
                    "assetIds": [],
                    "playbackRate": 1
                }

                words.append(word)

            except Exception as e:
                print(f"  [SRT Parser] 블록 파싱 실패: {e}")
                continue

        return words

    def _srt_time_to_seconds(self, time_str: str) -> float:
        """SRT 시간을 초로 변환 (00:00:05,500 -> 5.5)"""
        try:
            time_part, ms_part = time_str.split(',')
            h, m, s = map(int, time_part.split(':'))
            ms = int(ms_part)
            return h * 3600 + m * 60 + s + ms / 1000.0
        except:
            return 0.0

    def import_vrew_project(self, vrew_file_path: str) -> Dict[str, Any]:
        """
        VREW 프로젝트 파일 가져오기

        Args:
            vrew_file_path: .vrew 파일 경로

        Returns:
            타임라인 데이터 형식의 딕셔너리
        """
        try:
            print("\n" + "="*60)
            print("VREW 프로젝트 가져오기 시작")
            print("="*60)

            # ZIP 파일 압축 해제
            temp_dir = os.path.join(self.output_dir, f"temp_import_{uuid.uuid4().hex[:8]}")
            os.makedirs(temp_dir, exist_ok=True)

            try:
                with zipfile.ZipFile(vrew_file_path, 'r') as zf:
                    zf.extractall(temp_dir)

                # project.json 읽기
                project_json_path = os.path.join(temp_dir, "project.json")
                if not os.path.exists(project_json_path):
                    raise ValueError("project.json이 없습니다.")

                with open(project_json_path, 'r', encoding='utf-8') as f:
                    project_data = json.load(f)

                print(f"[Vrew Import] 프로젝트 버전: {project_data.get('version')}")

                # VREW scenes를 앱 씬 포맷으로 변환
                vrew_scenes = project_data.get('transcript', {}).get('scenes', [])
                print(f"[Vrew Import] {len(vrew_scenes)}개 씬 발견")

                app_scenes = []
                for i, vrew_scene in enumerate(vrew_scenes):
                    words = vrew_scene.get('words', [])

                    # type 2 (씬 끝 마커) 제외하고 실제 words만 가져오기
                    content_words = [w for w in words if w.get('type') != 2]

                    if not content_words:
                        continue

                    # words를 SRT 형식으로 변환
                    srt_data = self._vrew_words_to_srt(content_words)

                    # 전체 텍스트 추출
                    script = ' '.join([w.get('text', '') for w in content_words]).strip()

                    # Duration 계산
                    last_word = content_words[-1]
                    duration = last_word.get('startTime', 0) + last_word.get('duration', 0)
                    if i > 0:
                        # 이전 씬의 끝 시간 고려
                        prev_scene = vrew_scenes[i-1]
                        prev_words = [w for w in prev_scene.get('words', []) if w.get('type') != 2]
                        if prev_words:
                            prev_end = prev_words[-1].get('startTime', 0) + prev_words[-1].get('duration', 0)
                            duration = duration - prev_end

                    app_scene = {
                        "sceneId": i + 1,
                        "script": script,
                        "originalScript": script,
                        "srtData": srt_data,
                        "duration": duration,
                        "audioDuration": duration,
                        "audioUrl": "",  # VREW는 오디오 파일을 포함하지 않음
                        "visualUrl": "",
                        "generatedUrl": ""
                    }

                    app_scenes.append(app_scene)
                    print(f"  씬 {i+1}: {len(content_words)}개 단어, {duration:.2f}초")

                print(f"[OK] {len(app_scenes)}개 씬 가져오기 완료")
                print("="*60 + "\n")

                return {
                    "mergedGroups": [],
                    "standalone": app_scenes
                }

            finally:
                # 임시 디렉토리 정리
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir, ignore_errors=True)

        except Exception as e:
            print(f"[X] VREW 가져오기 오류: {e}")
            import traceback
            traceback.print_exc()
            raise

    def _vrew_words_to_srt(self, words: List[Dict]) -> str:
        """
        VREW words를 SRT 형식으로 변환

        Args:
            words: VREW words 리스트

        Returns:
            SRT 형식 문자열
        """
        srt_blocks = []

        for i, word in enumerate(words):
            text = word.get('text', '').strip()
            if not text:
                continue

            start_time = word.get('startTime', 0)
            duration = word.get('duration', 0)
            end_time = start_time + duration

            # 초를 SRT 시간 형식으로 변환
            start_str = self._seconds_to_srt_time(start_time)
            end_str = self._seconds_to_srt_time(end_time)

            srt_block = f"{i+1}\n{start_str} --> {end_str}\n{text}\n"
            srt_blocks.append(srt_block)

        return "\n".join(srt_blocks)

    def _seconds_to_srt_time(self, seconds: float) -> str:
        """초를 SRT 시간 형식으로 변환 (5.5 -> 00:00:05,500)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def _generate_caption_style(self, subtitle_style: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        자막 스타일 설정 생성

        Args:
            subtitle_style: 자막 스타일 딕셔너리 (None이면 기본값 사용)

        Returns:
            VREW 포맷의 globalCaptionStyle 딕셔너리
        """
        # 기본값 설정
        if subtitle_style is None:
            subtitle_style = {}

        enabled = subtitle_style.get('enabled', True)
        font_family = subtitle_style.get('fontFamily', 'Pretendard-Vrew_700')
        font_size = str(subtitle_style.get('fontSize', 100))
        font_color = subtitle_style.get('fontColor', '#ffffff')
        outline_enabled = subtitle_style.get('outlineEnabled', True)
        outline_color = subtitle_style.get('outlineColor', '#000000')
        outline_width = str(subtitle_style.get('outlineWidth', 6))
        position = subtitle_style.get('position', 'bottom')
        y_offset = subtitle_style.get('yOffset', 0)
        bg_color = subtitle_style.get('backgroundColor', 'rgba(0, 0, 0, 0)')
        alignment = subtitle_style.get('alignment', 'center')

        # 자막이 비활성화되어 있으면 투명하게 설정
        if not enabled:
            font_color = 'rgba(0, 0, 0, 0)'
            outline_enabled = False

        return {
            "captionStyleSetting": {
                "mediaId": "uc-0010-simple-textbox",
                "yAlign": position,
                "yOffset": y_offset,
                "xOffset": 0,
                "rotation": 0,
                "width": 0.96,
                "customAttributes": [
                    {"attributeName": "--textbox-color", "type": "color-hex", "value": bg_color},
                    {"attributeName": "--textbox-align", "type": "textbox-align", "value": alignment}
                ],
                "scaleFactor": 1.75
            },
            "quillStyle": {
                "font": font_family,
                "size": font_size,
                "color": font_color,
                "outline-on": "true" if outline_enabled else "false",
                "outline-color": outline_color,
                "outline-width": outline_width
            }
        }

# 싱글톤 인스턴스
vrew_service_new = VrewServiceNew()
