"""
Vrew Batch Service
외부 TTS + 대량 미디어 파일을 자동으로 매칭하여 Vrew 프로젝트 생성

사용 시나리오:
1. 외부에서 만든 TTS 파일들 (audio_001.mp3, audio_002.mp3, ...)
2. 타임스탬프 파일들 (timestamps_001.json, ...)
3. 영상/이미지 파일들 (visual_001.png, visual_002.mp4, ...)
→ 자동으로 넘버링 매칭 + 싱크 맞춰서 vrew 파일 생성
"""

import os
import re
import json
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from dataclasses import dataclass

from .vrew_formatter import VrewProjectBuilder
from .tts_base import WordTimestamp
from .utils import OUTPUT_DIR
from .whisper_service import whisper_service


@dataclass
class MediaSet:
    """하나의 씬을 구성하는 미디어 셋"""
    index: int                    # 순서 번호 (001, 002, ...)
    audio_path: Optional[str]     # 오디오 파일 경로
    timestamp_path: Optional[str] # 타임스탬프 파일 경로
    visual_path: Optional[str]    # 비주얼 파일 경로 (이미지 or 비디오)

    def is_valid(self) -> bool:
        """유효한 셋인지 확인 (최소한 오디오와 타임스탬프가 있어야 함)"""
        return self.audio_path is not None and self.timestamp_path is not None


