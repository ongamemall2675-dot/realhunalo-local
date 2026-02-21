"""
TTS Service - 통합 TTS 서비스
자동 Fallback, API 키 검증, 사용량 모니터링 포함
"""
import os
import time
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from .tts_base import TTSEngineBase, TTSResult
from .tts_azure import azure_tts_engine
from .tts_elevenlabs import elevenlabs_tts_engine
from .tts_google import google_tts_engine


@dataclass
class TTSUsageStats:
    """TTS 사용량 통계"""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_characters: int = 0
    total_duration_ms: int = 0
    engine_usage: Dict[str, int] = field(default_factory=dict)
    last_request_time: Optional[str] = None
    errors: List[Dict[str, Any]] = field(default_factory=list)

    def record_request(self, engine: str, success: bool, chars: int = 0, duration_ms: int = 0, error: str = None):
        """요청 기록"""
        self.total_requests += 1
        self.last_request_time = datetime.now().isoformat()

        if success:
            self.successful_requests += 1
            self.total_characters += chars
            self.total_duration_ms += duration_ms
        else:
            self.failed_requests += 1
            if error:
                self.errors.append({
                    "time": self.last_request_time,
                    "engine": engine,
                    "error": error[:200]  # 에러 메시지 길이 제한
                })
                # 최근 20개 에러만 유지
                if len(self.errors) > 20:
                    self.errors = self.errors[-20:]

        self.engine_usage[engine] = self.engine_usage.get(engine, 0) + 1


    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "totalRequests": self.total_requests,
            "successfulRequests": self.successful_requests,
            "failedRequests": self.failed_requests,
            "totalCharacters": self.total_characters,
            "totalDurationSeconds": self.total_duration_ms / 1000,
            "engineUsage": self.engine_usage,
            "lastRequestTime": self.last_request_time,
            "recentErrors": self.errors[-5:]  # 최근 5개 에러만 노출
        }


