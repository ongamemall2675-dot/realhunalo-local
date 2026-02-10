"""
Vrew Service
Vrew 프로젝트 파일 생성 및 내보내기
"""
from typing import Dict, Any
from services.utils import OUTPUT_DIR
from services.vrew_formatter import VrewProjectBuilder
from services.tts_base import WordTimestamp

class VrewService:
    """Vrew 프로젝트 파일 생성 서비스"""

    def __init__(self):
        self.output_dir = OUTPUT_DIR
        print("[OK] Vrew Service 초기화 완료")

    def generate_vrew_project(self, timeline_data: Dict[str, Any]) -> str:
        """
        Vrew 프로젝트 파일 생성 (올바른 ZIP 형식)

        Args:
            timeline_data: 타임라인 데이터 (씬, 오디오, 비디오 정보)

        Returns:
            생성된 Vrew 프로젝트 파일 URL
        """
        try:
            print("\n" + "="*60)
            print("Vrew 프로젝트 생성 시작")
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

            # VrewProjectBuilder 사용
            builder = VrewProjectBuilder()

            for i, scene in enumerate(all_scenes):
                scene_id = scene.get('sceneId', i+1)
                audio_url = scene.get('audioUrl')
                visual_url = scene.get('visualUrl') or scene.get('generatedUrl')
                srt_data = scene.get('srtData')

                print(f"\n[Vrew] 씬 {i+1}/{len(all_scenes)} 처리 중...")
                print(f"  - Audio: {'있음' if audio_url else '없음'}")
                print(f"  - Visual: {'있음' if visual_url else '없음'}")
                print(f"  - SRT: {'있음' if srt_data else '없음'}")

                # SRT 데이터가 있으면 타임스탬프 파싱
                timestamps = []
                if srt_data and audio_url:
                    timestamps = self._parse_srt_to_timestamps(srt_data)
                    print(f"  - Timestamps: {len(timestamps)}개")

                # 타임스탬프가 없으면 더미 타임스탬프 생성 (오디오 전체 길이)
                if audio_url and not timestamps:
                    print(f"  - SRT 없음, 더미 타임스탬프 생성")
                    # 기본 5초 duration 사용
                    duration = scene.get('duration', 5.0)
                    timestamps = [WordTimestamp(
                        text=scene.get('script', scene.get('originalScript', 'Scene audio')),
                        start_ms=0,
                        end_ms=int(duration * 1000)
                    )]

                # 씬 추가 (오디오가 있을 때만)
                if audio_url and timestamps:
                    builder.add_scene(
                        timestamps=timestamps,
                        audio_path=audio_url,
                        visual_path=visual_url,
                        scene_id=str(scene_id)
                    )
                else:
                    print(f"  ⚠️ 씬 {scene_id}: 오디오 없음, 스킵")

            # 최종 빌드
            print(f"\n[Vrew] 프로젝트 빌드 중...")
            vrew_url = builder.build()

            print(f"[OK] Vrew 프로젝트 생성 완료!")
            print("="*60 + "\n")

            return vrew_url

        except Exception as e:
            print(f"[X] Vrew export error: {e}")
            import traceback
            traceback.print_exc()
            raise

    def _parse_srt_to_timestamps(self, srt_content: str) -> list:
        """
        SRT 자막을 WordTimestamp 리스트로 변환

        Args:
            srt_content: SRT 형식의 자막 데이터

        Returns:
            WordTimestamp 리스트
        """
        if not srt_content:
            print(f"  [SRT Parser] srtContent가 비어있음")
            return []

        timestamps = []
        blocks = srt_content.strip().split('\n\n')

        print(f"  [SRT Parser] {len(blocks)}개 블록 발견")

        for i, block in enumerate(blocks):
            lines = block.strip().split('\n')
            if len(lines) < 3:
                print(f"  [SRT Parser] 블록 {i+1}: 라인 수 부족 ({len(lines)}개)")
                continue

            # 타임라인 파싱 (00:00:00,000 --> 00:00:01,000)
            timeline = lines[1]
            if '-->' not in timeline:
                print(f"  [SRT Parser] 블록 {i+1}: '-->' 없음")
                continue

            try:
                start_str, end_str = timeline.split('-->')
                start_ms = self._srt_time_to_ms(start_str.strip())
                end_ms = self._srt_time_to_ms(end_str.strip())

                # 텍스트
                text = ' '.join(lines[2:]).strip()

                timestamps.append(WordTimestamp(
                    text=text,
                    start_ms=start_ms,
                    end_ms=end_ms
                ))
            except Exception as e:
                print(f"  [SRT Parser] 블록 {i+1} 파싱 실패: {e}")
                continue

        print(f"  [SRT Parser] 총 {len(timestamps)}개 타임스탬프 생성")
        return timestamps

    def _srt_time_to_ms(self, time_str: str) -> int:
        """SRT 시간 형식을 밀리초로 변환 (00:00:05,500 -> 5500)"""
        try:
            # 00:00:05,500 형식
            time_part, ms_part = time_str.split(',')
            h, m, s = map(int, time_part.split(':'))
            ms = int(ms_part)
            return (h * 3600 + m * 60 + s) * 1000 + ms
        except:
            return 0

# 싱글톤 인스턴스
vrew_service = VrewService()
