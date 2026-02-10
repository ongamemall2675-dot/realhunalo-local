"""
대본 세분화 기능 테스트
"""
import sys
import os
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# 서비스 임포트
from services.script_service import script_service

# 테스트용 대본
TEST_SCRIPT = """
인공지능이 바꾸는 미래의 세상에 대해 이야기해볼까요?
요즘 ChatGPT나 다양한 AI 도구들이 우리의 일상 곳곳에 스며들고 있습니다.
이제는 단순한 질문 응답을 넘어서, 창작물을 만들고 복잡한 문제를 해결하는 단계까지 왔죠.
하지만 이런 변화가 우리 삶에 어떤 영향을 미칠까요?
일자리는 어떻게 변할까요? 그리고 우리는 어떻게 준비해야 할까요?
오늘은 이런 질문들에 대해 함께 생각해보는 시간을 가져보겠습니다.
"""

def test_script_segmentation():
    """대본 세분화 테스트"""
    print("="*60)
    print("대본 세분화 테스트 시작")
    print("="*60)

    print(f"\n[입력 대본]")
    print(TEST_SCRIPT)
    print(f"\n글자수: {len(TEST_SCRIPT)}")

    # 대본 세분화 실행
    print("\n[대본 세분화 중...]")
    result = script_service.generate(
        topic=TEST_SCRIPT,
        style="engaging",
        model="gpt-4o-mini",
        temperature=0.7
    )

    # 결과 확인
    print("\n" + "="*60)
    print("결과:")
    print("="*60)

    if result.get("success"):
        print(f"[성공!]")
        print(f"\n제목: {result.get('title')}")

        scenes = result.get("scenes", [])
        print(f"\n생성된 씬 수: {len(scenes)}")

        for i, scene in enumerate(scenes, 1):
            print(f"\n--- Scene {i} ---")
            print(f"Scene ID: {scene.get('sceneId')}")
            print(f"Image Prompt: {scene.get('imagePrompt', 'N/A')[:100]}...")
            print(f"Original Script: {scene.get('originalScript', 'N/A')[:100]}...")

    else:
        print(f"[실패]: {result.get('error')}")
        if 'raw_content' in result:
            print(f"\nRaw Content: {result['raw_content']}")

if __name__ == "__main__":
    test_script_segmentation()
