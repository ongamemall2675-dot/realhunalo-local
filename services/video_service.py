"""
Video Service
FFmpeg를 사용한 최종 영상 합성

=== FFmpeg 최적화 가이드 ===

LosslessCut 통합 평가 결과: **비추천**
이유:
1. 자막 동기화 문제 (CRITICAL): 스트림 복사 시 자막 타임스탬프가 절대값으로 유지되어 완전히 어긋남
2. 프레임 정확도 문제 (HIGH): 키프레임 경계에서만 자르기 가능, 0.1-0.5초 오차 발생
3. 자막 커스터마이징 충돌 (HIGH): Requirement #5와 호환 불가 (재인코딩 필요)

권장 최적화 방법:
1. **하드웨어 가속** (2-3배 속도 향상):
   - NVIDIA GPU: ffmpeg -hwaccel cuda
   - AMD GPU: ffmpeg -hwaccel d3d11va
   - Intel GPU: ffmpeg -hwaccel qsv

2. **프리셋 최적화**:
   - 미리보기: preset="ultrafast" (빠르지만 파일 크기 큼)
   - 기본: preset="medium" (균형)
   - 최종: preset="slow" (최고 품질, 느림)

3. **Two-Pass 렌더링**:
   - Pass 1: 빠른 미리보기 (낮은 품질, 자막 없음)
   - Pass 2: 최종 출력 (고품질, 자막 포함)

4. **병렬 처리**:
   - 여러 씬을 동시에 렌더링 (이미 지원됨)
   - 멀티스레드: ffmpeg -threads 0 (자동)

현재 설정: preset="medium", bitrate="5000k", fps=30
권장 설정: 그대로 유지 (최적의 균형점)
"""
import os
import uuid
import subprocess
import urllib.request
import tempfile
from typing import Dict, Any, List, Optional, Callable
from services.utils import OUTPUT_DIR

# 디버그용 로그 파일 경로 (uvicorn reload 방지를 위해 시스템 임시 폴더 사용)
import tempfile
VIDEO_DEBUG_LOG = os.path.join(tempfile.gettempdir(), "realhunalo_video_synthesis_debug.log")

def log_video_debug(msg):
    """비디오 합성 전용 디버그 로그 기록"""
    from datetime import datetime
    try:
        # 파일 핸들을 매번 열고 닫음 (충돌 방지)
        with open(VIDEO_DEBUG_LOG, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now().isoformat()}] {msg}\n")
        print(msg) # 터미널에도 출력
    except:
        pass

