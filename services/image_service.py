"""
Image Service
Replicate를 사용한 AI 이미지 생성
"""
import os
import time
import replicate
from typing import Dict, Any
from requests.exceptions import Timeout, ConnectionError, RequestException

class ImageService:
    """AI 이미지 생성 서비스"""

    def __init__(self):
        self.api_token = os.getenv('REPLICATE_API_TOKEN')
        if not self.api_token:
            print("[WARN] REPLICATE_API_TOKEN이 설정되지 않았습니다.")
        else:
            os.environ['REPLICATE_API_TOKEN'] = self.api_token
            print("[OK] Image Service 초기화 완료")

    def generate(self, prompt: str, model: str = "black-forest-labs/flux-schnell",
                 aspect_ratio: str = "16:9", num_outputs: int = 1) -> Dict[str, Any]:
        """
        프롬프트로 이미지 생성

        Args:
            prompt: 이미지 생성 프롬프트
            model: 사용할 Replicate 모델
            aspect_ratio: 이미지 비율 (16:9, 1:1, 9:16 등)
            num_outputs: 생성할 이미지 수

        Returns:
            생성된 이미지 URL
        """
        if not self.api_token:
            return {"success": False, "error": "Replicate API 토큰이 설정되지 않았습니다."}

        try:
            print(f"[OK] Generating image with prompt: {prompt[:50]}...")
            start_time = time.time()

            output = replicate.run(
                model,
                input={
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                    "num_outputs": num_outputs,
                    "output_format": "png",
                    "output_quality": 90
                }
            )

            elapsed_time = time.time() - start_time
            print(f"[OK] Image generated in {elapsed_time:.1f}s")

            # output은 리스트 또는 단일 URL
            # FileOutput 객체를 문자열로 변환
            if isinstance(output, list):
                image_url = str(output[0]) if output else None
            else:
                image_url = str(output)

            if not image_url:
                return {
                    "success": False,
                    "error": "이미지 생성 실패 (빈 응답)",
                    "retryable": True
                }

            return {
                "success": True,
                "imageUrl": image_url,
                "prompt": prompt,
                "model": model,
                "processingTime": round(elapsed_time, 1)
            }

        except Timeout:
            error_msg = "요청 시간 초과 (120초). 네트워크 연결을 확인하거나 잠시 후 다시 시도하세요."
            print(f"[X] Image generation timeout: {error_msg}")
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
            # 모델 오류
            elif "model" in error_str.lower() and "not found" in error_str.lower():
                error_msg = "모델을 찾을 수 없습니다. 모델 이름을 확인하세요."
                error_type = "model_not_found"
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
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": error_msg,
                "retryable": True,
                "errorType": "unknown"
            }

# 싱글톤 인스턴스
image_service = ImageService()
