"""
Vrew Service - LOCAL 방식으로 VREW 프로젝트 생성 (Self-Contained)
- fileLocation: "LOCAL" 사용 → .vrew ZIP 내부 media/ 폴더에 모든 소스 포함
- 오디오/이미지/영상이 ZIP 안에 포함되어 경로 오류 없이 동작
- path: "./media/{filename}" 형식으로 ZIP 내 상대경로 참조
- 파일 크기: 미디어 크기에 비례 (수십 MB ~ 수백 MB)
"""
import os
import json
import uuid
import zipfile
import shutil
from typing import Dict, Any, List
from datetime import datetime
from services.utils import OUTPUT_DIR, VREW_OUTPUT_DIR
import requests
from pydub import AudioSegment
from urllib.parse import urlparse

class VrewServiceNew:
    """IN_MEMORY 방식으로 VREW 프로젝트를 생성하는 서비스 (Self-Contained)"""

    def __init__(self):
        self.output_dir = OUTPUT_DIR
        self.vrew_output_dir = VREW_OUTPUT_DIR
        self.audio_cache = {}
        print(f"[OK] Vrew Service (New) 초기화 완료")
        print(f"     출력 경로: {self.output_dir}")

    def generate_vrew_project(self, timeline_data: Dict[str, Any]) -> str:
        """
        VREW 프로젝트 파일 생성
        - fileLocation: LOCAL → 모든 미디어를 .vrew ZIP 내 media/ 폴더에 포함
        - 단일 .vrew 파일로 배포 가능 (외부 파일 없음, D13 에러 없음)
        - project.json은 compact single-line 포맷 (실제 Vrew 파일 규격)
        """
        try:
            print("\n" + "="*60)
            print("VREW 프로젝트 생성 시작 (LOCAL)")
            print("="*60)

            pid = uuid.uuid4().hex[:8]
            os.makedirs(self.output_dir, exist_ok=True)

            # 모든 씬 수집
            merged_groups = timeline_data.get('mergedGroups', [])
            standalone = timeline_data.get('standalone', [])
            all_scenes = []
            for group in merged_groups:
                all_scenes.extend(group.get('scenes', []))
            all_scenes.extend(standalone)

            if not all_scenes:
                raise ValueError("씬이 없습니다.")

            files_list = []
            vrew_clips = []
            assets_dict = {}
            tts_clip_infos_map = {}
            # (temp_path, zip_inner_path) 쌍 — ZIP에 넣고 삭제할 임시 파일들
            media_to_add = []

            for i, scene in enumerate(all_scenes):
                text = scene.get('text') or scene.get('script') or ""
                duration = scene.get('duration', 5.0)

                # ── 오디오 처리 ──
                audio_url = scene.get('audioUrl')
                scene_audio_media_id = self._generate_vrew_id(10)

                if audio_url:
                    try:
                        audio_filename = f"vrew_{pid}_{scene_audio_media_id}.mp3"
                        audio_abs_path = os.path.join(self.output_dir, audio_filename)

                        # fragment (#t=start,end) 파싱 후 오디오 커팅
                        start_t, end_t = 0.0, duration
                        source_url = audio_url
                        if '#t=' in audio_url:
                            parts = audio_url.split('#t=')
                            source_url = parts[0]
                            try:
                                tp = parts[1].split(',')
                                if len(tp) >= 2:
                                    start_t = float(tp[0])
                                    end_t = float(tp[1])
                                    duration = end_t - start_t
                            except: pass

                        # 마스터 파일 다운로드 → 커팅 → 저장
                        master_temp = os.path.join(self.output_dir, f"_tmp_{uuid.uuid4().hex[:8]}.mp3")
                        self._download_file(source_url, master_temp)
                        if os.path.exists(master_temp) and os.path.getsize(master_temp) > 0:
                            try:
                                seg = AudioSegment.from_file(master_temp)
                                seg[int(start_t * 1000):int(end_t * 1000)].export(audio_abs_path, format="mp3")
                                os.remove(master_temp)
                            except Exception as ae:
                                print(f"  [Audio] 커팅 실패, 원본 사용: {ae}")
                                shutil.move(master_temp, audio_abs_path)
                        elif os.path.exists(master_temp):
                            os.remove(master_temp)

                        if os.path.exists(audio_abs_path) and os.path.getsize(audio_abs_path) > 0:
                            a_size = os.path.getsize(audio_abs_path)
                            files_list.append({
                                "version": 1,
                                "mediaId": scene_audio_media_id,
                                "sourceOrigin": "USER",
                                "fileSize": a_size,
                                "name": audio_filename,
                                "type": "AVMedia",
                                "videoAudioMetaInfo": {
                                    "duration": round(duration, 2),
                                    "audioInfo": {"sampleRate": 24000, "codec": "mp3", "channelCount": 1},
                                    "mediaContainer": "mp3"
                                },
                                "sourceFileType": "TTS",
                                "fileLocation": "LOCAL",
                                "path": f"./media/{audio_filename}"
                            })
                            media_to_add.append((audio_abs_path, f"media/{audio_filename}"))
                            tts_clip_infos_map[scene_audio_media_id] = {
                                "duration": round(duration, 2),
                                "text": {"raw": text, "textAspectLang": "ko-KR", "processed": text},
                                "speaker": {
                                    "gender": "female", "age": "middle", "provider": "vrew",
                                    "lang": "ko-KR", "name": "va19", "speakerId": "va19",
                                    "versions": ["v2"]
                                },
                                "volume": 0, "speed": 1, "pitch": 0, "version": "v2"
                            }
                            print(f"[Vrew] 씬{i+1} 오디오: {audio_filename} ({a_size//1024} KB)")
                    except Exception as e:
                        print(f"[Vrew] 씬{i+1} 오디오 처리 실패: {e}")

                # ── 비주얼 처리 (영상 우선, 없으면 이미지) ──
                asset_ids = []
                visual_url = scene.get('videoUrl') or scene.get('visualUrl') or scene.get('generatedUrl')

                if visual_url:
                    try:
                        parsed = urlparse(visual_url)
                        ext = os.path.splitext(parsed.path)[1].lower()
                        if ext == '.webp': ext = '.png'
                        is_video = ext in ['.mp4', '.mov', '.avi', '.webm', '.m4v']
                        if not ext: ext = '.mp4' if is_video else '.jpg'

                        visual_media_id = str(uuid.uuid4())
                        visual_filename = f"vrew_{pid}_{visual_media_id}{ext}"
                        visual_abs_path = os.path.join(self.output_dir, visual_filename)

                        self._download_file(visual_url, visual_abs_path)

                        if os.path.exists(visual_abs_path) and os.path.getsize(visual_abs_path) > 0:
                            v_size = os.path.getsize(visual_abs_path)
                            visual_info = {
                                "version": 1,
                                "mediaId": visual_media_id,
                                "sourceOrigin": "USER",
                                "fileSize": v_size,
                                "name": visual_filename,
                                "type": "AVMedia" if is_video else "Image",
                                "fileLocation": "LOCAL",
                                "path": f"./media/{visual_filename}"
                            }
                            media_to_add.append((visual_abs_path, f"media/{visual_filename}"))
                            if is_video:
                                visual_info["videoAudioMetaInfo"] = {
                                    "videoInfo": {"width": 1920, "height": 1080, "codec": "h264", "fps": 30},
                                    "audioInfo": {"sampleRate": 44100, "codec": "aac", "channelCount": 2},
                                    "duration": round(duration, 2),
                                    "mediaContainer": ext[1:]
                                }
                                visual_info["sourceFileType"] = "ASSET_VIDEO"
                            else:
                                visual_info["isTransparent"] = False
                                visual_info["sourceFileType"] = "ASSET_IMAGE"

                            files_list.append(visual_info)

                            asset_guid = str(uuid.uuid4())
                            asset_ids.append(asset_guid)
                            assets_dict[asset_guid] = {
                                "mediaId": visual_media_id,
                                "xPos": 0, "yPos": -0.1666, "height": 1.3333, "width": 1,
                                "rotation": 0, "zIndex": i,
                                "type": "video" if is_video else "image",
                                "sourceIn": 0, "volume": scene.get('videoVolume', 0) if is_video else 0,
                                "originalWidthHeightRatio": 1.7777777777777777,
                                "isTrimmable": True,
                                "hasAlphaChannel": False,
                                "editInfo": {},
                                "fillType": "cut"
                            }
                            print(f"[Vrew] 씬{i+1} {'영상' if is_video else '이미지'}: {visual_filename} ({v_size//1024} KB)")
                    except Exception as e:
                        print(f"[Vrew] 씬{i+1} 비주얼 처리 실패: {e}")

                # ── 클립 생성 ──
                clip = {
                    "id": self._generate_vrew_id(10),
                    "words": [
                        {
                            "id": self._generate_vrew_id(10),
                            "text": text,
                            "startTime": 0,
                            "duration": round(duration, 2),
                            "aligned": True,
                            "type": 0,
                            "originalDuration": round(duration, 2),
                            "originalStartTime": 0,
                            "truncatedWords": [],
                            "autoControl": False,
                            "mediaId": scene_audio_media_id,
                            "audioIds": [],
                            "assetIds": asset_ids,
                            "playbackRate": 1
                        },
                        # Vrew 필수 end marker (type:2)
                        {
                            "id": self._generate_vrew_id(10),
                            "text": "",
                            "startTime": round(duration, 2),
                            "duration": 0,
                            "aligned": False,
                            "type": 2,
                            "originalDuration": 0,
                            "originalStartTime": round(duration, 2),
                            "truncatedWords": [],
                            "autoControl": False,
                            "mediaId": scene_audio_media_id,
                            "audioIds": [],
                            "assetIds": [],
                            "playbackRate": 1
                        }
                    ],
                    "captionMode": "MANUAL",
                    "captions": [
                        {"text": [{"insert": text + "\n"}]},
                        {"text": [{"insert": "\n"}]}
                    ],
                    "assetIds": asset_ids,
                    "dirty": {"blankDeleted": False, "caption": False, "video": False},
                    "translationModified": {"result": False, "source": False},
                    "audioIds": []
                }
                vrew_clips.append(clip)

            # ── project.json 구성 ──
            now = datetime.now()
            iso_date = now.strftime("%Y-%m-%dT%H:%M:%S+09:00")
            project_id = str(uuid.uuid4())

            iso_utc = now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"

            project_data = {
                "version": 15,
                "files": files_list,
                "transcript": {
                    "scenes": [{
                        "id": self._generate_vrew_id(10),
                        "clips": vrew_clips,
                        "name": "",
                        "dirty": {"video": False}
                    }]
                },
                "props": {
                    "assets": assets_dict,
                    "audios": {},
                    "overdubInfos": {},
                    "backgroundMap": {},
                    "flipSetting": {},
                    "analyzeDate": now.strftime("%Y-%m-%d %H:%M:%S"),
                    "videoRatio": 1.7777777777777777,
                    "videoSize": {"width": 1920, "height": 1080},
                    "initProjectVideoSize": {"width": 1920, "height": 1080},
                    "globalVideoTransform": {"zoom": 1, "xPos": 0, "yPos": 0, "rotation": 0},
                    "captionDisplayMode": {"0": True, "1": False},
                    "globalCaptionStyle": self._generate_caption_style(),
                    "mediaEffectMap": {},
                    "markerNames": {str(j): "" for j in range(6)},
                    "pronunciationDisplay": True,
                    "projectAudioLanguage": "ko",
                    "audioLanguagesMap": {},
                    "originalClipsMap": {},
                    "ttsClipInfosMap": tts_clip_infos_map
                },
                "comment": f"3.6.2\t{iso_utc}",
                "projectId": project_id,
                "statistics": {
                    "wordCursorCount": {"0": 0},
                    "wordSelectionCount": {"0": 0},
                    "wordCorrectionCount": {"0": 0},
                    "projectStartMode": "video_audio",
                    "saveInfo": {
                        "created": {"version": "3.6.2", "date": iso_date, "stage": "release"},
                        "updated": {"version": "3.6.2", "date": iso_date, "stage": "release"},
                        "loadCount": 0, "saveCount": 1
                    },
                    "savedStyleApplyCount": 0,
                    "cumulativeTemplateApplyCount": 0,
                    "ratioChangedByTemplate": False,
                    "videoRemixInfos": {},
                    "isAIWritingUsed": False,
                    "sttLinebreakOptions": {"mode": 0, "maxLineLength": 30},
                    "clientLinebreakExecuteCount": 0,
                    "agentStats": {"isEdited": False, "requestCount": 0, "responseCount": 0, "toolCallCount": 0, "toolErrorCount": 0}
                }
            }

            # ── .vrew 파일 생성 (ZIP: project.json + media/ 폴더) ──
            vrew_filename = f"vrew_{pid}.vrew"
            vrew_path = os.path.join(self.output_dir, vrew_filename)
            if os.path.exists(vrew_path):
                os.remove(vrew_path)

            with zipfile.ZipFile(vrew_path, 'w', compression=zipfile.ZIP_STORED) as zf:
                # 실제 Vrew 파일 규격: compact single-line JSON (공백/줄바꿈 없음)
                json_bytes = json.dumps(project_data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
                zf.writestr("project.json", json_bytes)
                for abs_path, zip_inner in media_to_add:
                    if os.path.exists(abs_path):
                        zf.write(abs_path, zip_inner)
                        print(f"[Vrew] 포함: {zip_inner} ({os.path.getsize(abs_path)//1024} KB)")
                        os.remove(abs_path)  # 임시 파일 정리

            total_kb = os.path.getsize(vrew_path) // 1024
            print(f"[OK] VREW 생성 완료: {vrew_filename} ({total_kb} KB, 미디어 {len(media_to_add)}개 포함)")

            return f"/output/{vrew_filename}"

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
        blocks = srt_content.strip().split('\\n\\n')

        for block in blocks:
            lines = block.strip().split('\\n')
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
                if not vrew_scenes:
                     # New format check
                    vrew_scenes = project_data.get('transcript', {}).get('scenes', [])
                    if vrew_scenes and 'clips' in vrew_scenes[0]:
                         vrew_scenes = vrew_scenes[0]['clips']
                
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

            srt_block = f"{i+1}\\n{start_str} --> {end_str}\\n{text}\\n"
            srt_blocks.append(srt_block)

        return "\\n".join(srt_blocks)

    def _seconds_to_srt_time(self, seconds: float) -> str:
        """초를 SRT 시간 형식으로 변환 (5.5 -> 00:00:05,500)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def _generate_caption_style(self) -> Dict[str, Any]:
        """실제 Vrew 포맷과 동일한 고정 자막 스타일 반환"""
        return {
            "captionStyleSetting": {
                "mediaId": "uc-0010-simple-textbox",
                "yAlign": "bottom",
                "yOffset": 0,
                "xOffset": 0,
                "rotation": 0,
                "width": 0.96,
                "customAttributes": [
                    {"attributeName": "--textbox-color", "type": "color-hex", "value": "rgba(0,0,0,0)"},
                    {"attributeName": "--textbox-align", "type": "textbox-align", "value": "center"}
                ],
                "scaleFactor": 1.75
            },
            "quillStyle": {
                "font": "Pretendard-Vrew_700",
                "size": "48",
                "color": "#ffffff",
                "outline-on": "true",
                "outline-color": "#000000",
                "outline-width": "4"
            }
        }

    def _download_file(self, url: str, target_path: str):
        """URL 다운로드 또는 로컬 파일 복사 - 개선된 버전"""
        if not url: 
            print(f"[Vrew] 다운로드 실패: URL이 비어있습니다")
            return
        
        # 0. 프래그먼트 제거 (#t=start,end 부분 제거)
        clean_url = url
        if '#t=' in url:
            clean_url = url.split('#t=')[0]
            print(f"[Vrew] 프래그먼트 제거: {url} -> {clean_url}")
        
        # 1. "/output/"으로 시작하는 로컬 경로 처리 (상대 경로)
        if clean_url.startswith('/output/'):
            # /output/ 이후 부분 추출
            relative_path = clean_url[8:]  # "/output/" 이후 부분
            local_path = os.path.join(self.output_dir, relative_path)
            if os.path.exists(local_path):
                try:
                    shutil.copy2(local_path, target_path)
                    print(f"[Vrew] 로컬 파일 복사 성공 (상대 경로): {local_path} -> {target_path}")
                    return
                except Exception as e:
                    print(f"[Vrew] 로컬 파일 복사 실패: {e}")
            else:
                print(f"[Vrew] 로컬 파일이 존재하지 않음: {local_path}")
        
        # 2. localhost:8000/output/... 경로를 로컬 파일 경로로 변환
        if clean_url.startswith('http://localhost:8000/output/') or clean_url.startswith('http://0.0.0.0:8000/output/'):
            # URL 경로에서 output/ 이후 부분 추출
            import re
            match = re.search(r'/output/(.+)$', clean_url)
            if match:
                local_path = os.path.join(self.output_dir, match.group(1))
                if os.path.exists(local_path):
                    try:
                        shutil.copy2(local_path, target_path)
                        print(f"[Vrew] 로컬 파일 복사 성공: {local_path} -> {target_path}")
                        return
                    except Exception as e:
                        print(f"[Vrew] 로컬 파일 복사 실패: {e}")
                else:
                    print(f"[Vrew] 로컬 파일이 존재하지 않음: {local_path}")
        
        # 3. 이미 로컬 파일인 경우
        if os.path.exists(clean_url):
            try:
                shutil.copy2(clean_url, target_path)
                print(f"[Vrew] 직접 로컬 파일 복사: {clean_url} -> {target_path}")
                return
            except Exception as e:
                print(f"[Vrew] 로컬 파일 복사 실패: {e}")
        
        # 4. 절대 경로지만 존재하지 않는 경우 (output 디렉토리 기준으로 확인)
        if not clean_url.startswith('http'):
            # output 디렉토리 내 상대 경로인지 확인
            possible_paths = [
                clean_url,
                os.path.join(self.output_dir, clean_url),
                os.path.join(self.output_dir, os.path.basename(clean_url))
            ]
            for path in possible_paths:
                if os.path.exists(path):
                    try:
                        shutil.copy2(path, target_path)
                        print(f"[Vrew] 발견된 경로 복사: {path} -> {target_path}")
                        return
                    except Exception as e:
                        print(f"[Vrew] 발견된 경로 복사 실패: {e}")
        
        # 5. HTTP URL인 경우
        if clean_url.startswith('http'):
            try:
                print(f"[Vrew] HTTP 다운로드 시도: {clean_url}")
                response = requests.get(clean_url, stream=True, timeout=30)
                response.raise_for_status()
                
                # 파일 크기 확인
                file_size = int(response.headers.get('content-length', 0))
                print(f"[Vrew] 파일 크기: {file_size} bytes")
                
                with open(target_path, 'wb') as f:
                    downloaded = 0
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                
                # 다운로드 완료 확인
                if os.path.exists(target_path):
                    actual_size = os.path.getsize(target_path)
                    print(f"[Vrew] 다운로드 완료: {target_path} ({actual_size} bytes)")
                    
                    # 파일 크기 검증
                    if file_size > 0 and abs(actual_size - file_size) > 1000:
                        print(f"[Vrew] 경고: 예상 크기와 다름 ({file_size} vs {actual_size})")
                    return True
                else:
                    print(f"[Vrew] 다운로드 후 파일이 생성되지 않음: {target_path}")
                    return False
                    
            except requests.exceptions.Timeout:
                print(f"[Vrew] 다운로드 타임아웃: {clean_url}")
            except requests.exceptions.ConnectionError:
                print(f"[Vrew] 연결 오류: {clean_url}")
            except Exception as e:
                print(f"[Vrew] HTTP 다운로드 실패 ({clean_url}): {e}")
                import traceback
                traceback.print_exc()
        else:
            # 6. 로컬 경로지만 파일이 없는 경우
            print(f"[Vrew] 파일 찾을 수 없음: {clean_url}")
            
        # 모든 시도 실패 시 빈 파일 생성 (VREW가 비어있는 파일이라도 포함하도록)
        try:
            with open(target_path, 'wb') as f:
                f.write(b'')
            print(f"[Vrew] 빈 파일 생성 (대체용): {target_path}")
            return True
        except Exception as e:
            print(f"[Vrew] 빈 파일 생성 실패: {e}")
            return False

    def _check_file_exists(self, url: str) -> bool:
        """URL 또는 파일 경로가 실제로 존재하는지 확인 (강화된 버전)"""
        if not url or url == "undefined" or url == "null":
            print(f"[_check_file_exists] 빈 URL 또는 undefined: {url}")
            return False
        
        try:
            # 0. 프래그먼트 제거 (#t=start,end 부분 제거)
            clean_url = url
            if '#t=' in url:
                clean_url = url.split('#t=')[0]
                print(f"[_check_file_exists] 프래그먼트 제거: {url} -> {clean_url}")
            
            # 1. 로컬 파일 경로인 경우 (Windows 절대 경로)
            if os.path.exists(clean_url):
                size = os.path.getsize(clean_url) if os.path.exists(clean_url) else 0
                print(f"[_check_file_exists] 로컬 파일 존재: {clean_url} ({size} bytes)")
                return True
            
            # 2. "/output/"으로 시작하는 상대 경로인 경우
            if clean_url.startswith('/output/'):
                relative_path = clean_url[8:]  # "/output/" 이후 부분
                local_path = os.path.join(self.output_dir, relative_path)
                if os.path.exists(local_path):
                    size = os.path.getsize(local_path)
                    print(f"[_check_file_exists] /output/ 경로 변환 성공: {clean_url} -> {local_path} ({size} bytes)")
                    return True
                else:
                    print(f"[_check_file_exists] /output/ 경로 변환 실패: {clean_url} -> {local_path} (존재하지 않음)")
            
            # 3. "output/"으로 시작하는 상대 경로인 경우 (앞에 / 없음)
            if clean_url.startswith('output/'):
                relative_path = clean_url[7:]  # "output/" 이후 부분
                local_path = os.path.join(self.output_dir, relative_path)
                if os.path.exists(local_path):
                    size = os.path.getsize(local_path)
                    print(f"[_check_file_exists] output/ 경로 변환 성공: {clean_url} -> {local_path} ({size} bytes)")
                    return True
            
            # 4. http://localhost:8000/output/... 경로인 경우
            if clean_url.startswith('http://localhost:8000/output/') or clean_url.startswith('http://0.0.0.0:8000/output/'):
                import re
                match = re.search(r'/output/(.+)$', clean_url)
                if match:
                    local_path = os.path.join(self.output_dir, match.group(1))
                    if os.path.exists(local_path):
                        size = os.path.getsize(local_path)
                        print(f"[_check_file_exists] localhost URL 변환 성공: {clean_url} -> {local_path} ({size} bytes)")
                        return True
                    else:
                        print(f"[_check_file_exists] localhost URL 변환 실패: {clean_url} -> {local_path} (존재하지 않음)")
            
            # 5. http://127.0.0.1:8000/output/... 경로인 경우
            if clean_url.startswith('http://127.0.0.1:8000/output/'):
                import re
                match = re.search(r'/output/(.+)$', clean_url)
                if match:
                    local_path = os.path.join(self.output_dir, match.group(1))
                    if os.path.exists(local_path):
                        size = os.path.getsize(local_path)
                        print(f"[_check_file_exists] 127.0.0.1 URL 변환 성공: {clean_url} -> {local_path} ({size} bytes)")
                        return True
            
            # 6. 로컬 경로지만 존재하지 않는 경우 (output 디렉토리 기준으로 확인)
            if not clean_url.startswith('http'):
                # output 디렉토리 내 상대 경로인지 확인
                possible_paths = [
                    clean_url,
                    os.path.join(self.output_dir, clean_url),
                    os.path.join(self.output_dir, os.path.basename(clean_url)),
                    os.path.join(os.getcwd(), clean_url),
                    os.path.join(os.getcwd(), 'output', clean_url),
                    os.path.join(os.getcwd(), 'output', os.path.basename(clean_url))
                ]
                
                for i, path in enumerate(possible_paths):
                    if os.path.exists(path):
                        size = os.path.getsize(path)
                        print(f"[_check_file_exists] 가능 경로 #{i+1} 발견: {path} ({size} bytes)")
                        return True
            
            # 7. data: URI인 경우 (이미지 데이터)
            if clean_url.startswith('data:'):
                print(f"[_check_file_exists] Data URI 발견: {clean_url[:50]}...")
                # data URI는 이미지 데이터일 수 있지만 비디오 파일은 아님
                # 비디오 URL 체크에서는 False 반환
                return False
            
            # 8. HTTP URL인 경우 - 실제 존재 여부 확인 (HEAD 요청)
            if clean_url.startswith('http'):
                try:
                    print(f"[_check_file_exists] HTTP HEAD 요청 시도: {clean_url[:80]}...")
                    response = requests.head(clean_url, timeout=10, allow_redirects=True)
                    exists = response.status_code == 200
                    print(f"[_check_file_exists] HTTP HEAD 결과: 상태코드 {response.status_code}, 존재함: {exists}")
                    return exists
                except requests.exceptions.Timeout:
                    print(f"[_check_file_exists] HTTP HEAD 타임아웃: {clean_url}")
                except requests.exceptions.ConnectionError:
                    print(f"[_check_file_exists] HTTP HEAD 연결 오류: {clean_url}")
                except Exception as e:
                    print(f"[_check_file_exists] HTTP HEAD 예외: {e}")
                return False
            
            print(f"[_check_file_exists] 모든 검사 실패: {clean_url}")
            return False
            
        except Exception as e:
            print(f"[_check_file_exists] 예외 발생: {e} - URL: {url}")
            return False

    def _generate_vrew_id(self, length: int = 10) -> str:
        """Vrew 스타일의 대소문자 혼합 영숫자 ID 생성"""
        import random
        import string
        chars = string.ascii_letters + string.digits
        return ''.join(random.choice(chars) for _ in range(length))

# 싱글톤 인스턴스
vrew_service_new = VrewServiceNew()
