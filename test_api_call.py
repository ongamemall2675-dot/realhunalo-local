"""
API 직접 호출 테스트
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_image_api():
    """이미지 생성 API 테스트"""
    print("="*60)
    print("이미지 생성 API 테스트")
    print("="*60)

    payload = {
        "prompt": "A stickman pondering over a menu with various food options",
        "settings": {
            "model": "black-forest-labs/flux-schnell",
            "aspectRatio": "16:9",
            "numOutputs": 1
        }
    }

    print(f"\n[요청 데이터]")
    print(json.dumps(payload, indent=2))

    try:
        print(f"\n[API 호출 중...]")
        response = requests.post(
            f"{BASE_URL}/api/generate-image",
            json=payload,
            timeout=120
        )

        print(f"\n[응답 상태]: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n[성공]")
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(f"\n[실패] {response.status_code}")
            print(f"응답 내용: {response.text}")

    except Exception as e:
        print(f"\n[오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_image_api()
