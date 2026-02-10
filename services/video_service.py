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

class VideoService:
    """최종 영상 합성 서비스"""

    def __init__(self):
        self.output_dir = OUTPUT_DIR
        self.resolution = "1920x1080"
        self.fps = 30
        self.preset = "medium"
        self.bitrate = "5000k"

        # FFmpeg 설치 확인
        self._check_ffmpeg()

        print("[OK] Video Service 초기화 완료")

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

    def _download_file(self, url: str, output_path: str):
        """URL에서 파일 다운로드 (http:// 또는 data: URI)"""
        try:
            if url.startswith('data:'):
                # Base64 데이터 URI 처리
                import base64
                header, data = url.split(',', 1)
                decoded = base64.b64decode(data)
                with open(output_path, 'wb') as f:
                    f.write(decoded)
                print(f"[OK] Base64 데이터 저장: {output_path} ({len(decoded)} bytes)")
            else:
                # HTTP URL에서 다운로드
                print(f"[Download] {url[:80]}... -> {output_path}")
                urllib.request.urlretrieve(url, output_path)
                print(f"[OK] 다운로드 완료: {output_path}")

            # 파일 존재 확인
            if not os.path.exists(output_path):
                raise Exception(f"파일 생성 실패: {output_path}")

        except Exception as e:
            print(f"[X] 파일 다운로드 실패: {e}")
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

    def _srt_to_ass(self, srt_data: str) -> str:
        """
        SRT 자막을 ASS 형식으로 변환
        ASS는 FFmpeg에서 더 안정적으로 지원되며 스타일 커스터마이징 가능
        """
        import re

        # ASS 헤더
        ass_content = """[Script Info]
Title: Generated Subtitle
ScriptType: v4.00+
Collisions: Normal
PlayDepth: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Pretendard,48,&H00FFFFFF,&H000088EF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,10,10,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

        # SRT 파싱
        # SRT 형식:
        # 1
        # 00:00:00,000 --> 00:00:02,500
        # 자막 텍스트
        #
        # 2
        # 00:00:02,500 --> 00:00:05,000
        # 다음 자막

        subtitle_blocks = re.split(r'\n\s*\n', srt_data.strip())

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
            # Dialogue: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
            ass_content += f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text}\n"

        return ass_content

    def _create_segment(self, visual_url: Optional[str], audio_url: Optional[str],
                       duration: float, output_path: str, srt_data: Optional[str] = None,
                       subtitle_enabled: bool = True, progress_callback: Optional[Callable] = None) -> bool:
        """단일 씬 세그먼트 생성"""
        temp_dir = None
        try:
            temp_dir = tempfile.mkdtemp()
            print(f"[VideoService] 임시 디렉토리 생성: {temp_dir}")

            # FFmpeg 명령 구성
            cmd = ['ffmpeg', '-y']

            # Visual 입력
            visual_path = None
            if visual_url:
                try:
                    visual_ext = self._get_file_extension(visual_url)
                    visual_path = os.path.join(temp_dir, f'visual{visual_ext}')

                    print(f"[VideoService] Visual 다운로드 중... (확장자: {visual_ext})")
                    self._download_file(visual_url, visual_path)

                    if not os.path.exists(visual_path):
                        raise Exception(f"Visual 파일이 생성되지 않음: {visual_path}")

                    if self._is_image(visual_ext):
                        # 이미지인 경우 루프
                        print(f"[VideoService] 이미지 모드: 루프 재생")
                        cmd.extend(['-loop', '1', '-i', visual_path, '-t', str(duration)])
                    else:
                        # 비디오인 경우
                        print(f"[VideoService] 비디오 모드")
                        cmd.extend(['-i', visual_path, '-t', str(duration)])

                except Exception as e:
                    print(f"[X] Visual 처리 실패: {e}")
                    print(f"[WARN] 검은 화면으로 대체")
                    visual_url = None  # 실패 시 검은 화면 사용

            if not visual_url:
                # 검은 화면
                print(f"[VideoService] 검은 화면 사용")
                cmd.extend(['-f', 'lavfi', '-i', f'color=black:s={self.resolution}:d={duration}'])

            # Audio 입력
            audio_path = None
            if audio_url:
                try:
                    audio_ext = self._get_file_extension(audio_url)
                    audio_path = os.path.join(temp_dir, f'audio{audio_ext}')

                    print(f"[VideoService] Audio 다운로드 중... (확장자: {audio_ext})")
                    self._download_file(audio_url, audio_path)

                    if not os.path.exists(audio_path):
                        raise Exception(f"Audio 파일이 생성되지 않음: {audio_path}")

                    cmd.extend(['-i', audio_path])

                except Exception as e:
                    print(f"[X] Audio 처리 실패: {e}")
                    print(f"[WARN] 무음으로 대체")
                    audio_url = None  # 실패 시 무음 사용

            if not audio_url:
                # 무음
                print(f"[VideoService] 무음 사용")
                cmd.extend(['-f', 'lavfi', '-i', f'anullsrc=channel_layout=stereo:sample_rate=44100:d={duration}'])

            # 자막 처리
            subtitle_filter = None
            if subtitle_enabled and srt_data:
                try:
                    print(f"[VideoService] ✅ 자막 처리 시작 (enabled={subtitle_enabled}, srt_data 길이={len(srt_data)})")
                    # SRT를 ASS로 변환 (FFmpeg가 더 잘 지원)
                    ass_path = os.path.join(temp_dir, 'sub.ass')
                    ass_content = self._srt_to_ass(srt_data)

                    with open(ass_path, 'w', encoding='utf-8') as f:  # UTF-8 without BOM
                        f.write(ass_content)
                    print(f"[VideoService] ✅ ASS 자막 파일 생성 성공: {ass_path}")
                    print(f"[VideoService] 원본 SRT 길이: {len(srt_data)} 글자")
                    print(f"[VideoService] 변환된 ASS 길이: {len(ass_content)} 글자")

                    # Windows 경로를 FFmpeg 형식으로 변환 (간단한 방법)
                    # 백슬래시를 슬래시로 변경
                    ffmpeg_path = ass_path.replace('\\', '/')

                    # ass 필터 사용 (Windows에서 더 안정적)
                    subtitle_filter = f"ass={ffmpeg_path}"

                    print(f"[VideoService] 원본 경로: {ass_path}")
                    print(f"[VideoService] FFmpeg 경로: {ffmpeg_path}")
                    print(f"[VideoService] ✅ 자막 필터 설정: {subtitle_filter}")
                except Exception as e:
                    print(f"[X] 자막 처리 실패: {e}")
                    import traceback
                    traceback.print_exc()
                    subtitle_filter = None
            elif not subtitle_enabled:
                print(f"[VideoService] ⚠️ 자막 비활성화됨 (subtitle_enabled=False)")
            elif not srt_data:
                print(f"[VideoService] ⚠️ SRT 데이터 없음 (씬에 srtData가 없습니다)")

            # 출력 옵션 (오디오 끊김 방지를 위해 샘플레이트와 채널 통일)
            if subtitle_filter:
                # 자막이 있으면 비디오 필터 추가
                cmd.extend([
                    '-vf', subtitle_filter,
                    '-c:v', 'libx264',
                    '-preset', self.preset,
                    '-pix_fmt', 'yuv420p',
                    '-b:v', self.bitrate,
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-ar', '44100',         # 샘플레이트 통일
                    '-ac', '2',             # 스테레오
                    '-shortest',
                    output_path
                ])
            else:
                # 자막 없으면 기본 옵션
                cmd.extend([
                    '-c:v', 'libx264',
                    '-preset', self.preset,
                    '-pix_fmt', 'yuv420p',
                    '-b:v', self.bitrate,
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-ar', '44100',         # 샘플레이트 통일
                    '-ac', '2',             # 스테레오
                    '-shortest',
                    output_path
                ])

            print(f"\n[VideoService] FFmpeg 명령 실행:")
            print(f"  {' '.join(cmd)}\n")

            # FFmpeg 실행
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

            if result.returncode != 0:
                print(f"[X] FFmpeg 실행 실패 (코드: {result.returncode})")
                print(f"[X] STDERR: {result.stderr}")
                if result.stdout:
                    print(f"[X] STDOUT: {result.stdout}")
                return False

            # 출력 파일 확인
            if not os.path.exists(output_path):
                print(f"[X] 출력 파일이 생성되지 않음: {output_path}")
                return False

            file_size = os.path.getsize(output_path)
            print(f"[OK] 세그먼트 생성 완료: {output_path} ({file_size} bytes)")

            return True

        except Exception as e:
            print(f"[X] 세그먼트 생성 오류: {e}")
            import traceback
            traceback.print_exc()
            return False

        finally:
            # 임시 파일 정리
            if temp_dir and os.path.exists(temp_dir):
                try:
                    import shutil
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    print(f"[OK] 임시 디렉토리 정리: {temp_dir}")
                except Exception as e:
                    print(f"[WARN] 임시 디렉토리 정리 실패: {e}")

    def generate_final_video(self, merged_groups: List[Dict], standalone: List[Dict],
                            subtitle_style: Optional[Dict] = None,
                            progress_callback: Optional[Callable] = None) -> str:
        """
        최종 영상 생성

        Args:
            merged_groups: 오디오가 병합된 씬 그룹
            standalone: 독립 씬
            subtitle_style: 자막 스타일 설정 (enabled, fontFamily, fontSize 등)
            progress_callback: 진행률 콜백 함수

        Returns:
            생성된 영상 파일 URL
        """
        try:
            print("\n" + "="*60)
            print("최종 영상 생성 시작")
            print("="*60)

            # 자막 설정 파싱
            subtitle_enabled = False
            if subtitle_style and isinstance(subtitle_style, dict):
                subtitle_enabled = subtitle_style.get('enabled', True)  # 기본값은 True
                print(f"[VideoService] 자막 설정: {'활성화' if subtitle_enabled else '비활성화'}")
                if subtitle_enabled:
                    print(f"[VideoService] 자막 스타일: {subtitle_style}")

            if progress_callback:
                progress_callback(5, "영상 생성 준비 중...")

            # 모든 씬 수집
            all_scenes = []
            for group in merged_groups:
                all_scenes.extend(group.get('scenes', []))
            all_scenes.extend(standalone)

            if not all_scenes:
                raise ValueError("씬이 없습니다.")

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

                print(f"\n[VideoService] 씬 {i+1}/{total_scenes} 처리 중...")
                print(f"  - Visual: {visual_url[:50] if visual_url else 'None'}...")
                print(f"  - Audio: {audio_url[:50] if audio_url else 'None'}...")
                print(f"  - Duration: {duration}초")
                print(f"  - Subtitle Data 존재: {'Yes' if srt_data else 'No'}")
                if srt_data:
                    print(f"  - Subtitle Data 길이: {len(srt_data)} 글자")
                    print(f"  - Subtitle Data 미리보기: {srt_data[:100]}...")
                print(f"  - Subtitle Enabled: {subtitle_enabled}")

                # 진행률 업데이트 (10% ~ 80%)
                progress = 10 + int((i / total_scenes) * 70)
                if progress_callback:
                    progress_callback(progress, f"씬 {i+1}/{total_scenes} 처리 중...")

                # 세그먼트 생성
                segment_file = os.path.join(self.output_dir, f"segment_{i}_{uuid.uuid4().hex[:8]}.mp4")

                success = self._create_segment(visual_url, audio_url, duration, segment_file,
                                              srt_data=srt_data, subtitle_enabled=subtitle_enabled,
                                              progress_callback=progress_callback)

                if success and os.path.exists(segment_file):
                    video_files.append(segment_file)
                    print(f"[OK] 씬 {i+1} 세그먼트 생성 완료")
                else:
                    print(f"[WARN] 씬 {i+1} 세그먼트 생성 실패, 건너뜀")

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
                concat_file = os.path.join(self.output_dir, f"concat_{uuid.uuid4().hex[:8]}.txt")
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

            return f"http://localhost:8000/output/{final_filename}"

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
        """설정 업데이트"""
        if resolution:
            self.resolution = resolution
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
