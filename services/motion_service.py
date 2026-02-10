"""
Motion Service
Replicate를 사용한 이미지→비디오 모션 생성
"""
import os
import time
import replicate
from typing import Dict, Any, Optional
from requests.exceptions import Timeout, ConnectionError, RequestException

class MotionService:
    """이미지를 비디오로 변환하는 모션 생성 서비스"""

    def __init__(self):
        self.api_token = os.getenv('REPLICATE_API_TOKEN')
        self.default_model = "lightricks/ltx-video:3c9b0c2e5c88467c88ba2b314eb40f90152b0274db41da5b2d31f28c5bb3f978"
        
        if not self.api_token:
            print("[WARN] REPLICATE_API_TOKEN이 설정되지 않았습니다.")
        else:
            os.environ['REPLICATE_API_TOKEN'] = self.api_token
            print("[OK] Motion Service 초기화 완료")

    def generate(self, image_url: str, prompt: str = "Slow cinematic camera movement",
                 duration: int = 5, aspect_ratio: str = "16:9", 
                 scene_id: str = "unknown", model: Optional[str] = None) -> Dict[str, Any]:
        """
        이미지에 모션 추가하여 비디오 생성

        Args:
            image_url: 소스 이미지 URL
            prompt: 모션 프롬프트
            duration: 비디오 길이 (초)
            aspect_ratio: 비디오 비율
            scene_id: 씬 ID
            model: 사용할 Replicate 모델 (None이면 기본값)

        Returns:
            생성된 비디오 URL
        """
        if not self.api_token:
            return {"success": False, "error": "Replicate API 토큰이 설정되지 않았습니다."}

        try:
            print(f"[OK] Generating motion for scene {scene_id}...")
            start_time = time.time()

            model_to_use = model if model else self.default_model

            output = replicate.run(
                model_to_use,
                input={
                    "image": image_url,
                    "prompt": prompt,
                    "duration": duration,
                    "aspect_ratio": aspect_ratio
                }
            )

            elapsed_time = time.time() - start_time
            print(f"[OK] Motion generated in {elapsed_time:.1f}s")

            # output은 URL 또는 리스트
            if isinstance(output, list):
                video_url = output[0] if output else None
            else:
                video_url = str(output)

            if not video_url:
                return {
                    "success": False,
                    "error": "모션 생성 실패 (빈 응답)",
                    "retryable": True
                }

            return {
                "success": True,
                "videoUrl": video_url,
                "sceneId": scene_id,
                "model": model_to_use,
                "processingTime": round(elapsed_time, 1)
            }

        except Timeout:
            error_msg = "요청 시간 초과. 비디오 생성은 시간이 오래 걸릴 수 있습니다. 잠시 후 다시 시도하세요."
            print(f"[X] Motion generation timeout: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "retryable": True,
                "errorType": "timeout"
            }

        except ConnectionError:
            error_msg = "네트워크 연결 오류. 인터넷 연결을 확인하고 다시 시도하세요."
            print(f"[X] Connection error: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "retryable": True,
                "errorType": "connection"
            }

        except RequestException as e:
            error_str = str(e)
            # API 한도 초과 감지
            if "rate limit" in error_str.lower() or "429" in error_str:
                error_msg = "API 사용 한도 초과. 잠시 후 다시 시도하세요."
                error_type = "rate_limit"
                retryable = True
            # 인증 오류
            elif "401" in error_str or "unauthorized" in error_str.lower():
                error_msg = "API 키 인증 실패. 설정에서 API 키를 확인하세요."
                error_type = "auth"
                retryable = False
            # 이미지 URL 오류
            elif "image" in error_str.lower() and ("invalid" in error_str.lower() or "not found" in error_str.lower()):
                error_msg = "이미지 URL이 유효하지 않습니다. 이미지를 다시 생성하세요."
                error_type = "invalid_image"
                retryable = False
            else:
                error_msg = f"API 요청 오류: {error_str}"
                error_type = "api_error"
                retryable = True

            print(f"[X] Request error ({error_type}): {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "retryable": retryable,
                "errorType": error_type
            }

        except Exception as e:
            error_msg = f"예상치 못한 오류: {str(e)}"
            print(f"[X] Unexpected error: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "retryable": True,
                "errorType": "unknown"
            }

    def get_status(self) -> Dict[str, Any]:
        """서비스 상태 조회"""
        return {
            "available": bool(self.api_token),
            "model": self.default_model
        }

    def get_settings(self) -> Dict[str, Any]:
        """현재 설정 조회"""
        return {
            "model": self.default_model,
            "default_duration": 5,
            "default_aspect_ratio": "16:9"
        }

    def update_settings(self, model: Optional[str] = None,
                       default_duration: Optional[int] = None,
                       default_aspect_ratio: Optional[str] = None,
                       quality: Optional[str] = None) -> Dict[str, Any]:
        """설정 업데이트"""
        if model:
            self.default_model = model
        return {"success": True, "settings": self.get_settings()}

    def get_usage_stats(self) -> Dict[str, Any]:
        """사용량 통계"""
        return {
            "total_generations": 0,
            "total_duration": 0
        }

# 싱글톤 인스턴스
motion_service = MotionService()
