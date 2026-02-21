"""
Google Gemini 2.5 TTS Engine (Generative Audio) - FIXED VERSION
"""
import os
import uuid
import base64
import json
import logging
from typing import List, Optional, Dict, Any
from google import genai
from google.genai import types

from .tts_base import TTSEngineBase, TTSResult, WordTimestamp
from .utils import OUTPUT_DIR

logger = logging.getLogger(__name__)

class GoogleTTSEngine(TTSEngineBase):
    def __init__(self, api_key: str = None):
        super().__init__("google")
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.client = None
        self.personas = {}
        
        if self.api_key:
            try:
                # [FIX] Google Gemini API requires minimum 10s deadline
                # Removing manual timeout to use default settings
                self.client = genai.Client(api_key=self.api_key)
                self._load_personas()
            except Exception as e:
                logger.error(f"Gemini Client 초기화 실패: {e}")

    def _load_personas(self):
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'voices_config.json')
        try:
            if os.path.exists(config_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for voice in data.get('voices', []):
                        self.personas[voice['id']] = voice
                logger.info(f"Gemini 페르소나 {len(self.personas)}명 로드 완료")
        except Exception as e:
            logger.error(f"페르소나 로드 오류: {e}")

    def validate_credentials(self) -> bool:
        return self.client is not None

    def synthesize_speech(
        self,
        text: str,
        voice_id: str = None,
        language: str = "ko-KR",
        speed: float = 1.0,
        **kwargs
    ) -> TTSResult:
        try:
            if not self.client:
                raise ValueError("Gemini API Client 미설정")

            # [Logic 11] 배송 사고 방지: 어떤 경로로든 voiceId 확보
            settings = kwargs.get('settings', {})
            actual_voice_id = voice_id or kwargs.get('voiceId') or settings.get('voiceId')
            
            # 30인 마스터 리스트 대조
            GEMINI_MASTER_VOICES = {
                "Achernar", "Achird", "Algenib", "Algieba", "Alnilam", "Aoede", "Autonoe", 
                "Callirrhoe", "Charon", "Despina", "Enceladus", "Erinome", "Fenrir", "Gacrux", 
                "Iapetus", "Kore", "Laomedeia", "Leda", "Orus", "Pulcherrima", "Puck", 
                "Rasalgethi", "Sadachbia", "Sadaltager", "Schedar", "Sulafat", "Umbriel", 
                "Vindemiatrix", "Zephyr", "Zubenelgenubi"
            }
            
            target_voice_name = "Aoede"
            master_lower = {v.lower(): v for v in GEMINI_MASTER_VOICES}
            if actual_voice_id and str(actual_voice_id).lower() in master_lower:
                target_voice_name = master_lower[str(actual_voice_id).lower()]
            else:
                 # ID가 없거나 매칭되지 않으면 페르소나 검색 시도 (성별 기반)
                 persona = self.personas.get(actual_voice_id)
                 if persona:
                     target_voice_name = "Aoede" if persona.get("gender") == "Female" else "Charon"

            # 페르소나 정보 가져오기 (지시사항용)
            # 주의: target_voice_name은 Google의 내부 이름이므로, 
            # 실제 사용자가 선택한 persona의 정보를 가져오려면 actual_voice_id를 써야 함.
            # 하지만 fallback situation일 수 있으므로 안전하게 처리
            persona_for_instruction = self.personas.get(actual_voice_id, {})
            base_instr = persona_for_instruction.get('base_instruction', 'Professional tone.')
            full_instruction = f"Persona: {base_instr}. Pace: {speed}x."

            print(f"🎤 [Gemini TTS] Requesting Voice: {target_voice_name} (Origin: {actual_voice_id})")

            # [NO FALLBACK] system_instruction 없이 직접 생성
            # Gemini 2.5 TTS는 voice_name만으로도 페르소나 특성 발현
            logger.info(f"🎤 [Gemini TTS] Generating with voice: {target_voice_name}")

            response = self.client.models.generate_content(
                model="models/gemini-2.5-flash-preview-tts",
                contents=text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=target_voice_name
                            )
                        )
                    )
                )
            )

            logger.info(f"✅ [Gemini TTS] API call successful")

            # 오디오 추출 (자세한 로깅)
            audio_data = None

            # Method 1: Check response.parts directly (new SDK format)
            if hasattr(response, 'parts') and response.parts:
                logger.info(f"🔍 [Gemini TTS] Found response.parts ({len(response.parts)} parts)")
                for i, part in enumerate(response.parts):
                    logger.info(f"🔍 [Gemini TTS] Part {i}: {type(part)}")
                    if hasattr(part, 'inline_data') and part.inline_data:
                        if hasattr(part.inline_data, 'data'):
                            audio_data = part.inline_data.data
                            logger.info(f"✅ [Gemini TTS] Audio from part.inline_data.data ({len(audio_data)} bytes)")
                            break
                    # Check for 'data' attribute directly
                    if hasattr(part, 'data') and part.data:
                        audio_data = part.data
                        logger.info(f"✅ [Gemini TTS] Audio from part.data ({len(audio_data)} bytes)")
                        break

            # Method 2: Check audio_bytes attribute
            if not audio_data and hasattr(response, 'audio_bytes') and response.audio_bytes:
                audio_data = response.audio_bytes
                logger.info(f"✅ [Gemini TTS] Audio from audio_bytes ({len(audio_data)} bytes)")

            # Method 3: Check candidates (old format)
            if not audio_data and hasattr(response, 'candidates') and response.candidates:
                logger.info(f"🔍 [Gemini TTS] Checking candidates ({len(response.candidates)} found)")
                for candidate in response.candidates:
                    if hasattr(candidate, 'content') and candidate.content:
                        if hasattr(candidate.content, 'parts') and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, 'inline_data') and part.inline_data:
                                    if hasattr(part.inline_data, 'data'):
                                        audio_data = part.inline_data.data
                                        logger.info(f"✅ [Gemini TTS] Audio from candidate ({len(audio_data)} bytes)")
                                        break
                    if audio_data:
                        break

            if not audio_data:
                logger.error(f"❌ [Gemini TTS] Could not extract audio from response")
                logger.error(f"   Response type: {type(response)}")
                logger.error(f"   Response attributes: {[a for a in dir(response) if not a.startswith('_')]}")
                raise Exception("오디오 데이터 추출 실패 - response에서 audio를 찾을 수 없음")

            logger.info(f"✅ [Gemini TTS] Audio data extracted: {len(audio_data)} bytes (PCM format)")

            # [CRITICAL FIX] Google Gemini returns PCM audio (audio/L16), not MP3!
            # Must convert PCM to MP3 using pydub
            from pydub import AudioSegment
            import io as BytesIO

            # PCM parameters from Gemini API
            sample_rate = 24000  # 24kHz
            sample_width = 2  # 16-bit = 2 bytes
            channels = 1  # Mono

            logger.info(f"🔄 [Gemini TTS] Converting PCM to MP3...")

            # Create AudioSegment from raw PCM data
            audio_segment = AudioSegment(
                data=audio_data,
                sample_width=sample_width,
                frame_rate=sample_rate,
                channels=channels
            )

            # Export as MP3 file
            audio_filename = f"tts_gemini_{uuid.uuid4()}.mp3"
            audio_path = os.path.join(OUTPUT_DIR, audio_filename)

            audio_segment.export(
                audio_path,
                format="mp3",
                bitrate="128k"
            )

            logger.info(f"✅ [Gemini TTS] Converted to MP3: {audio_path}")

            # Also create base64 MP3 for immediate playback
            mp3_buffer = BytesIO.BytesIO()
            audio_segment.export(mp3_buffer, format="mp3", bitrate="128k")
            mp3_data = mp3_buffer.getvalue()
            audio_base64 = base64.b64encode(mp3_data).decode('utf-8')

            logger.info(f"✅ [Gemini TTS] MP3 base64 created: {len(audio_base64)} chars")

            return TTSResult(
                success=True,
                audio_url=f"data:audio/mpeg;base64,{audio_base64}",
                audio_path=audio_path,
                audio_base64=audio_base64,
                engine="google"
            )

        except Exception as e:
            # 자세한 에러 로깅
            import traceback
            error_details = traceback.format_exc()
            logger.error(f"❌ [Gemini TTS] Failed:")
            logger.error(f"   Voice: {target_voice_name}")
            logger.error(f"   Text length: {len(text)}")
            logger.error(f"   Error: {e}")
            logger.error(f"   Full traceback:\n{error_details}")

            print(f"❌ [Gemini TTS] 실패: {e}")

            return TTSResult(
                success=False,
                audio_url="",
                error=f"Google TTS failed: {str(e)}",
                engine="google"
            )

    def get_voices_list(self) -> list:
        """
        Gemini 페르소나 전체 정보 반환 (프론트엔드용)
        """
        voices = []
        for persona_id, persona_data in self.personas.items():
            voices.append({
                "id": persona_id,
                "name": persona_data.get("name_ko", persona_id),
                "name_ko": persona_data.get("name_ko", persona_id),
                "gender": persona_data.get("gender", "Unknown"),
                "base_instruction": persona_data.get("base_instruction", ""),
                "description": persona_data.get("base_instruction", "")  # alias for compatibility
            })
        return voices

google_tts_engine = GoogleTTSEngine()