class VrewBatchService:
    """
    대량 미디어 파일을 자동으로 매칭하여 Vrew 프로젝트 생성
    """

    def __init__(self):
        self.output_dir = OUTPUT_DIR
        print("[OK] Vrew Batch Service 초기화 완료")

    def create_from_folder(
        self,
        audio_folder: str,
        timestamp_folder: Optional[str] = None,
        visual_folder: Optional[str] = None,
        output_filename: Optional[str] = None,
        auto_generate_timestamps: bool = False
    ) -> Tuple[str, Optional[List[Dict[str, Any]]]]:
        """
        폴더 구조에서 자동으로 파일들을 매칭하여 Vrew 프로젝트 생성

        Args:
            audio_folder: 오디오 파일들이 있는 폴더
            timestamp_folder: 타임스탬프 JSON 파일들이 있는 폴더 (auto_generate_timestamps=True이면 선택)
            visual_folder: 비주얼 파일들이 있는 폴더 (선택)
            output_filename: 출력 파일명 (선택)
            auto_generate_timestamps: True이면 Whisper로 타임스탬프 자동 생성

        Returns:
            생성된 .vrew 파일 URL
        """
        print("\n" + "="*60)
        print("Vrew 배치 프로젝트 생성 시작")
        print("="*60)

        # 1. 파일 스캔 및 매칭
        if auto_generate_timestamps:
            print("[Batch] 타임스탬프 자동 생성 모드 (Whisper)")
            media_sets = self._scan_and_match_files(
                audio_folder,
                None,  # 타임스탬프 폴더 무시
                visual_folder
            )
        else:
            if not timestamp_folder:
                raise ValueError("타임스탬프 폴더가 지정되지 않았습니다.")
            media_sets = self._scan_and_match_files(
                audio_folder,
                timestamp_folder,
                visual_folder
            )

        if not media_sets:
            raise ValueError("매칭되는 파일 셋을 찾을 수 없습니다.")

        print(f"\n[Batch] 총 {len(media_sets)}개 씬 매칭됨")

        # 2. VrewProjectBuilder로 빌드
        builder = VrewProjectBuilder()
        generated_transcripts = [] if auto_generate_timestamps else None

        for media_set in media_sets:
            print(f"\n[Batch] 씬 {media_set.index} 처리 중...")
            print(f"  - Audio: {Path(media_set.audio_path).name}")

            # 타임스탬프 로드/생성
            if auto_generate_timestamps:
                # Whisper로 자동 생성
                print(f"  - Whisper로 타임스탬프 자동 생성 중...")
                try:
                    timestamps, full_text = whisper_service.transcribe_audio(media_set.audio_path)
                    # 생성된 전사 정보 저장
                    generated_transcripts.append({
                        "index": media_set.index,
                        "audio_file": Path(media_set.audio_path).name,
                        "text": full_text,
                        "timestamp_count": len(timestamps)
                    })
                except Exception as e:
                    print(f"  ⚠️ Whisper 처리 실패: {e}, 스킵")
                    import traceback
                    traceback.print_exc()
                    continue
            else:
                # JSON에서 로드
                print(f"  - Timestamp: {Path(media_set.timestamp_path).name}")
                timestamps = self._load_timestamps(media_set.timestamp_path)

                if not timestamps:
                    print(f"  ⚠️ 타임스탬프 로드 실패, 스킵")
                    continue

            if media_set.visual_path:
                print(f"  - Visual: {Path(media_set.visual_path).name}")

            print(f"  - Timestamps: {len(timestamps)}개")

            # 씬 추가
            builder.add_scene(
                timestamps=timestamps,
                audio_path=media_set.audio_path,
                visual_path=media_set.visual_path,
                scene_id=str(media_set.index)
            )

        # 3. 최종 빌드
        print(f"\n[Batch] Vrew 프로젝트 빌드 중...")
        vrew_url = builder.build(output_filename=output_filename)

        print(f"[OK] Vrew 배치 프로젝트 생성 완료!")
        if generated_transcripts:
            print(f"[OK] {len(generated_transcripts)}개 씬의 타임스탬프 자동 생성 완료")
        print("="*60 + "\n")

        return vrew_url, generated_transcripts

    def create_from_file_lists(
        self,
        audio_files: List[str],
        timestamp_files: List[str],
        visual_files: Optional[List[str]] = None,
        output_filename: Optional[str] = None
    ) -> str:
        """
        파일 리스트에서 직접 Vrew 프로젝트 생성 (수동 매칭)

        Args:
            audio_files: 오디오 파일 경로 리스트
            timestamp_files: 타임스탬프 파일 경로 리스트
            visual_files: 비주얼 파일 경로 리스트 (선택, 길이가 다를 수 있음)
            output_filename: 출력 파일명 (선택)

        Returns:
            생성된 .vrew 파일 URL
        """
        print("\n" + "="*60)
        print("Vrew 배치 프로젝트 생성 (파일 리스트)")
        print("="*60)

        if len(audio_files) != len(timestamp_files):
            raise ValueError(
                f"오디오 파일 개수({len(audio_files)})와 "
                f"타임스탬프 파일 개수({len(timestamp_files)})가 다릅니다."
            )

        visual_files = visual_files or []

        # 미디어 셋 생성
        media_sets = []
        for i, (audio, timestamp) in enumerate(zip(audio_files, timestamp_files)):
            visual = visual_files[i] if i < len(visual_files) else None

            media_sets.append(MediaSet(
                index=i + 1,
                audio_path=audio,
                timestamp_path=timestamp,
                visual_path=visual
            ))

        print(f"[Batch] 총 {len(media_sets)}개 씬 처리 예정")

        # VrewProjectBuilder로 빌드
        builder = VrewProjectBuilder()

        for media_set in media_sets:
            print(f"\n[Batch] 씬 {media_set.index}/{len(media_sets)} 처리 중...")

            # 타임스탬프 로드
            timestamps = self._load_timestamps(media_set.timestamp_path)

            if not timestamps:
                print(f"  ⚠️ 타임스탬프 로드 실패, 스킵")
                continue

            # 씬 추가
            builder.add_scene(
                timestamps=timestamps,
                audio_path=media_set.audio_path,
                visual_path=media_set.visual_path,
                scene_id=str(media_set.index)
            )

        # 최종 빌드
        print(f"\n[Batch] Vrew 프로젝트 빌드 중...")
        vrew_url = builder.build(output_filename=output_filename)

        print(f"[OK] Vrew 배치 프로젝트 생성 완료!")
        print("="*60 + "\n")

        return vrew_url

    def _scan_and_match_files(
        self,
        audio_folder: str,
        timestamp_folder: Optional[str],
        visual_folder: Optional[str] = None
    ) -> List[MediaSet]:
        """
        폴더를 스캔하고 넘버링으로 파일들을 자동 매칭

        매칭 규칙:
        - 파일명에서 숫자 추출 (001, 002, 01, 02, 1, 2 등)
        - 같은 숫자를 가진 파일들을 하나의 셋으로 매칭
        - 오디오는 필수, 타임스탬프와 비주얼은 선택 (자동 생성 모드 시)
        """
        print("\n[Batch] 파일 스캔 중...")

        # 각 폴더에서 파일 스캔
        audio_files = self._scan_folder(audio_folder, ['.mp3', '.wav', '.m4a'])
        timestamp_files = []
        if timestamp_folder:
            timestamp_files = self._scan_folder(timestamp_folder, ['.json'])
        visual_files = []
        if visual_folder:
            visual_files = self._scan_folder(
                visual_folder,
                ['.png', '.jpg', '.jpeg', '.mp4', '.avi', '.mov']
            )

        print(f"  - 오디오: {len(audio_files)}개")
        print(f"  - 타임스탬프: {len(timestamp_files)}개")
        print(f"  - 비주얼: {len(visual_files)}개")

        # 넘버링으로 그룹화
        audio_dict = self._group_by_number(audio_files)
        timestamp_dict = self._group_by_number(timestamp_files) if timestamp_files else {}
        visual_dict = self._group_by_number(visual_files)

        # 인덱스 수집
        if timestamp_dict:
            # 타임스탬프 폴더가 있으면 오디오와 타임스탬프 공통
            common_indices = set(audio_dict.keys()) & set(timestamp_dict.keys())
        else:
            # 자동 생성 모드면 오디오만
            common_indices = set(audio_dict.keys())

        if not common_indices:
            print("  ⚠️ 매칭되는 파일이 없습니다!")
            return []

        # MediaSet 생성
        media_sets = []
        for idx in sorted(common_indices):
            media_set = MediaSet(
                index=idx,
                audio_path=audio_dict[idx],
                timestamp_path=timestamp_dict.get(idx),  # 없을 수도 있음
                visual_path=visual_dict.get(idx)  # 비주얼은 없을 수도 있음
            )

            # 자동 생성 모드에서는 오디오만 있으면 OK
            if media_set.audio_path:
                media_sets.append(media_set)

        print(f"\n[Batch] 매칭 결과:")
        for ms in media_sets:
            ts_status = '✓ 타임스탬프' if ms.timestamp_path else '✗ 타임스탬프 (자동생성)'
            print(f"  #{ms.index:03d}: ✓ 오디오 {ts_status} {'✓ 비주얼' if ms.visual_path else '✗ 비주얼'}")

        return media_sets

    def _scan_folder(self, folder: str, extensions: List[str]) -> List[str]:
        """폴더에서 특정 확장자 파일들 스캔"""
        if not os.path.exists(folder):
            return []

        files = []
        for file in os.listdir(folder):
            if any(file.lower().endswith(ext) for ext in extensions):
                files.append(os.path.join(folder, file))

        return sorted(files)

    def _group_by_number(self, file_paths: List[str]) -> Dict[int, str]:
        """
        파일명에서 숫자를 추출하여 그룹화

        예:
        - "001_audio.mp3" -> 1
        - "scene_002.mp3" -> 2
        - "audio-003.mp3" -> 3
        - "clip_01.mp3" -> 1
        """
        grouped = {}

        for path in file_paths:
            filename = Path(path).stem  # 확장자 제외

            # 숫자 패턴 찾기 (연속된 숫자)
            numbers = re.findall(r'\d+', filename)

            if numbers:
                # 첫 번째 숫자를 인덱스로 사용
                idx = int(numbers[0])

                # 중복이 있으면 경고
                if idx in grouped:
                    print(f"  ⚠️ 중복 인덱스 {idx}: {Path(path).name} (기존: {Path(grouped[idx]).name})")
                else:
                    grouped[idx] = path

        return grouped

    def _load_timestamps(self, timestamp_path: str) -> List[WordTimestamp]:
        """
        타임스탬프 JSON 파일 로드

        지원 형식:
        1. 표준 형식 (start_ms, end_ms, text)
        2. SRT 형식 (startTime, endTime 문자열)
        3. Vrew 형식 (startTime, duration 초 단위)
        """
        try:
            with open(timestamp_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # 리스트가 아니면 에러
            if not isinstance(data, list):
                print(f"  ⚠️ 타임스탬프 형식 오류: 리스트가 아님")
                return []

            timestamps = []

            for item in data:
                # 형식 1: start_ms, end_ms, text
                if 'start_ms' in item and 'end_ms' in item:
                    timestamps.append(WordTimestamp(
                        text=item.get('text', ''),
                        start_ms=item['start_ms'],
                        end_ms=item['end_ms']
                    ))

                # 형식 2: start, end (초 단위), text
                elif 'start' in item and 'end' in item:
                    timestamps.append(WordTimestamp(
                        text=item.get('text', ''),
                        start_ms=int(item['start'] * 1000),
                        end_ms=int(item['end'] * 1000)
                    ))

                # 형식 3: startTime, duration (초 단위), text
                elif 'startTime' in item and 'duration' in item:
                    start_sec = item['startTime']
                    duration_sec = item['duration']
                    timestamps.append(WordTimestamp(
                        text=item.get('text', ''),
                        start_ms=int(start_sec * 1000),
                        end_ms=int((start_sec + duration_sec) * 1000)
                    ))

                else:
                    print(f"  ⚠️ 알 수 없는 타임스탬프 형식: {item}")

            return timestamps

        except Exception as e:
            print(f"  ⚠️ 타임스탬프 로드 실패: {e}")
            return []


# 싱글톤 인스턴스
vrew_batch_service = VrewBatchService()
