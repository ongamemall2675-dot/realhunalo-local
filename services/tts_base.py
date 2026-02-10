"""
TTS Base Interface
모든 TTS 엔진이 구현해야 하는 추상 인터페이스 정의
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

@dataclass
class WordTimestamp:
    """단어별 타임스탬프 데이터 구조"""
    text: str           # 단어 텍스트
    start_ms: int       # 시작 시간 (밀리초)
    end_ms: int         # 종료 시간 (밀리초)
    
    @property
    def start_seconds(self) -> float:
        """시작 시간을 초 단위로 반환"""
        return self.start_ms / 1000.0
    
    @property
    def end_seconds(self) -> float:
        """종료 시간을 초 단위로 반환"""
        return self.end_ms / 1000.0
    
    @property
    def duration_seconds(self) -> float:
        """지속 시간을 초 단위로 반환"""
        return (self.end_ms - self.start_ms) / 1000.0

@dataclass
class TTSResult:
    """TTS 생성 결과 데이터 구조"""
    success: bool                           # 성공 여부
    audio_url: str                          # 오디오 파일 URL (Base64 또는 HTTP)
    audio_path: Optional[str] = None        # 로컬 파일 경로
    audio_base64: Optional[str] = None      # Base64 인코딩된 오디오
    timestamps: List[WordTimestamp] = None  # 단어별 타임스탬프
    total_duration_ms: int = 0              # 전체 오디오 길이 (밀리초)
    srt: Optional[str] = None               # SRT 포맷 자막
    engine: str = "unknown"                 # 사용된 TTS 엔진 이름
    error: Optional[str] = None             # 에러 메시지 (실패 시)
    
    def __post_init__(self):
        """초기화 후 처리"""
        if self.timestamps is None:
            self.timestamps = []
    
    @property
    def total_duration_seconds(self) -> float:
        """전체 길이를 초 단위로 반환"""
        return self.total_duration_ms / 1000.0
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환 (JSON 응답용)"""
        return {
            "success": self.success,
            "audioUrl": self.audio_url,
            "audioBase64": self.audio_base64,
            "alignment": {
                "words": [ts.text for ts in self.timestamps],
                "wordEndTimesSeconds": [ts.end_seconds for ts in self.timestamps],
                "timeline": [
                    {
                        "text": ts.text,
                        "start": ts.start_seconds,
                        "end": ts.end_seconds
                    }
                    for ts in self.timestamps
                ]
            } if self.timestamps else None,
            "srt": self.srt,
            "duration": self.total_duration_seconds,
            "engine": self.engine,
            "error": self.error
        }


class TTSEngineBase(ABC):
    """
    TTS 엔진 추상 베이스 클래스
    모든 TTS 구현체(Azure, Google 등)는 이 클래스를 상속받아야 함
    """
    
    def __init__(self, engine_name: str):
        """
        Args:
            engine_name: 엔진 이름 (예: "azure", "google")
        """
        self.engine_name = engine_name
    
    @abstractmethod
    def validate_credentials(self) -> bool:
        """
        API 키 및 인증 정보의 유효성을 검증합니다.
        
        Returns:
            bool: 인증 정보가 유효하면 True, 그렇지 않으면 False
        """
        pass
    
    @abstractmethod
    def synthesize_speech(
        self,
        text: str,
        voice_id: str = None,
        language: str = "ko-KR",
        speed: float = 1.0,
        **kwargs
    ) -> TTSResult:
        """
        텍스트를 음성으로 변환하고 타임스탬프를 생성합니다.
        
        Args:
            text: 변환할 텍스트
            voice_id: 음성 ID (엔진별로 다름)
            language: 언어 코드
            speed: 재생 속도 (1.0 = 보통)
            **kwargs: 엔진별 추가 옵션
        
        Returns:
            TTSResult: 오디오 파일 및 타임스탬프 정보
        """
        pass
    
    def generate_srt(self, timestamps: List[WordTimestamp]) -> str:
        """
        타임스탬프 리스트로부터 SRT 포맷 자막을 생성합니다.
        
        Args:
            timestamps: 단어별 타임스탬프 리스트
        
        Returns:
            str: SRT 포맷 문자열
        """
        def format_time(ms: int) -> str:
            """밀리초를 SRT 시간 포맷으로 변환 (00:00:00,000)"""
            seconds = ms / 1000.0
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            millis = int((seconds % 1) * 1000)
            return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
        
        srt_lines = []
        for i, ts in enumerate(timestamps, 1):
            srt_lines.append(f"{i}")
            srt_lines.append(f"{format_time(ts.start_ms)} --> {format_time(ts.end_ms)}")
            srt_lines.append(ts.text)
            srt_lines.append("")  # 빈 줄
        
        return "\n".join(srt_lines)
    
    def get_engine_info(self) -> Dict[str, str]:
        """
        엔진 정보를 반환합니다.
        
        Returns:
            dict: 엔진 이름, 버전 등
        """
        return {
            "engine": self.engine_name,
            "version": "1.0"
        }
