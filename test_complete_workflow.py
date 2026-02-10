"""
전체 워크플로우 통합 테스트
대본 세분화 -> 이미지 생성 -> TTS 생성
"""
from dotenv import load_dotenv
load_dotenv()

from services.script_service import script_service
from services.image_service import image_service
from services.tts_service import tts_service
import time

# 사용자 입력 대본
USER_SCRIPT = """
인공지능이 바꾸는 미래의 세상에 대해 이야기해볼까요?
요즘 ChatGPT나 다양한 AI 도구들이 우리의 일상 곳곳에 스며들고 있습니다.
이제는 단순한 질문 응답을 넘어서, 창작물을 만들고 복잡한 문제를 해결하는 단계까지 왔죠.
하지만 이런 변화가 우리 삶에 어떤 영향을 미칠까요?
일자리는 어떻게 변할까요? 그리고 우리는 어떻게 준비해야 할까요?
오늘은 이런 질문들에 대해 함께 생각해보는 시간을 가져보겠습니다.
"""

def test_complete_workflow():
    """전체 워크플로우 테스트"""
    print("="*80)
    print("전체 워크플로우 통합 테스트")
    print("="*80)

    # ============================================================
    # STEP 1: 대본 세분화
    # ============================================================
    print("\n" + "="*80)
    print("STEP 1: 대본 세분화")
    print("="*80)

    print(f"\n[입력 대본] (글자수: {len(USER_SCRIPT)})")
    print(USER_SCRIPT)

    script_result = script_service.generate(
        topic=USER_SCRIPT,
        style="engaging",
        model="gpt-4o-mini",
        temperature=0.7
    )

    if not script_result.get("success"):
        print(f"\n[실패] 대본 세분화 실패: {script_result.get('error')}")
        return

    scenes = script_result.get("scenes", [])
    print(f"\n[성공] {len(scenes)}개의 씬 생성")

    # ============================================================
    # STEP 2: 첫 번째 씬으로 이미지 생성 테스트
    # ============================================================
    print("\n" + "="*80)
    print("STEP 2: 이미지 생성 (첫 번째 씬)")
    print("="*80)

    if not scenes:
        print("[실패] 씬이 없습니다.")
        return

    first_scene = scenes[0]
    scene_id = first_scene.get("sceneId")
    image_prompt = first_scene.get("imagePrompt")
    original_script = first_scene.get("originalScript")

    print(f"\nScene {scene_id}:")
    print(f"  Image Prompt: {image_prompt}")
    print(f"  Original Script: {original_script}")

    if not image_prompt:
        print("\n[실패] 이미지 프롬프트가 없습니다.")
        return

    print(f"\n[이미지 생성 중...]")
    start_time = time.time()

    image_result = image_service.generate(
        prompt=image_prompt,
        model="black-forest-labs/flux-schnell",
        aspect_ratio="16:9",
        num_outputs=1
    )

    elapsed = time.time() - start_time

    if not image_result.get("success"):
        print(f"\n[실패] 이미지 생성 실패: {image_result.get('error')}")
    else:
        print(f"\n[성공] 이미지 생성 완료 ({elapsed:.1f}초)")
        image_url = str(image_result.get('imageUrl', ''))
        if image_url and len(image_url) > 0:
            url_preview = image_url[:80] if len(image_url) > 80 else image_url
            print(f"  이미지 URL: {url_preview}...")
        else:
            print(f"  이미지 URL: N/A")

    # ============================================================
    # STEP 3: 첫 번째 씬으로 TTS 생성 테스트
    # ============================================================
    print("\n" + "="*80)
    print("STEP 3: TTS 생성 (첫 번째 씬)")
    print("="*80)

    if not original_script:
        print("[실패] 대본이 없습니다.")
        return

    print(f"\n[TTS 텍스트] (글자수: {len(original_script)})")
    print(original_script)

    print(f"\n[TTS 생성 중...]")
    start_time = time.time()

    tts_result = tts_service.generate(
        text=original_script,
        voice_id=None,
        language="ko-KR",
        speed=1.0,
        scene_id=scene_id,
        engine=None,  # Primary 엔진 사용
        enable_fallback=True
    )

    elapsed = time.time() - start_time

    if not tts_result.get("success"):
        print(f"\n[실패] TTS 생성 실패: {tts_result.get('error')}")
    else:
        print(f"\n[성공] TTS 생성 완료 ({elapsed:.1f}초)")
        print(f"  사용 엔진: {tts_result.get('usedEngine')}")
        audio_url = str(tts_result.get('audioUrl', 'N/A'))
        if audio_url and audio_url != 'N/A' and len(audio_url) > 0:
            url_preview = audio_url[:80] if len(audio_url) > 80 else audio_url
            print(f"  오디오 URL: {url_preview}...")
        else:
            print(f"  오디오 URL: N/A")
        print(f"  총 길이: {tts_result.get('totalDurationMs', 0)}ms")

        # 타임스탬프 확인
        timestamps = tts_result.get('timestamps', [])
        print(f"  타임스탬프: {len(timestamps)}개 단어")

        if timestamps:
            print(f"\n  [처음 5개 단어 타임스탬프]")
            for i, ts in enumerate(timestamps[:5], 1):
                print(f"    {i}. {ts.get('text')} ({ts.get('start_ms')}ms ~ {ts.get('end_ms')}ms)")

    # ============================================================
    # 최종 결과 요약
    # ============================================================
    print("\n" + "="*80)
    print("전체 워크플로우 테스트 완료")
    print("="*80)

    print(f"\n[요약]")
    print(f"  1. 대본 세분화: {'성공' if script_result.get('success') else '실패'}")
    print(f"     - 생성된 씬 수: {len(scenes)}")
    print(f"  2. 이미지 생성: {'성공' if image_result.get('success') else '실패'}")
    print(f"  3. TTS 생성: {'성공' if tts_result.get('success') else '실패'}")

if __name__ == "__main__":
    test_complete_workflow()
