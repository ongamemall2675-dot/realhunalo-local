"""
이미지 생성 기능 테스트
"""
from dotenv import load_dotenv
load_dotenv()

from services.image_service import image_service

def test_image_generation():
    """이미지 생성 테스트"""
    print("="*60)
    print("이미지 생성 테스트 시작")
    print("="*60)

    # 테스트 프롬프트
    test_prompt = "A futuristic cityscape with advanced technology and AI interfaces visible in everyday life."

    print(f"\n[이미지 프롬프트]")
    print(test_prompt)

    # 이미지 생성 실행
    print("\n[이미지 생성 중...]")
    result = image_service.generate(
        prompt=test_prompt,
        model="black-forest-labs/flux-schnell",
        aspect_ratio="16:9",
        num_outputs=1
    )

    # 결과 확인
    print("\n" + "="*60)
    print("결과:")
    print("="*60)

    if result.get("success"):
        print(f"[성공!]")
        print(f"\n이미지 URL: {result.get('imageUrl')}")
        print(f"처리 시간: {result.get('processingTime')}초")
        print(f"모델: {result.get('model')}")
    else:
        print(f"[실패]: {result.get('error')}")
        print(f"재시도 가능: {result.get('retryable')}")
        print(f"오류 타입: {result.get('errorType')}")

if __name__ == "__main__":
    test_image_generation()
