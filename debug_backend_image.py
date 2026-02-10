"""
백엔드 이미지 서비스 직접 테스트
"""
from dotenv import load_dotenv
load_dotenv()

# 백엔드처럼 임포트
from services.image_service import image_service

def test():
    print("="*60)
    print("백엔드 이미지 서비스 직접 테스트")
    print("="*60)

    # 프론트엔드에서 보낸 것과 동일한 요청
    prompt = "A stickman pondering over a menu with various food options"
    model = "black-forest-labs/flux-schnell"
    aspect_ratio = "16:9"
    num_outputs = 1

    print(f"\n[요청 파라미터]")
    print(f"  prompt: {prompt}")
    print(f"  model: {model}")
    print(f"  aspect_ratio: {aspect_ratio}")
    print(f"  num_outputs: {num_outputs}")

    try:
        print(f"\n[이미지 생성 중...]")
        result = image_service.generate(
            prompt=prompt,
            model=model,
            aspect_ratio=aspect_ratio,
            num_outputs=num_outputs
        )

        print(f"\n[결과]")
        if result.get("success"):
            print(f"  성공!")
            print(f"  imageUrl: {result.get('imageUrl')[:80]}...")
        else:
            print(f"  실패: {result.get('error')}")
            if 'errorType' in result:
                print(f"  errorType: {result.get('errorType')}")

    except Exception as e:
        print(f"\n[예외 발생]")
        print(f"  {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()