class VideoService:
    """최종 영상 합성 서비스"""
    
    # 해상도 문자열과 실제 FFmpeg 해상도 매핑
    RESOLUTION_MAP = {
        "720p": "1280x720",
        "1080p": "1920x1080",
        "4k": "3840x2160",
        "vertical": "1080x1920",
        "shorts": "1080x1920",
        "square": "1080x1080"
    }

    def __init__(self):
        self.output_dir = OUTPUT_DIR
        # 기본 해상도를 1920x1080으로 바로 설정
        self.resolution = self.RESOLUTION_MAP.get("1080p", "1920x1080")
        self.fps = 30
        self.preset = "medium"
        self.bitrate = "8M"  # 기본 비트레이트 상향

        # FFmpeg 설치 확인
        self._check_ffmpeg()

        # 중간 작업용 임시 디렉토리 설정 (uvicorn reload 방지를 위해 시스템 임시 폴더 사용)
        import tempfile
        self.processing_dir = os.path.join(tempfile.gettempdir(), "realhunalo_video_temp")
        os.makedirs(self.processing_dir, exist_ok=True)

        log_video_debug("\n" + "="*60)
        log_video_debug("[VideoService] 초기화 완료")
        log_video_debug(f"   - 해상도: {self.resolution}")
        log_video_debug(f"   - FPS: {self.fps}")
        log_video_debug(f"   - 프리셋: {self.preset}")
        log_video_debug(f"   - 비트레이트: {self.bitrate}")
        log_video_debug("="*60 + "\n")

    def _check_ffmpeg(self):
        """FFmpeg 설치 확인"""
        try:
            result = subprocess.run(['ffmpeg', '-version'],
                                   capture_output=True,
                                   text=True,
                                   timeout=5)
            if result.returncode == 0:
                version_line = result.stdout.split('\n')[0]
                print(f"[OK] FFmpeg 확인: {version_line}")
            else:
                print("[WARN] FFmpeg가 설치되어 있지 않거나 PATH에 없습니다.")
        except FileNotFoundError:
            print("[WARN] FFmpeg를 찾을 수 없습니다. 영상 생성이 불가능할 수 있습니다.")
            print("[INFO] FFmpeg 설치: https://ffmpeg.org/download.html")
        except Exception as e:
            print(f"[WARN] FFmpeg 확인 실패: {e}")

    def _has_audio(self, file_path: str) -> bool:
        """파일에 오디오 스트림이 있는지 확인"""
        try:
            cmd = [
                'ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type',
                '-of', 'csv=p=0', file_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return 'audio' in result.stdout
        except Exception as e:
            print(f"[VideoService] ffprobe 실패: {e}")
            return False

    def _download_file(self, url: str, output_path: str):
        """URL에서 파일 다운로드 (http://, data: URI 또는 상대 경로 처리)"""
        try:
            # Windows 콘솔 인코딩 재설정 (BackgroundTasks 환경 대응)
            import sys
            if hasattr(sys.stdout, "reconfigure"):
                try:
                    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
                except: pass
            
            if url.startswith('data:'):
                # Base64 데이터 URI 처리
                import base64
                header, data = url.split(',', 1)
                decoded = base64.b64decode(data)
                with open(output_path, 'wb') as f:
                    f.write(decoded)
                log_video_debug(f"[OK] Base64 데이터 저장: {output_path} ({len(decoded)} bytes)")
            
            elif url.startswith('/') or ('localhost' not in url and '127.0.0.1' not in url and '://' not in url):
                # 상대 경로 (/output/..., /assets/...) 또는 로컬 파일명 처리
                import shutil
                from urllib.parse import unquote
                from .utils import OUTPUT_DIR, ASSETS_DIR
                
                # 경로 정규화 (앞의 / 제거)
                clean_url = url.lstrip('/')
                decoded_url = unquote(clean_url)
                
                if decoded_url.startswith('output/'):
                    filename = decoded_url.replace('output/', '', 1)
                    source_path = os.path.join(OUTPUT_DIR, filename)
                elif decoded_url.startswith('assets/') or decoded_url.startswith('uploads/'):
                    filename = decoded_url.split('/')[-1]
                    source_path = os.path.join(ASSETS_DIR, filename)
                else:
                    # 기본적으로 ASSETS_DIR에서 찾기 시도
                    source_path = os.path.join(ASSETS_DIR, os.path.basename(decoded_url))
                
                log_video_debug(f"[Local Direct] {source_path} -> {output_path}")
                if not os.path.exists(source_path):
                    raise Exception(f"로컬 파일을 찾을 수 없음: {source_path}")
                
                shutil.copy(source_path, output_path)
                log_video_debug(f"[OK] 로컬 파일 직접 복사 완료: {output_path}")

            elif 'localhost:8000' in url or '127.0.0.1:8000' in url:
                # 로컬 서버 절대 URL 처리
                import shutil
                from urllib.parse import unquote
                from .utils import OUTPUT_DIR, ASSETS_DIR
                
                decoded_url = unquote(url)
                
                if '/output/' in decoded_url:
                    filename = decoded_url.split('/output/')[-1]
                    source_path = os.path.join(OUTPUT_DIR, filename)
                elif '/assets/' in decoded_url or '/uploads/' in decoded_url:
                    filename = decoded_url.split('/')[-1]
                    source_path = os.path.join(ASSETS_DIR, filename)
                else:
                    raise Exception(f"로컬 URL 경로 인식 실패: {url}")

                log_video_debug(f"[Local Copy] {source_path} -> {output_path}")
                if not os.path.exists(source_path):
                    raise Exception(f"로컬 파일을 찾을 수 없음: {source_path}")

                shutil.copy(source_path, output_path)
                log_video_debug(f"[OK] 로컬 파일 복사 완료: {output_path}")
            else:
                # 외부 HTTP URL에서 다운로드
                import urllib.request
                log_video_debug(f"[Download] {url[:80]}... -> {output_path}")
                urllib.request.urlretrieve(url, output_path)
                log_video_debug(f"[OK] 다운로드 완료: {output_path}")

            # 파일 존재 확인
            if not os.path.exists(output_path):
                raise Exception(f"파일 생성 실패: {output_path}")

        except Exception as e:
            log_video_debug(f"[X] 파일 다운로드 실패: {e}")
            raise

    def _get_file_extension(self, url: str) -> str:
        """URL 또는 data URI에서 파일 확장자 추출"""
        if url.startswith('data:'):
            # data:image/png;base64,... 형식
            if 'image/jpeg' in url or 'image/jpg' in url:
                return '.jpg'
            elif 'image/png' in url:
                return '.png'
            elif 'image/webp' in url:
                return '.webp'
            elif 'video/mp4' in url:
                return '.mp4'
            elif 'audio/mpeg' in url or 'audio/mp3' in url:
                return '.mp3'
            else:
                # 기본값
                return '.jpg'
        else:
            # HTTP URL에서 확장자 추출
            url_lower = url.lower()
            if any(ext in url_lower for ext in ['.jpg', '.jpeg']):
                return '.jpg'
            elif '.png' in url_lower:
                return '.png'
            elif '.webp' in url_lower:
                return '.webp'
            elif '.mp4' in url_lower:
                return '.mp4'
            elif '.webm' in url_lower:
                return '.webm'
            elif '.mp3' in url_lower:
                return '.mp3'
            else:
                # 기본값 (이미지로 가정)
                return '.jpg'

    def _is_image(self, ext: str) -> bool:
        """확장자가 이미지인지 확인"""
        return ext.lower() in ['.jpg', '.jpeg', '.png', '.webp', '.gif']

    def _srt_to_ass(self, srt_data: str, subtitle_style: Optional[Dict] = None) -> str:
        """
        SRT 자막을 ASS 형식으로 변환 - 개선된 버전
        ASS는 FFmpeg에서 더 안정적으로 지원되며 스타일 커스터마이징 가능

        Args:
            srt_data: SRT 형식의 자막 데이터
            subtitle_style: 자막 스타일 설정 dict
                - enabled: bool (자막 활성화)
                - fontFamily: str (폰트 패밀리)
                - fontSize: int (폰트 크기, 기본 48)
                - fontColor: str (폰트 색상, #RRGGBB)
                - fontWeight: str/int (폰트 두께)
                - outlineEnabled: bool (아웃라인 활성화)
                - outlineColor: str (아웃라인 색상)
                - outlineWidth: int (아웃라인 두께)
                - shadowEnabled: bool (그림자 활성화)
                - shadowColor: str (그림자 색상)
                - shadowBlur: int (그림자 블러)
                - position: str (위치: top, middle, bottom)
                - yOffset: int (Y축 오프셋)
                - backgroundColor: str (배경색)
                - alignment: str (정렬: left, center, right)
                - opacity: float (투명도, 0.0-1.0)
        """
        import re
        
        # 자막이 없거나 비활성화된 경우 빈 문자열 반환
        if not srt_data or srt_data == "No Data":
            return ""
        
        # 자막 스타일 파싱 (기본값 설정)
        if subtitle_style and isinstance(subtitle_style, dict):
            enabled = subtitle_style.get('enabled', True)
            # 자막 비활성화시 빈 문자열 반환
            if not enabled:
                print(f"[SRT to ASS] 자막 비활성화됨")
                return ""
                
            font_family = subtitle_style.get('fontFamily', 'Malgun Gothic')
            # 폰트 크기 조정 (기본값 48, VREW와 일치)
            font_size = subtitle_style.get('fontSize', 48)
            font_color = subtitle_style.get('fontColor', '#ffffff')
            font_weight = subtitle_style.get('fontWeight', '700')
            
            outline_enabled = subtitle_style.get('outlineEnabled', True)
            outline_color = subtitle_style.get('outlineColor', '#000000')
            outline_width = subtitle_style.get('outlineWidth', 4)  # 기본값 6 → 4로 변경
            
            shadow_enabled = subtitle_style.get('shadowEnabled', False)
            shadow_color = subtitle_style.get('shadowColor', '#00000080')
            shadow_blur = subtitle_style.get('shadowBlur', 3)
            
            position = subtitle_style.get('position', 'bottom')
            y_offset = subtitle_style.get('yOffset', 0)
            bg_color = subtitle_style.get('backgroundColor', 'rgba(0, 0, 0, 0)')
            alignment = subtitle_style.get('alignment', 'center')
            opacity = subtitle_style.get('opacity', 1.0)
        else:
            # 기본값 (VREW와 일치)
            font_family = 'Malgun Gothic'
            font_size = 48  # 기본값 100 → 48로 변경
            font_color = '#ffffff'
            font_weight = '700'
            outline_enabled = True
            outline_color = '#000000'
            outline_width = 4
            shadow_enabled = False
            shadow_color = '#00000080'
            shadow_blur = 3
            position = 'bottom'
            y_offset = 0
            bg_color = 'rgba(0, 0, 0, 0)'
            alignment = 'center'
            opacity = 1.0

        # 디버깅 로그
        print(f"[SRT to ASS Debug] ASS 변환 시작:")
        print(f"  - fontFamily: {font_family}, fontSize: {font_size}")
        print(f"  - fontColor: {font_color}, fontWeight: {font_weight}")
        print(f"  - outlineWidth: {outline_width}")
        print(f"  - position: {position}, alignment: {alignment}, yOffset: {y_offset}")

        # 색상을 ASS 형식으로 변환 (#RRGGBB -> &H00BBGGRR)
        def hex_to_ass_color(hex_color, alpha="00"):
            """HEX 색상을 ASS 형식으로 변환 (알파값 추가 가능)"""
            hex_color = hex_color.lstrip('#')
            if len(hex_color) == 6:
                r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
                return f"&H{alpha}{b.upper()}{g.upper()}{r.upper()}"
            return "&H00FFFFFF"  # Default white

        primary_color = hex_to_ass_color(font_color, "00")
        outline_color_ass = hex_to_ass_color(outline_color, "00")
        shadow_color_ass = hex_to_ass_color(shadow_color, "80" if "80" in shadow_color else "80")
        
        # 배경색 처리 (투명도 포함)
        if bg_color.startswith('rgba'):
            # rgba(0, 0, 0, 0.5) 형식 파싱
            import re
            match = re.search(r'rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)', bg_color)
            if match:
                r, g, b = int(match.group(1)), int(match.group(2)), int(match.group(3))
                alpha = int(float(match.group(4)) * 255)
                back_color = f"&H{alpha:02X}{b:02X}{g:02X}{r:02X}"
            else:
                back_color = "&H80000000"  # 기본 반투명 검정
        else:
            back_color = hex_to_ass_color(bg_color if bg_color != 'rgba(0, 0, 0, 0)' else '#000000', "80")

        # Alignment: 1=left bottom, 2=center bottom, 3=right bottom,
        #           4=left middle, 5=center middle, 6=right middle,
        #           7=left top, 8=center top, 9=right top
        alignment_map = {
            'bottom-left': 1, 'bottom-center': 2, 'bottom-right': 3,
            'center-left': 4, 'center-center': 5, 'center-right': 6,
            'top-left': 7, 'top-center': 8, 'top-right': 9
        }

        # Position + alignment 조합
        pos_align_key = f"{position}-{alignment}"
        ass_alignment = alignment_map.get(pos_align_key, 2)  # Default: bottom-center
        
        # Y축 오프셋 적용을 위한 MarginV 계산
        # 기본값: 하단 위치면 20, 중앙이면 0, 상단이면 -20
        base_margin_v = 20
        if position == 'middle':
            base_margin_v = 0
        elif position == 'top':
            base_margin_v = -20
            
        # yOffset 적용 (양수: 위로 이동, 음수: 아래로 이동)
        margin_v = base_margin_v - y_offset

        # 폰트 두께 변환 (ASS: -1=보통, 0=얇게, 1=굵게)
        bold = -1  # 기본값
        if font_weight:
            try:
                weight_int = int(font_weight)
                if weight_int >= 700:
                    bold = 1
                elif weight_int <= 300:
                    bold = 0
            except:
                if font_weight.lower() in ['bold', 'bolder', 'heavy']:
                    bold = 1
                elif font_weight.lower() in ['light', 'lighter', 'thin']:
                    bold = 0

        # 그림자 설정
        shadow = 1 if shadow_enabled else 0
        shadow_dist = int(shadow_blur) // 2  # 블러 값을 거리로 변환

        # ASS 헤더 (동적 스타일 적용)
        ass_content = f"""[Script Info]
Title: Generated Subtitle
ScriptType: v4.00+
Collisions: Normal
PlayDepth: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_family},{font_size},{primary_color},&H000088EF,{outline_color_ass},{back_color},{bold},0,0,0,100,100,0,0,1,{outline_width},{shadow},{ass_alignment},10,10,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

        # SRT 파싱
        subtitle_blocks = re.split(r'\n\s*\n', srt_data.strip())
        block_count = 0

        for block in subtitle_blocks:
            lines = block.strip().split('\n')
            if len(lines) < 3:
                continue

            # 두 번째 줄: 타임스탬프
            timestamp_line = lines[1]
            match = re.match(r'(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})', timestamp_line)

            if not match:
                continue

            start_time = f"{match.group(1)}.{match.group(2)[:2]}"  # HH:MM:SS.CS (centiseconds)
            end_time = f"{match.group(3)}.{match.group(4)[:2]}"

            # 세 번째 줄부터: 자막 텍스트 (여러 줄 가능)
            text = ' '.join(lines[2:]).replace('\n', ' ')

            # ASS 이벤트 추가
            ass_content += f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text}\n"
            block_count += 1

        print(f"[SRT to ASS Debug] {block_count}개 자막 블록 변환 완료")
        return ass_content

    def _create_segment(self, visual_url: Optional[str], audio_url: Optional[str],
                       duration: float, output_path: str,
                       progress_callback: Optional[Callable] = None,
                       video_volume: float = 1.0,
                       resolution: Optional[str] = None) -> bool:
        """단일 씬 세그먼트 생성 (개선된 버전)"""
        temp_dir = None
        try:
            # 해상도 결정 (오버라이드 우선)
            target_resolution = resolution if resolution else self.resolution
            # "shorts" 등의 별칭 처리
            if target_resolution.lower() in self.RESOLUTION_MAP:
                target_resolution = self.RESOLUTION_MAP[target_resolution.lower()]
                
            temp_dir = tempfile.mkdtemp()
            log_video_debug(f"[VideoService] 임시 디렉토리 생성: {temp_dir}")

            # FFmpeg 명령 구성
            cmd = ['ffmpeg', '-y']

            # Visual 입력 처리
            visual_path = None
            has_visual_audio = False
            if visual_url and visual_url != "undefined":
                try:
                    visual_ext = self._get_file_extension(visual_url)
                    visual_path = os.path.join(temp_dir, f'visual{visual_ext}')

                    log_video_debug(f"[VideoService] Visual 다운로드 중... (확장자: {visual_ext})")
                    self._download_file(visual_url, visual_path)

                    if not os.path.exists(visual_path):
                        raise Exception(f"Visual 파일이 생성되지 않음: {visual_path}")

                    # 비디오 파일인지 확인 및 오디오 스트림 확인
                    is_image = self._is_image(visual_ext)
                    if not is_image:
                        has_visual_audio = self._has_audio(visual_path)

                    if is_image:
                        # 이미지인 경우 루프
                        log_video_debug(f"[VideoService] 이미지 모드: 루프 재생")
                        cmd.extend(['-loop', '1', '-i', visual_path])
                    else:
                        # 비디오인 경우 (duration 제한은 -i 앞에 위치해야 해당 입력에만 적용됨)
                        log_video_debug(f"[VideoService] 비디오 모드 (오디오 스트림: {has_visual_audio})")
                        cmd.extend(['-t', str(duration), '-i', visual_path])

                except Exception as e:
                    log_video_debug(f"[X] Visual 처리 실패: {e}")
                    log_video_debug(f"[WARN] 검은 화면으로 대체")
                    visual_path = None
                    has_visual_audio = False

            if not visual_path:
                # 검은 화면
                log_video_debug(f"[VideoService] 검은 화면 사용")
                cmd.extend(['-f', 'lavfi', '-i', f'color=black:s={target_resolution}:d={duration}'])

            # Audio 입력 처리
            audio_path = None
            if audio_url and audio_url != "undefined":
                try:
                    # Fragment 처리 (#t=start,end)
                    audio_seek = 0.0
                    clean_audio_url = audio_url
                    
                    if '#t=' in audio_url:
                        clean_audio_url, fragment = audio_url.split('#t=')
                        try:
                            audio_seek = float(fragment.split(',')[0])
                        except:
                            pass

                    audio_ext = self._get_file_extension(clean_audio_url)
                    audio_path = os.path.join(temp_dir, f'audio{audio_ext}')

                    log_video_debug(f"[VideoService] Audio 다운로드 중... (확장자: {audio_ext}, Seek: {audio_seek}s)")
                    self._download_file(clean_audio_url, audio_path)

                    if not os.path.exists(audio_path):
                        raise Exception(f"Audio 파일이 생성되지 않음: {audio_path}")

                    # Seeking & Trimming
                    if audio_seek > 0:
                        cmd.extend(['-ss', str(audio_seek)])
                    
                    cmd.extend(['-t', str(duration)])
                    cmd.extend(['-i', audio_path])

                except Exception as e:
                    log_video_debug(f"[X] Audio 처리 실패: {e}")
                    log_video_debug(f"[WARN] 무음으로 대체")
                    audio_path = None

            if not audio_path:
                # 무음
                log_video_debug(f"[VideoService] 무음 사용")
                cmd.extend(['-f', 'lavfi', '-i', f'anullsrc=channel_layout=stereo:sample_rate=44100:d={duration}'])

            # 비디오 필터 구성 (자막 기능 제거 - Vrew 내보내기로 대체)
            w, h = target_resolution.split('x')
            v_filters = [
                f"scale={w}:{h}:force_original_aspect_ratio=decrease",
                f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2",
                "setsar=1/1"
            ]

            # FFmpeg 필터 구성 개선 (단순화된 버전)
            complex_filters = []
            
            # 비디오 필터
            complex_filters.append(f"[0:v]{','.join(v_filters)}[v_out]")
            
            # 오디오 필터 구성 - 모든 경우에 대해 단순화
            input_count = len(cmd) // 2  # -i 옵션의 개수 (대략적 추정)
            
            # video_volume이 0인 경우 완전 음소거 처리
            actual_volume = 0.000001 if video_volume == 0 else video_volume
            
            log_video_debug(f"[VideoService] video_volume 설정: {video_volume} -> 실제 적용 볼륨: {actual_volume}")
            log_video_debug(f"[VideoService] 입력 개수: {input_count}, 비주얼 오디오: {has_visual_audio}")
            
            # 오디오 처리 로직 개선 - video_volume 적용 보장
            if audio_path and has_visual_audio:
                # 비주얼 오디오 + TTS 오디오 모두 있는 경우
                complex_filters.append(f"[0:a]volume={actual_volume}[v_audio]")
                complex_filters.append(f"[v_audio][1:a]amix=inputs=2:duration=first[a_out]")
            elif audio_path and not has_visual_audio:
                # TTS 오디오만 있는 경우
                complex_filters.append(f"[1:a]volume={actual_volume}[a_out]")
            elif not audio_path and has_visual_audio:
                # 비주얼 오디오만 있는 경우
                complex_filters.append(f"[0:a]volume={actual_volume}[a_out]")
            else:
                # 무음
                complex_filters.append(f"[1:a]volume=1.0[a_out]")

            # FFmpeg filter_complex는 체인 구분자로 반드시 세미콜론(;) 사용 (공백 불가)
            filter_str = ';'.join(complex_filters)
            cmd.extend(['-filter_complex', filter_str])
            cmd.extend(['-map', '[v_out]', '-map', '[a_out]'])

            # 출력 옵션
            cmd.extend([
                '-c:v', 'libx264',
                '-preset', self.preset,
                '-pix_fmt', 'yuv420p',
                '-r', str(self.fps),
                '-b:v', self.bitrate,
                '-c:a', 'aac',
                '-b:a', '192k',
                '-ar', '44100',
                '-ac', '2',
                '-shortest',
                output_path
            ])
            
            # 볼륨 로깅
            if video_volume == 0:
                log_video_debug(f"[VideoService] 볼륨 0% 적용 (완전 음소거)")

            log_video_debug(f"\n[VideoService] FFmpeg 명령 실행:")
            log_video_debug(f"  {' '.join(cmd)}\n")

            # FFmpeg 실행 (현재 디렉토리를 temp_dir로 설정하여 ass=sub.ass가 동작)
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, errors='replace', cwd=temp_dir)

            if result.returncode != 0:
                log_video_debug(f"[X] FFmpeg 실행 실패 (코드: {result.returncode})")
                log_video_debug(f"[X] STDERR: {result.stderr[:500]}")
                if result.stdout:
                    log_video_debug(f"[X] STDOUT: {result.stdout[:500]}")
                return False

            # 출력 파일 확인
            if not os.path.exists(output_path):
                log_video_debug(f"[X] 출력 파일이 생성되지 않음: {output_path}")
                return False

            file_size = os.path.getsize(output_path)
            log_video_debug(f"[OK] 세그먼트 생성 완료: {output_path} ({file_size} bytes)")

            return True

        except Exception as e:
            log_video_debug(f"[X] 세그먼트 생성 오류: {e}")
            import traceback
            log_video_debug(traceback.format_exc())
            return False

        finally:
            # 임시 파일 정리
            if temp_dir and os.path.exists(temp_dir):
                try:
                    import shutil
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    log_video_debug(f"[OK] 임시 디렉토리 정리: {temp_dir}")
                except Exception as e:
                    log_video_debug(f"[WARN] 임시 디렉토리 정리 실패: {e}")

    def _create_empty_segment(self, duration: float, output_path: str, resolution: Optional[str] = None) -> bool:
        """빈 세그먼트 생성 (검은 화면 + 무음)"""
        try:
            # 해상도 결정
            target_resolution = resolution if resolution else self.resolution
            if target_resolution.lower() in self.RESOLUTION_MAP:
                target_resolution = self.RESOLUTION_MAP[target_resolution.lower()]
                
            log_video_debug(f"[VideoService] 빈 세그먼트 생성 중: {duration}초, {target_resolution}")
            
            # FFmpeg 명령: 검은 화면 + 무음
            cmd = [
                'ffmpeg', '-y',
                '-f', 'lavfi', '-i', f'color=black:s={target_resolution}:d={duration}',
                '-f', 'lavfi', '-i', f'anullsrc=channel_layout=stereo:sample_rate=44100:d={duration}',
                '-c:v', 'libx264',
                '-preset', self.preset,
                '-pix_fmt', 'yuv420p',
                '-r', str(self.fps),
                '-b:v', self.bitrate,
                '-c:a', 'aac',
                '-b:a', '192k',
                '-ar', '44100',
                '-ac', '2',
                '-shortest',
                output_path
            ]
            
            log_video_debug(f"[VideoService] 빈 세그먼트 FFmpeg 명령: {' '.join(cmd)}")
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60, errors='replace')
            
            if result.returncode != 0:
                log_video_debug(f"[X] 빈 세그먼트 생성 실패 (코드: {result.returncode})")
                log_video_debug(f"[X] STDERR: {result.stderr[:500]}")
                return False
                
            if not os.path.exists(output_path):
                log_video_debug(f"[X] 빈 세그먼트 파일이 생성되지 않음: {output_path}")
                return False
                
            file_size = os.path.getsize(output_path)
            log_video_debug(f"[OK] 빈 세그먼트 생성 완료: {output_path} ({file_size} bytes)")
            return True
            
        except Exception as e:
            log_video_debug(f"[X] 빈 세그먼트 생성 오류: {e}")
            import traceback
            log_video_debug(traceback.format_exc())
            return False

    def generate_final_video(self, merged_groups: List[Dict], standalone: List[Dict],
                            resolution: Optional[str] = None,
                            progress_callback: Optional[Callable] = None) -> str:
        """
        최종 영상 생성

        Args:
            merged_groups: 오디오가 병합된 씬 그룹
            standalone: 독립 씬
            subtitle_style: 자막 스타일 설정 (enabled, fontFamily, fontSize 등)
            resolution: 해상도 오버라이드 (예: "vertical", "shorts", "1080x1920")
            progress_callback: 진행률 콜백 함수

        Returns:
            생성된 영상 파일 URL
        """
        try:
            print("\n" + "="*60)
            print("최종 영상 생성 시작")
            print("="*60)

            if progress_callback:
                progress_callback(5, "영상 생성 준비 중...")

            # 모든 씬 수집
            all_scenes = []
            for group in merged_groups:
                all_scenes.extend(group.get('scenes', []))
            all_scenes.extend(standalone)

            if not all_scenes:
                raise ValueError("씬이 없습니다.")

            # 자막 스타일 설정 초기화
            subtitle_style = {} # No longer passed as arg, initialize empty
            subtitle_enabled = subtitle_style.get('enabled', False)

            print(f"[VideoService] 총 {len(all_scenes)}개 씬 처리")

            if progress_callback:
                progress_callback(10, f"{len(all_scenes)}개 씬 처리 중...")

            # 각 씬의 비디오/이미지 + 오디오를 처리
            video_files = []
            total_scenes = len(all_scenes)

            for i, scene in enumerate(all_scenes):
                visual_url = scene.get('visualUrl') or scene.get('generatedUrl')
                audio_url = scene.get('audioUrl')
                duration = scene.get('duration', 5)
                srt_data = scene.get('srtData') or scene.get('srt')
                scene_id = scene.get('sceneId', i+1)

                log_video_debug(f"\n[VideoService] 씬 {i+1}/{total_scenes} 처리 중 (ID: {scene_id})...")
                log_video_debug(f"  - Visual: {visual_url}")
                log_video_debug(f"  - Audio: {audio_url}")
                log_video_debug(f"  - Duration: {duration}초")
                log_video_debug(f"  - Scene data: {list(scene.keys())}")
                
                # 진행률 업데이트 (10% ~ 80%)
                progress = 10 + int((i / total_scenes) * 70)
                if progress_callback:
                    progress_callback(progress, f"씬 {i+1}/{total_scenes} 처리 중...")

                # 세그먼트 생성 (임시 폴더 사용)
                segment_file = os.path.join(self.processing_dir, f"segment_{i}_{uuid.uuid4().hex[:8]}.mp4")

                video_volume = scene.get('videoVolume', 1.0)

                # 자막 데이터 디버그 로그
                if subtitle_enabled:
                    if srt_data:
                        log_video_debug(f"  [Subtitle] SRT Data len: {len(srt_data)}")
                    else:
                        log_video_debug(f"  [Subtitle] WARN: No SRT Data found for scene {scene_id}")

                try:
                    success = self._create_segment(visual_url, audio_url, duration, segment_file,
                                                  progress_callback=progress_callback,
                                                  video_volume=video_volume,
                                                  resolution=resolution)

                    if success and os.path.exists(segment_file):
                        video_files.append(segment_file)
                        log_video_debug(f"[OK] 씬 {i+1} 세그먼트 생성 완료")
                    else:
                        log_video_debug(f"[WARN] 씬 {i+1} 세그먼트 생성 실패 - success={success}, file_exists={os.path.exists(segment_file) if segment_file else False}")
                        # 실패해도 계속 진행 (빈 세그먼트 대신 기본 세그먼트 생성)
                        log_video_debug(f"[INFO] 빈 세그먼트로 대체하여 계속 진행")
                        
                        # 빈 세그먼트 생성 (검은 화면 + 무음)
                        empty_segment_file = os.path.join(self.processing_dir, f"empty_{i}_{uuid.uuid4().hex[:8]}.mp4")
                        empty_success = self._create_empty_segment(duration, empty_segment_file, resolution)
                        if empty_success and os.path.exists(empty_segment_file):
                            video_files.append(empty_segment_file)
                            log_video_debug(f"[OK] 씬 {i+1} 빈 세그먼트 생성 완료")
                        
                except Exception as e:
                    log_video_debug(f"[ERROR] 씬 {i+1} 처리 중 예외 발생: {e}")
                    import traceback
                    log_video_debug(traceback.format_exc())
                    # 예외 발생해도 계속 진행
                    log_video_debug(f"[INFO] 예외 발생으로 빈 세그먼트 생성")
                    try:
                        empty_segment_file = os.path.join(self.processing_dir, f"empty_except_{i}_{uuid.uuid4().hex[:8]}.mp4")
                        empty_success = self._create_empty_segment(duration, empty_segment_file, resolution)
                        if empty_success and os.path.exists(empty_segment_file):
                            video_files.append(empty_segment_file)
                            log_video_debug(f"[OK] 씬 {i+1} 예외 처리 후 빈 세그먼트 생성 완료")
                    except Exception as e2:
                        log_video_debug(f"[CRITICAL] 빈 세그먼트 생성도 실패: {e2}")

            if not video_files:
                raise ValueError("생성된 세그먼트가 없습니다.")

            print(f"\n[VideoService] 총 {len(video_files)}개 세그먼트 생성 완료")

            if progress_callback:
                progress_callback(85, "영상 합성 중...")

            # 모든 세그먼트 병합
            final_filename = f"final_video_{uuid.uuid4().hex[:8]}.mp4"
            final_path = os.path.join(self.output_dir, final_filename)

            if len(video_files) == 1:
                # 세그먼트가 1개면 그냥 복사
                import shutil
                shutil.copy(video_files[0], final_path)
                print(f"[OK] 단일 세그먼트 복사 완료")
            else:
                # 여러 세그먼트 병합
                concat_file = os.path.join(self.processing_dir, f"concat_{uuid.uuid4().hex[:8]}.txt")
                with open(concat_file, 'w') as f:
                    for vf in video_files:
                        # Windows 경로를 FFmpeg 형식으로 변환
                        safe_path = vf.replace('\\', '/')
                        f.write(f"file '{safe_path}'\n")

                # 오디오 끊김 방지를 위해 오디오는 재인코딩, 비디오는 복사
                concat_cmd = [
                    'ffmpeg', '-y',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', concat_file,
                    '-c:v', 'copy',           # 비디오는 복사 (빠름)
                    '-c:a', 'aac',            # 오디오는 AAC로 재인코딩 (끊김 방지)
                    '-b:a', '192k',           # 오디오 비트레이트
                    '-ar', '44100',           # 샘플레이트 통일
                    '-ac', '2',               # 스테레오
                    final_path
                ]

                print(f"[VideoService] 세그먼트 병합 중... (오디오 재인코딩으로 끊김 방지)")
                print(f"[VideoService] FFmpeg 명령: {' '.join(concat_cmd)}")

                result = subprocess.run(concat_cmd, capture_output=True, text=True, timeout=300)

                if result.returncode != 0:
                    print(f"[X] FFmpeg 병합 오류: {result.stderr}")
                    raise Exception("영상 병합 실패")

                # 임시 파일 정리
                os.remove(concat_file)
                for vf in video_files:
                    if os.path.exists(vf):
                        os.remove(vf)

            if progress_callback:
                progress_callback(100, "영상 생성 완료!")

            print(f"[OK] 최종 영상 생성 완료: {final_filename}")
            print("="*60 + "\n")

            return f"/output/{final_filename}"

        except Exception as e:
            print(f"[X] Video generation error: {e}")
            import traceback
            traceback.print_exc()
            raise

    def get_status(self) -> Dict[str, Any]:
        """서비스 상태 조회"""
        return {
            "available": True,
            "resolution": self.resolution,
            "fps": self.fps,
            "preset": self.preset
        }

    def get_settings(self) -> Dict[str, Any]:
        """현재 설정 조회"""
        return {
            "resolution": self.resolution,
            "fps": self.fps,
            "preset": self.preset,
            "bitrate": self.bitrate
        }

    def update_settings(self, resolution: Optional[str] = None,
                       fps: Optional[int] = None,
                       preset: Optional[str] = None,
                       bitrate: Optional[str] = None) -> Dict[str, Any]:
        """설정 업데이트 (문자열 해상도를 FFmpeg 형식으로 변환)"""
        if resolution:
            # "1080p" 같은 형식을 "1920x1080"으로 변환 시도
            mapped_res = self.RESOLUTION_MAP.get(resolution.lower())
            if mapped_res:
                self.resolution = mapped_res
                print(f"[VideoService] 해상도 변경: {resolution} -> {mapped_res}")
            else:
                # 이미 "1920x1080" 형식인 경우 그대로 사용
                self.resolution = resolution
                print(f"[VideoService] 해상도 직접 설정: {resolution}")
                
        if fps:
            self.fps = fps
        if preset:
            self.preset = preset
        if bitrate:
            self.bitrate = bitrate
            
        return {"success": True, "settings": self.get_settings()}

    def get_usage_stats(self) -> Dict[str, Any]:
        """사용량 통계"""
        return {
            "total_videos": 0,
            "total_duration": 0
        }

# 싱글톤 인스턴스
video_service = VideoService()
