"""
ElevenLabs TTS Engine implementation
Adapts the original ElevenLabs logic to the new TTSEngineBase interface.
"""
import os
import requests
import base64
import uuid
from typing import List, Optional
from .tts_base import TTSEngineBase, TTSResult, WordTimestamp
from .utils import OUTPUT_DIR

class ElevenLabsTTSEngine(TTSEngineBase):
    """ElevenLabs API 기반 TTS 엔진"""
    
    DEFAULT_VOICE_ID = "nPczCjzI2devNBz1zQrb" # 기존 코드의 default voice
    
    def __init__(self, api_key: str = None):
        super().__init__("elevenlabs")
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
        
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY is not configured")

    def validate_credentials(self) -> bool:
        if not self.api_key:
            return False
        # 간단한 헤더 체크 정도만 수행 (실제 호출 비용 방지)
        return True 

    def synthesize_speech(
        self,
        text: str,
        voice_id: str = None,
        language: str = "ko", # ElevenLabs auto-detects, but keeping signature
        speed: float = 1.0,
        **kwargs
    ) -> TTSResult:
        """
        ElevenLabs API를 사용하여 음성 및 타임스탬프 생성
        """
        try:
            voice_id = voice_id or self.DEFAULT_VOICE_ID
            
            # ElevenLabs does not support speed control via simple parameter in the same way,
            # but we pass the request as before.
            
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
            headers = {
                "Content-Type": "application/json",
                "xi-api-key": self.api_key
            }
            
            payload = {
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": kwargs.get("stability", 0.5),
                    "similarity_boost": kwargs.get("similarity", 0.75),
                    "style": 0,
                    "use_speaker_boost": True
                }
                # "output_format": "mp3_44100_128" # Default
            }

            print(f"[TTS] ElevenLabs TTS 생성 요청 (Voice: {voice_id})...")
            response = requests.post(url, json=payload, headers=headers, timeout=30)

            # If voice ID is invalid/not accessible, retry once with default voice
            if response.status_code in (400, 404) and voice_id != self.DEFAULT_VOICE_ID:
                print(f"[WARN] Voice ID '{voice_id}' failed. Retrying with default voice.")
                url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.DEFAULT_VOICE_ID}/with-timestamps"
                response = requests.post(url, json=payload, headers=headers, timeout=30)

            response.raise_for_status()
            
            result = response.json()
            
            if not result.get("audio_base64"):
                raise Exception("No audio data in response")

            # 1. Audio Data 처리
            audio_base64 = result["audio_base64"]
            audio_bytes = base64.b64decode(audio_base64)
            audio_url = f"data:audio/mpeg;base64,{audio_base64}"
            
            # 파일 저장
            filename = f"tts_eleven_{uuid.uuid4()}.mp3"
            filepath = os.path.join(OUTPUT_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(audio_bytes)
                
            # 2. Timestamp 처리
            timestamps = []
            alignment = result.get("alignment", {})
            chars = alignment.get("characters", [])
            char_starts = alignment.get("character_start_times_seconds", [])
            char_ends = alignment.get("character_end_times_seconds", [])
            
            # ElevenLabs는 character 단위로 주는 경우가 많음 (v1 endpoint logic)
            # 하지만 with-timestamps 엔드포인트는 character alignment를 줌.
            # Vrew 호환을 위해 단어 단위로 묶는 로직 필요할 수 있으나,
            # 기존 서비스 로직을 참고하여 'words' 필드가 있는지 확인.
            # *참고*: 최신 ElevenLabs API는 characters alignment를 줍니다.
            # 기존 코드는 alignment['words']를 썼었음? (Step 820 확인)
            # Step 820의 코드를 보면: result["alignment"].get("words", []) 라고 되어 있었음.
            # 따라서 API가 words를 반환한다고 가정하고 처리.
            
            # *업데이트*: 실제 ElevenLabs API 문서에 따르면 /with-timestamps는 
            # characters, character_start_times_seconds, character_end_times_seconds 를 반환함.
            # 그러나 Turbo v2.5 등 모델에 따라 다를 수 있음.
            # 기존 코드가 동작했다면 그 방식을 따름.
            
            words = alignment.get("words", [])
            word_ends = alignment.get("word_end_times_seconds", [])

            # 만약 words가 없다면 characters 기반으로 재조합
            if not words and chars and char_starts and char_ends:
                print(f"[TTS] ElevenLabs returned character-level alignment. Converting to words...")
                # Character-level data를 word-level로 변환
                current_word = ""
                word_start = 0.0

                for i, char in enumerate(chars):
                    if i < len(char_starts) and i < len(char_ends):
                        char_start = char_starts[i]
                        char_end = char_ends[i]

                        # 단어의 시작
                        if not current_word:
                            word_start = char_start

                        current_word += char

                        # 단어의 끝 (공백, 구두점, 또는 마지막 문자)
                        is_last = (i == len(chars) - 1)
                        next_is_space = (i + 1 < len(chars) and chars[i + 1] in [' ', '\n', '\t'])

                        if is_last or next_is_space or char in [' ', '.', ',', '!', '?', ':', ';']:
                            word = current_word.strip()
                            if word:  # 빈 단어 제외
                                timestamps.append(WordTimestamp(
                                    text=word,
                                    start_ms=int(word_start * 1000),
                                    end_ms=int(char_end * 1000)
                                ))
                            current_word = ""

                print(f"[TTS] Converted {len(chars)} characters to {len(timestamps)} words")

            elif words and word_ends:
                # API가 word-level 데이터를 직접 제공한 경우
                for i, word in enumerate(words):
                    if i < len(word_ends):
                        start_sec = 0.0 if i == 0 else word_ends[i-1]
                        end_sec = word_ends[i]

                        timestamps.append(WordTimestamp(
                            text=word,
                            start_ms=int(start_sec * 1000),
                            end_ms=int(end_sec * 1000)
                        ))

            # Total Duration
            total_duration_ms = timestamps[-1].end_ms if timestamps else 0
            
            # SRT 생성
            srt = self.generate_srt(timestamps)

            print(f"[OK] ElevenLabs TTS 완료: {len(timestamps)}개 단어")

            return TTSResult(
                success=True,
                audio_url=audio_url,
                audio_path=filepath,
                audio_base64=audio_base64,
                timestamps=timestamps,
                total_duration_ms=total_duration_ms,
                srt=srt,
                engine="elevenlabs"
            )

        except Exception as e:
            print(f"[X] ElevenLabs TTS 오류: {e}")
            return TTSResult(
                success=False,
                audio_url="",
                engine="elevenlabs",
                error=str(e)
            )

    def get_voices_list(self) -> list:
        """UI 표시용 음성 목록 반환 (기본 보이스)"""
        # ElevenLabs는 API를 통해 동적으로 가져올 수도 있지만, 
        # 여기서는 안정성을 위해 기본 보이스 목록에 성별 정보를 추가하여 반환
        return [
            { "id": "pNInz6obpgDQGcFmaJgB", "name": "아담 (Adam)", "gender": "남성", "description": "다국어 · 깊고 신뢰감" },
            { "id": "21m00Tcm4TlvDq8ikWAM", "name": "레이첼 (Rachel)", "gender": "여성", "description": "다국어 · 차분하고 전문적" },
            { "id": "AZnzlk1XvdvUeBnXmlld", "name": "도미 (Domi)", "gender": "여성", "description": "다국어 · 밝고 친근함" },
            { "id": "EXAVITQu4vr4xnSDxMaL", "name": "벨라 (Bella)", "gender": "여성", "description": "다국어 · 세련되고 우아함" },
            { "id": "ErXwobaYiN019PkySvjV", "name": "안토니 (Antoni)", "gender": "남성", "description": "다국어 · 명랑하고 젊음" },
            { "id": "MF3mGyEYCl7XYWbV9V6O", "name": "엔조 (Enzo)", "gender": "남성", "description": "다국어 · 부드럽고 나레이션" },
            { "id": "TxGEqnHWrfWFTfGW9XjX", "name": "조쉬 (Josh)", "gender": "남성", "description": "다국어 · 활기차고 뉴스 스타일" },
            { "id": "VR6AewLTigWG4xSOukaG", "name": "아놀드 (Arnold)", "gender": "남성", "description": "다국어 · 강인하고 웅장함" }
        ]

# 싱글톤 인스턴스
try:
    elevenlabs_tts_engine = ElevenLabsTTSEngine()
except ValueError:
    elevenlabs_tts_engine = None
