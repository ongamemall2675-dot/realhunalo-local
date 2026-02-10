"""
테스트: Fixed Anchor가 제대로 적용되는지 확인
"""
import os
from dotenv import load_dotenv
from pathlib import Path

# .env 로드
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

print("\n" + "="*60)
print("환경변수 확인")
print("="*60)
print(f"USE_FIXED_ANCHOR: {os.getenv('USE_FIXED_ANCHOR')}")
print(f"FIXED_ANCHOR: {os.getenv('FIXED_ANCHOR')}")

# ScriptService 초기화
from services.script_service import script_service

print("\n" + "="*60)
print("ScriptService 상태")
print("="*60)
print(f"use_fixed_anchor: {script_service.use_fixed_anchor}")
print(f"fixed_anchor_text: {script_service.fixed_anchor_text}")

# 테스트 스크립트 생성
print("\n" + "="*60)
print("테스트 스크립트 생성")
print("="*60)

test_topic = """
오늘은 건강한 아침 식사에 대해 알아보겠습니다.
아침 식사는 하루를 시작하는 중요한 에너지원입니다.
신선한 과일과 통곡물 시리얼을 함께 먹으면 좋습니다.
"""

result = script_service.generate(
    topic=test_topic,
    style="engaging",
    image_style="none",
    model="gpt-4o-mini"
)

if result.get("success"):
    print("\n✅ 스크립트 생성 성공!")
    print(f"\n제목: {result.get('title')}")
    print(f"\n마스터 캐릭터 프롬프트:")
    print(result.get('masterCharacterPrompt', '(없음)'))

    print(f"\n씬 개수: {len(result.get('scenes', []))}")

    # 첫 번째 씬의 imagePrompt 확인
    if result.get('scenes'):
        first_scene = result['scenes'][0]
        print(f"\n=== 첫 번째 씬 ===")
        print(f"Image Prompt:")
        print(first_scene.get('imagePrompt', '(없음)'))

        # "Stickman"이 포함되어 있는지 확인
        if 'Stickman' in first_scene.get('imagePrompt', ''):
            print("\n✅ Stickman 앵커가 올바르게 적용되었습니다!")
        else:
            print("\n❌ Stickman 앵커가 적용되지 않았습니다.")
else:
    print(f"\n❌ 스크립트 생성 실패: {result.get('error')}")

print("\n" + "="*60)
