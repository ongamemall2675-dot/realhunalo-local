"""
Azure Cognitive Services TTS Engine
Azure Speech SDK를 사용한 음성 합성 및 타임스탬프 추출
"""
import os
import uuid
import base64
from typing import List, Optional
import azure.cognitiveservices.speech as speechsdk
from .tts_base import TTSEngineBase, TTSResult, WordTimestamp
from .utils import OUTPUT_DIR

class AzureTTSEngine(TTSEngineBase):
    """Azure Cognitive Services 기반 TTS 엔진"""

    # Azure 한국어 음성 목록 (Neural - 자연스러운 음성)
    VOICES = {
        # 여성 음성
        "ko-KR-SunHiNeural": {
            "name": "ko-KR-SunHiNeural",
            "display_name": "선희 (SunHi)",
            "gender": "여성",
            "type": "Neural",
            "style": "밝고 친근함",
            "description": "밝고 친근한 여성 목소리, 일반적인 콘텐츠에 적합"
        },
        "ko-KR-JiMinNeural": {
            "name": "ko-KR-JiMinNeural",
            "display_name": "지민 (JiMin)",
            "gender": "여성",
            "type": "Neural",
            "style": "차분하고 부드러움",
            "description": "차분하고 부드러운 여성 목소리, 명상/힐링 콘텐츠에 적합"
        },
        "ko-KR-SoonBokNeural": {
            "name": "ko-KR-SoonBokNeural",
            "display_name": "순복 (SoonBok)",
            "gender": "여성",
            "type": "Neural",
            "style": "따뜻하고 친숙함 (중년)",
            "description": "따뜻하고 친숙한 중년 여성 목소리, 시니어 콘텐츠에 추천"
        },
        "ko-KR-YuJinNeural": {
            "name": "ko-KR-YuJinNeural",
            "display_name": "유진 (YuJin)",
            "gender": "여성",
            "type": "Neural",
            "style": "젊고 활기참",
            "description": "젊고 활기찬 여성 목소리, 트렌디한 콘텐츠에 적합"
        },
        "ko-KR-SeoHyeonNeural": {
            "name": "ko-KR-SeoHyeonNeural",
            "display_name": "서현 (SeoHyeon)",
            "gender": "여성",
            "type": "Neural",
            "style": "세련되고 우아함",
            "description": "세련되고 우아한 여성 목소리, 프리미엄 콘텐츠에 적합"
        },

        # 남성 음성
        "ko-KR-InJoonNeural": {
            "name": "ko-KR-InJoonNeural",
            "display_name": "인준 (InJoon)",
            "gender": "남성",
            "type": "Neural",
            "style": "안정적이고 전문적",
            "description": "안정적이고 전문적인 남성 목소리, 비즈니스/교육 콘텐츠에 적합"
        },
        "ko-KR-BongJinNeural": {
            "name": "ko-KR-BongJinNeural",
            "display_name": "봉진 (BongJin)",
            "gender": "남성",
            "type": "Neural",
            "style": "뉴스 앵커 스타일",
            "description": "뉴스 앵커 스타일의 남성 목소리, 뉴스/보도 콘텐츠에 적합"
        },
        "ko-KR-GookMinNeural": {
            "name": "ko-KR-GookMinNeural",
            "display_name": "국민 (GookMin)",
            "gender": "남성",
            "type": "Neural",
            "style": "차분하고 신뢰감",
            "description": "차분하고 신뢰감 있는 남성 목소리, 다큐멘터리에 적합"
        },
        "ko-KR-HyunsuNeural": {
            "name": "ko-KR-HyunsuNeural",
            "display_name": "현수 (Hyunsu)",
            "gender": "남성",
            "type": "Neural",
            "style": "젊고 명랑함",
            "description": "젊고 명랑한 남성 목소리, 엔터테인먼트 콘텐츠에 적합"
        },
        "ko-KR-HyunsuMultilingualNeural": {
            "name": "ko-KR-HyunsuMultilingualNeural",
            "display_name": "현수 다국어 (Hyunsu Multilingual)",
            "gender": "남성",
            "type": "Neural Multilingual",
            "style": "명확하고 현대적",
            "description": "다국어 지원 남성 목소리, 영어/한국어 혼용 콘텐츠에 적합"
        }
    }

    # 하위 호환성을 위한 간단한 키 매핑
    VOICE_SHORTCUTS = {
        "female": "ko-KR-SunHiNeural",
        "male": "ko-KR-InJoonNeural",
        "female_calm": "ko-KR-JiMinNeural",
        "male_news": "ko-KR-BongJinNeural",
        "female_senior": "ko-KR-SoonBokNeural",
        "female_young": "ko-KR-YuJinNeural",
        "female_elegant": "ko-KR-SeoHyeonNeural",
        "male_calm": "ko-KR-GookMinNeural",
        "male_young": "ko-KR-HyunsuNeural",
        "male_multilingual": "ko-KR-HyunsuMultilingualNeural"
    }
    
    def __init__(self, api_key: str = None, region: str = None):
        """
        Args:
            api_key: Azure Speech API 키 (환경변수에서 자동 읽기 가능)
            region: Azure 리전 (예: 'koreacentral', 기본값은 환경변수에서 읽음)
        """
        super().__init__("azure")
        
        # 환경 변수에서 API 키 및 리전 로드
        self.api_key = api_key or os.getenv("AZURE_SPEECH_KEY")
        self.region = region or os.getenv("AZURE_SPEECH_REGION", "koreacentral")
        
        if not self.api_key:
            raise ValueError(
                "Azure Speech API 키가 설정되지 않았습니다. "
                "환경변수 AZURE_SPEECH_KEY를 설정하거나 생성자에 api_key를 전달하세요."
            )
        
        # Speech Config 초기화
        self.speech_config = speechsdk.SpeechConfig(
            subscription=self.api_key,
            region=self.region
        )
        
        # 출력 포맷 설정 (MP3 44.1kHz 128kbps)
        self.speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
        )
        
        # 타임스탬프 수집용 리스트
        self.word_timestamps: List[WordTimestamp] = []
    
    def validate_credentials(self) -> bool:
        """API 키 유효성 검증"""
        try:
            # 간단한 음성 합성 테스트 (실제로 생성하지는 않음)
            test_config = speechsdk.SpeechConfig(
                subscription=self.api_key,
                region=self.region
            )
            return True
        except Exception as e:
            print(f"[X] Azure 인증 실패: {e}")
            return False
    
    def _on_word_boundary(self, evt):
        """
        Word Boundary 이벤트 핸들러
        Azure가 단어를 발음할 때마다 호출됨
        """
        # evt 객체에서 타임스탬프 정보 추출
        word_timestamp = WordTimestamp(
            text=evt.text,
            start_ms=int(evt.audio_offset / 10000),  # 100-nanosecond → milliseconds
            end_ms=int((evt.audio_offset + evt.duration) / 10000)
        )
        self.word_timestamps.append(word_timestamp)
    
    def synthesize_speech(
        self,
        text: str,
        voice_id: str = None,
        language: str = "ko-KR",
        speed: float = 1.0,
        **kwargs
    ) -> TTSResult:
        """
        Azure를 사용하여 음성 합성 및 타임스탬프 추출
        
        Args:
            text: 합성할 텍스트
            voice_id: 음성 ID (None이면 기본 여성 목소리 사용)
            language: 언어 코드
            speed: 재생 속도 (0.5 ~ 2.0 권장)
            **kwargs: 추가 옵션
        
        Returns:
            TTSResult: 오디오 및 타임스탬프 데이터
        """
        try:
            # 타임스탬프 리스트 초기화
            self.word_timestamps = []

            # 음성 선택 (기본값: 여성 목소리)
            # 1. VOICE_SHORTCUTS 확인 (하위 호환성)
            if voice_id and voice_id in self.VOICE_SHORTCUTS:
                voice_name = self.VOICE_SHORTCUTS[voice_id]
                print(f"[TTS] 음성 숏컷 '{voice_id}' → '{voice_name}'으로 변환")
            # 2. VOICES 딕셔너리에서 직접 확인
            elif voice_id and voice_id in self.VOICES:
                voice_name = self.VOICES[voice_id]["name"]
                print(f"[TTS] 음성 '{voice_id}' 사용: {self.VOICES[voice_id]['display_name']} ({self.VOICES[voice_id]['style']})")
            # 3. 직접 Azure 음성 이름이 전달된 경우
            elif voice_id and voice_id.startswith("ko-KR-"):
                voice_name = voice_id
                print(f"[TTS] 직접 음성 이름 사용: '{voice_name}'")
            # 4. 기본값 사용
            else:
                voice_name = self.VOICE_SHORTCUTS["female"]
                print(f"[TTS] 기본 음성 사용: '{voice_name}'")

            self.speech_config.speech_synthesis_voice_name = voice_name
            
            # SSML 생성 (속도 조절 포함)
            ssml = self._create_ssml(text, voice_name, speed)

            # 오디오 파일 경로 미리 생성
            audio_filename = f"tts_{uuid.uuid4()}.mp3"
            audio_path = os.path.join(OUTPUT_DIR, audio_filename)
            
            # 파일 출력을 위한 AudioConfig 설정
            audio_config = speechsdk.audio.AudioOutputConfig(filename=audio_path)
            
            # Synthesizer 생성
            synthesizer = speechsdk.SpeechSynthesizer(
                speech_config=self.speech_config,
                audio_config=audio_config
            )

            # Word Boundary 이벤트 연결
            synthesizer.synthesis_word_boundary.connect(self._on_word_boundary)

            # 음성 합성 실행
            print(f"[TTS] Azure TTS 생성 중... (음성: {voice_name}, 속도: {speed}x)")
            
            result = synthesizer.speak_ssml_async(ssml).get()
            
            # 결과 확인
            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                # 파일이 생성되었는지 확인 및 데이터 로드
                if os.path.exists(audio_path) and os.path.getsize(audio_path) > 0:
                    with open(audio_path, "rb") as f:
                        audio_data = f.read()
                    audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                else:
                    # 파일이 없으면 audio_data에서 시도 (Fallback)
                    audio_data = result.audio_data
                    if audio_data:
                         with open(audio_path, "wb") as f:
                            f.write(audio_data)
                         audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                    else:
                        raise Exception("TTS 완료되었으나 오디오 데이터가 없습니다.")

                audio_url = f"data:audio/mpeg;base64,{audio_base64}"
                
                # 총 길이 계산 (마지막 단어의 end_ms)
                total_duration_ms = self.word_timestamps[-1].end_ms if self.word_timestamps else 0
                
                # SRT 생성
                srt = self.generate_srt(self.word_timestamps)
                
                print(f"[OK] Azure TTS 완료: {len(self.word_timestamps)}개 단어, {total_duration_ms/1000:.2f}초")
                
                return TTSResult(
                    success=True,
                    audio_url=audio_url,
                    audio_path=audio_path,
                    audio_base64=audio_base64,
                    timestamps=self.word_timestamps,
                    total_duration_ms=total_duration_ms,
                    srt=srt,
                    engine="azure"
                )
            
            elif result.reason == speechsdk.ResultReason.Canceled:
                cancellation = result.cancellation_details
                error_msg = f"Azure TTS 취소됨: {cancellation.reason}"
                if cancellation.reason == speechsdk.CancellationReason.Error:
                    error_msg += f" (에러 코드: {cancellation.error_code}, 상세: {cancellation.error_details})"
                
                print(f"[X] {error_msg}")
                return TTSResult(
                    success=False,
                    audio_url="",
                    engine="azure",
                    error=error_msg
                )
            
            else:
                return TTSResult(
                    success=False,
                    audio_url="",
                    engine="azure",
                    error=f"알 수 없는 상태: {result.reason}"
                )
        
        except Exception as e:
            print(f"[X] Azure TTS 예외: {e}")
            return TTSResult(
                success=False,
                audio_url="",
                engine="azure",
                error=str(e)
            )
    
    def _create_ssml(self, text: str, voice_name: str, speed: float) -> str:
        """
        SSML(Speech Synthesis Markup Language) 생성

        Args:
            text: 합성할 텍스트
            voice_name: 음성 이름
            speed: 재생 속도 (1.0 = 정상, 0.8 = 느림, 1.2 = 빠름)

        Returns:
            str: SSML 문자열
        """
        # Azure는 상대적 속도를 사용합니다
        # 1.0 = +0% (정상 속도)
        # 0.8 = -20% (20% 느리게)
        # 1.2 = +20% (20% 빠르게)
        relative_percent = int((speed - 1.0) * 100)

        if relative_percent >= 0:
            rate_value = f"+{relative_percent}%"
        else:
            rate_value = f"{relative_percent}%"

        ssml = f"""
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">
            <voice name="{voice_name}">
                <prosody rate="{rate_value}">
                    {text}
                </prosody>
            </voice>
        </speak>
        """
        return ssml.strip()
    
    def get_available_voices(self) -> dict:
        """
        사용 가능한 음성 목록 반환 (메타데이터 포함)

        Returns:
            dict: 음성 ID를 키로, 음성 정보를 값으로 하는 딕셔너리
        """
        return self.VOICES.copy()

    def get_voices_list(self) -> list:
        """
        UI 표시용 음성 목록 반환

        Returns:
            list: [{id, display_name, gender, type, style, description}, ...]
        """
        voices_list = []
        for voice_id, voice_info in self.VOICES.items():
            voices_list.append({
                "id": voice_id,
                "name": voice_info["name"],
                "display_name": voice_info["display_name"],
                "gender": voice_info["gender"],
                "type": voice_info["type"],
                "style": voice_info["style"],
                "description": voice_info["description"]
            })
        return voices_list


# 싱글톤 인스턴스 생성 (환경변수에서 자동 로드)
try:
    azure_tts_engine = AzureTTSEngine()
except ValueError as e:
    print(f"[WARN] Azure TTS 초기화 실패: {e}")
    azure_tts_engine = None