class TTSService:
    """
    TTS 통합 서비스

    기능:
    - 여러 TTS 엔진 관리 (ElevenLabs, Azure)
    - 자동 Fallback (기본 엔진 실패 시 대체 엔진 사용)
    - API 키 검증
    - 사용량 모니터링
    """


    def __init__(self):
        """TTS 엔진 초기화"""
        self.engines: Dict[str, TTSEngineBase] = {}
        self.stats = TTSUsageStats()
        self._engine_status: Dict[str, bool] = {}  # 엔진 상태 캐시

        # Azure 엔진 등록
        if azure_tts_engine:
            self.engines["azure"] = azure_tts_engine
            self._engine_status["azure"] = True

        # ElevenLabs 엔진 등록
        if elevenlabs_tts_engine:
            self.engines["elevenlabs"] = elevenlabs_tts_engine
            self._engine_status["elevenlabs"] = True

        # Google 엔진 등록
        if google_tts_engine:
            self.engines["google"] = google_tts_engine
            self._engine_status["google"] = True

        # 기본 엔진 설정 (Google 우선 - NO FALLBACK MODE)
        if "google" in self.engines:
            self.primary_engine = "google"
            print("[NOTICE] Google TTS is set as PRIMARY engine (NO FALLBACK MODE)")
        elif "elevenlabs" in self.engines:
            self.primary_engine = "elevenlabs"
        elif "azure" in self.engines:
            self.primary_engine = "azure"
        else:
            self.primary_engine = None

        if not self.engines:
            raise RuntimeError(
                "사용 가능한 TTS 엔진이 없습니다. "
                "Azure 또는 ElevenLabs API 키를 환경변수에 설정하세요."
            )

        print(f"[OK] TTS Service 초기화 완료")
        print(f"   - Primary Engine: {self.primary_engine}")
        print(f"   - Available Engines: {list(self.engines.keys())}")

    def validate_api_keys(self) -> Dict[str, Any]:
        """
        모든 등록된 엔진의 API 키 유효성 검증

        Returns:
            검증 결과 딕셔너리
        """
        results = {}

        for name, engine in self.engines.items():
            try:
                is_valid = engine.validate_credentials()
                results[name] = {
                    "valid": is_valid,
                    "message": "API 키 유효" if is_valid else "API 키 검증 실패"
                }
                self._engine_status[name] = is_valid
            except Exception as e:
                results[name] = {
                    "valid": False,
                    "message": f"검증 중 오류: {str(e)}"
                }
                self._engine_status[name] = False

        return results

    def generate(
        self,
        text: str,
        voice_id: str = None,
        language: str = "ko-KR",
        speed: float = 1.0,
        scene_id: str = "unknown",
        engine: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        텍스트를 음성으로 변환하고 타임스탬프를 생성합니다.

        Args:
            text: 변환할 텍스트
            voice_id: 음성 ID (엔진별로 다름, None이면 기본값 사용)
            language: 언어 코드 (기본: ko-KR)
            speed: 재생 속도 (기본: 1.0)
            scene_id: 씬 ID (로깅용)
            engine: 사용할 엔진 이름 (None이면 primary 사용)
            **kwargs: 엔진별 추가 옵션

        Returns:
            dict: TTS 결과 (audioUrl, timestamps, srt 등)
        """
        start_time = time.time()
        target_engine_name = engine or self.primary_engine
        char_count = len(text)

        print(f"[TTS] 생성 시작 (Scene: {scene_id}, 엔진: {target_engine_name}, 글자수: {char_count})")
        
        # 시도할 엔진 설정
        engines_to_try = [target_engine_name] if target_engine_name in self.engines else []

        if not engines_to_try:
            error_msg = f"사용 가능한 엔진이 없습니다. (요청: {target_engine_name})"
            self.stats.record_request(target_engine_name or "none", False, error=error_msg)
            return {
                "success": False,
                "error": error_msg,
                "sceneId": scene_id
            }

        last_error = None
        used_engine = None

        for engine_name in engines_to_try:
            engine_instance = self.engines.get(engine_name)
            if not engine_instance:
                continue


            try:
                result = self._try_generate(
                    engine_instance=engine_instance,
                    engine_name=engine_name,
                    text=text,
                    voice_id=voice_id,
                    language=language,
                    speed=speed,
                    **kwargs
                )

                if result.success:
                    used_engine = engine_name
                    elapsed = time.time() - start_time

                    # 통계 기록
                    self.stats.record_request(
                        engine=engine_name,
                        success=True,
                        chars=char_count,
                        duration_ms=result.total_duration_ms
                    )

                    # 응답 생성
                    response = result.to_dict()
                    response["sceneId"] = scene_id
                    response["audioUrl"] = result.audio_url
                    response["audioPath"] = result.audio_path  # 다음 단계(세분화)를 위해 경로 반환
                    response["audioBase64"] = result.audio_base64
                    response["srtData"] = result.srt
                    response["usedEngine"] = used_engine
                    response["processingTimeSeconds"] = round(elapsed, 2)

                    print(f"[OK] TTS 생성 완료 (엔진: {used_engine}, 처리시간: {elapsed:.2f}s)")
                    return response

                else:
                    last_error = result.error
                    print(f"[WARN] {engine_name} 실패: {last_error}")

            except Exception as e:
                last_error = str(e)
                print(f"[X] {engine_name} 예외: {last_error}")

        # 엔진 실패 (NO FALLBACK)
        self.stats.record_request(
            engine=target_engine_name or "none",
            success=False,
            error=last_error
        )

        print(f"[ERROR] TTS 생성 실패 - Engine: {target_engine_name}, Error: {last_error}")

        return {
            "success": False,
            "error": f"TTS 생성 실패 (Engine: {target_engine_name}): {last_error}",
            "sceneId": scene_id,
            "engine": target_engine_name,
            "fallbackUsed": False
        }


    def _try_generate(
        self,
        engine_instance: TTSEngineBase,
        engine_name: str,
        text: str,
        voice_id: str,
        language: str,
        speed: float,
        **kwargs
    ) -> TTSResult:
        """단일 엔진으로 TTS 생성 시도"""
        return engine_instance.synthesize_speech(
            text=text,
            voice_id=voice_id,
            language=language,
            speed=speed,
            **kwargs
        )

    def get_available_engines(self) -> List[str]:
        """사용 가능한 엔진 목록 반환"""
        return list(self.engines.keys())

    def get_engine_info(self, engine_name: str = None) -> Dict[str, Any]:
        """엔진 정보 조회"""
        name = engine_name or self.primary_engine
        engine = self.engines.get(name)

        if not engine:
            return {"error": f"엔진 '{name}'을 찾을 수 없습니다."}

        info = engine.get_engine_info()

        # Azure 엔진의 경우 사용 가능한 음성 목록 추가
        if hasattr(engine, 'get_available_voices'):
            info["available_voices"] = engine.get_available_voices()

        return info

    def get_usage_stats(self) -> Dict[str, Any]:
        """사용량 통계 반환"""
        return self.stats.to_dict()

    def get_status(self) -> Dict[str, Any]:
        """서비스 상태 반환"""
        return {
            "primaryEngine": self.primary_engine,
            "availableEngines": self.get_available_engines(),
            "engineStatus": self._engine_status.copy(),
            "stats": self.get_usage_stats()
        }

    def get_voices_list(self) -> dict:
        """
        사용 가능한 모든 엔진의 음성 목록 반환 (통합)
        """
        voices = {
            "azure": [],
            "elevenlabs": [],
            "google": []
        }

        # Azure 음성 목록
        if "azure" in self.engines:
            try:
                voices["azure"] = self.engines["azure"].get_voices_list()
            except Exception as e:
                print(f"[ERROR] Azure 음성 목록 로드 실패: {e}")

        # ElevenLabs 음성 목록
        if "elevenlabs" in self.engines:
            try:
                voices["elevenlabs"] = self.engines["elevenlabs"].get_voices_list()
            except Exception as e:
                print(f"[ERROR] ElevenLabs 음성 목록 로드 실패: {e}")

        # Google 음성 목록
        if "google" in self.engines:
            try:
                voices["google"] = self.engines["google"].get_voices_list()
            except Exception as e:
                print(f"[ERROR] Google 음성 목록 로드 실패: {e}")

        return voices


# 싱글톤 인스턴스 생성
try:
    tts_service = TTSService()
except RuntimeError as e:
    print(f"[WARN] TTS Service 초기화 실패: {e}")
    tts_service = None
