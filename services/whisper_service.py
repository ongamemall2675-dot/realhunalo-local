"""
OpenAI Whisper 서비스
음성 파일에서 타임스탬프 추출
"""

import os
import json
from openai import OpenAI
from typing import List
from .tts_base import WordTimestamp


class WhisperService:
    """OpenAI Whisper API를 사용한 음성 인식 서비스"""

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            print("⚠️ OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.")
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None

    def transcribe_audio(self, audio_path: str) -> tuple[List[WordTimestamp], str]:
        """
        오디오 파일을 텍스트로 변환하고 타임스탬프 추출

        Args:
            audio_path: 오디오 파일 경로

        Returns:
            (WordTimestamp 리스트, 전체 텍스트) 튜플
        """
        if not self.client:
            raise ValueError("OpenAI API 키가 설정되지 않았습니다. OPENAI_API_KEY 환경 변수를 설정하세요.")

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다: {audio_path}")

        # 파일 크기 및 형식 확인
        file_size = os.path.getsize(audio_path) / (1024 * 1024)  # MB
        file_ext = os.path.splitext(audio_path)[1].lower()

        print(f"[Whisper] 음성 인식 시작: {os.path.basename(audio_path)}")
        print(f"  - 파일 형식: {file_ext}")
        print(f"  - 파일 크기: {file_size:.1f}MB")

        if file_size > 25:
            raise ValueError(f"파일 크기가 너무 큽니다: {file_size:.1f}MB (최대 25MB). WAV 파일은 MP3보다 용량이 큽니다. MP3로 변환하거나 압축하세요.")

        try:
            with open(audio_path, "rb") as audio_file:
                # OpenAI Whisper API 호출 (word-level timestamps)
                print(f"[Whisper] API 호출 중...")
                response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["word"]
                )
                print(f"[Whisper] API 응답 수신 완료")

            # 응답 파싱
            timestamps = []
            full_text = response.text if hasattr(response, 'text') else ""

            if hasattr(response, 'words') and response.words:
                # Word-level timestamps
                for word_data in response.words:
                    timestamps.append(WordTimestamp(
                        text=word_data.word.strip(),
                        start_ms=int(word_data.start * 1000),
                        end_ms=int(word_data.end * 1000)
                    ))
            elif hasattr(response, 'segments') and response.segments:
                # Segment-level timestamps (fallback)
                for segment in response.segments:
                    timestamps.append(WordTimestamp(
                        text=segment.text.strip(),
                        start_ms=int(segment.start * 1000),
                        end_ms=int(segment.end * 1000)
                    ))
            else:
                # 전체 텍스트만 있는 경우 (타임스탬프 없음)
                print(f"  ⚠️ 타임스탬프를 가져올 수 없습니다. 전체 텍스트로 대체합니다.")
                duration_ms = self._estimate_duration(audio_path)
                timestamps.append(WordTimestamp(
                    text=full_text,
                    start_ms=0,
                    end_ms=duration_ms
                ))

            print(f"[Whisper] 완료: {len(timestamps)}개 타임스탬프 추출")
            print(f"[Whisper] 전체 텍스트: {full_text[:100]}...")
            return timestamps, full_text

        except Exception as e:
            error_msg = str(e)
            print(f"[Whisper] 에러 발생!")
            print(f"  - 파일: {os.path.basename(audio_path)}")
            print(f"  - 형식: {file_ext}")
            print(f"  - 크기: {file_size:.1f}MB")
            print(f"  - 에러: {error_msg}")

            # WAV 파일 관련 에러인 경우 추가 안내
            if file_ext == '.wav':
                raise ValueError(
                    f"WAV 파일 처리 실패: {error_msg}\n"
                    f"팁: WAV 파일은 용량이 크거나 호환성 문제가 있을 수 있습니다. "
                    f"MP3로 변환하거나 샘플레이트를 낮춰보세요."
                )
            else:
                raise ValueError(f"Whisper 처리 실패: {error_msg}")

    def _estimate_duration(self, audio_path: str) -> int:
        """오디오 파일 길이 추정 (fallback)"""
        try:
            from pydub import AudioSegment
            audio = AudioSegment.from_file(audio_path)
            return len(audio)  # milliseconds
        except:
            # pydub이 없거나 실패한 경우 기본값
            return 5000  # 5초

    def save_timestamps_json(self, timestamps: List[WordTimestamp], output_path: str):
        """타임스탬프를 JSON 파일로 저장"""
        data = [
            {
                "text": ts.text,
                "start": ts.start_ms / 1000,
                "end": ts.end_ms / 1000
            }
            for ts in timestamps
        ]

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"[Whisper] 타임스탬프 저장: {output_path}")


# 싱글톤 인스턴스
whisper_service = WhisperService()
