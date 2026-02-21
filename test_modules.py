#!/usr/bin/env python3
"""
RealHunalo 모듈 테스트 스크립트
각 모듈의 API를 순차적으로 테스트하고 결과를 출력합니다.
"""

import requests
import json
import time
from typing import Dict, List, Any

BASE_URL = "http://localhost:8000"

def print_separator(title: str):
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80 + "\n")

def test_script_generation():
    """1. 대본 생성 테스트"""
    print_separator("1️⃣  대본 생성 API 테스트")

    url = f"{BASE_URL}/api/generate-script"
    payload = {
        "topic": "인공지능 기술의 발전과 미래",
        "style": "informative",
        "imageStyle": "stickman"
    }

    print(f"📤 요청: {json.dumps(payload, ensure_ascii=False, indent=2)}")

    try:
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()

        result = response.json()

        if result.get("success"):
            scenes = result.get("scenes", [])
            print(f"\n✅ 대본 생성 성공!")
            print(f"   생성된 장면 수: {len(scenes)}개")

            # 처음 3개 장면만 출력
            for i, scene in enumerate(scenes[:3], 1):
                print(f"\n   🎬 장면 {i}:")
                print(f"      대본: {scene.get('originalScript', 'N/A')[:80]}...")
                print(f"      이미지 프롬프트: {scene.get('imagePrompt', 'N/A')[:80]}...")
                print(f"      모션 프롬프트: {scene.get('motionPrompt', 'N/A')[:80]}...")

            if len(scenes) > 3:
                print(f"\n   ... 외 {len(scenes) - 3}개 장면")

            return result
        else:
            print(f"❌ 실패: {result.get('error', 'Unknown error')}")
            return None

    except requests.exceptions.Timeout:
        print("❌ 타임아웃: 60초 내에 응답 없음")
        return None
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        return None

def test_image_generation(scene_data: Dict):
    """2. 이미지 생성 테스트"""
    print_separator("2️⃣  이미지 생성 API 테스트")

    if not scene_data or not scene_data.get("imagePrompt"):
        print("⚠️  이미지 프롬프트가 없어 테스트를 건너뜁니다.")
        return None

    url = f"{BASE_URL}/api/generate-image"
    payload = {
        "prompt": scene_data["imagePrompt"],
        "settings": {
            "model": "black-forest-labs/flux-schnell",
            "aspectRatio": "16:9",
            "numOutputs": 1
        }
    }

    print(f"📤 요청: 프롬프트 - {scene_data['imagePrompt'][:80]}...")
    print(f"   모델: flux-schnell, 비율: 16:9")

    try:
        print("\n⏳ 이미지 생성 중... (10-30초 소요)")
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()

        result = response.json()

        if result.get("success"):
            image_url = result.get("imageUrl")
            print(f"\n✅ 이미지 생성 성공!")
            print(f"   이미지 URL: {image_url}")
            return image_url
        else:
            print(f"❌ 실패: {result.get('error', 'Unknown error')}")
            return None

    except requests.exceptions.Timeout:
        print("❌ 타임아웃: 60초 내에 응답 없음")
        return None
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        return None

def test_motion_generation(image_url: str, motion_prompt: str, scene_id: int = 1):
    """3. 모션 생성 테스트"""
    print_separator("3️⃣  모션 생성 API 테스트")

    if not image_url:
        print("⚠️  이미지 URL이 없어 테스트를 건너뜁니다.")
        return None

    url = f"{BASE_URL}/api/generate-motion"
    payload = {
        "sceneId": scene_id,
        "imageUrl": image_url,
        "motionPrompt": motion_prompt or "Slow cinematic camera movement, subtle drift",
        "duration": 5,
        "aspectRatio": "16:9",
        "model": "bytedance/seedance-1-lite"
    }

    print(f"📤 요청:")
    print(f"   이미지: {image_url[:60]}...")
    print(f"   모션: {payload['motionPrompt'][:80]}...")
    print(f"   모델: seedance-1-lite, 길이: 5초")

    try:
        print("\n⏳ 비디오 생성 중... (30-120초 소요)")
        response = requests.post(url, json=payload, timeout=180)
        response.raise_for_status()

        result = response.json()

        if result.get("videoUrl"):
            video_url = result.get("videoUrl")
            print(f"\n✅ 비디오 생성 성공!")
            print(f"   비디오 URL: {video_url}")
            return video_url
        else:
            print(f"❌ 실패: {result.get('error', 'Unknown error')}")
            return None

    except requests.exceptions.Timeout:
        print("❌ 타임아웃: 180초 내에 응답 없음")
        print("   💡 힌트: SeeDance 모델은 시간이 오래 걸릴 수 있습니다.")
        return None
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        return None

def test_tts_generation(text: str, scene_id: int = 1):
    """4. TTS 생성 테스트"""
    print_separator("4️⃣  TTS 생성 API 테스트")

    if not text:
        print("⚠️  텍스트가 없어 테스트를 건너뜁니다.")
        return None

    url = f"{BASE_URL}/api/generate-tts"
    payload = {
        "text": text,
        "sceneId": scene_id,
        "settings": {
            "engine": "elevenlabs",
            "voiceId": "nPczCjzI2devNBz1zQrb",
            "stability": 0.5,
            "similarity": 0.75,
            "speed": 1.0
        }
    }

    print(f"📤 요청: {text[:80]}...")
    print(f"   엔진: ElevenLabs, 음성 ID: nPczCjzI2devNBz1zQrb")

    try:
        print("\n⏳ 음성 생성 중... (5-15초 소요)")
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()

        result = response.json()

        if result.get("audioUrl"):
            audio_url = result.get("audioUrl")
            print(f"\n✅ 음성 생성 성공!")
            print(f"   오디오 URL: {audio_url}")
            return audio_url
        else:
            print(f"❌ 실패: {result.get('error', 'Unknown error')}")
            return None

    except requests.exceptions.Timeout:
        print("❌ 타임아웃: 30초 내에 응답 없음")
        return None
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        return None

def main():
    print("\n" + "🚀 " * 20)
    print("   RealHunalo Studio - 전체 모듈 테스트")
    print("🚀 " * 20)

    print("\n📋 테스트 순서:")
    print("   1. 대본 생성 (AI로 장면 분할 및 프롬프트 생성)")
    print("   2. 이미지 생성 (첫 번째 장면만)")
    print("   3. 모션 생성 (생성된 이미지를 비디오로 변환)")
    print("   4. TTS 생성 (첫 번째 장면만)")

    input("\n⏸️  계속하려면 Enter를 누르세요...")

    # 1. 대본 생성
    script_result = test_script_generation()

    if not script_result or not script_result.get("scenes"):
        print("\n❌ 대본 생성에 실패하여 테스트를 중단합니다.")
        return

    first_scene = script_result["scenes"][0]

    # 2. 이미지 생성 (선택)
    print("\n" + "-"*80)
    choice = input("\n❓ 이미지 생성 테스트를 진행하시겠습니까? (y/n): ").strip().lower()

    image_url = None
    if choice == 'y':
        image_url = test_image_generation(first_scene)
    else:
        print("⏭️  이미지 생성 테스트를 건너뜁니다.")

    # 3. 모션 생성 (선택, 이미지가 있을 때만)
    if image_url:
        print("\n" + "-"*80)
        choice = input("\n❓ 모션 생성 테스트를 진행하시겠습니까? (y/n): ").strip().lower()

        if choice == 'y':
            motion_prompt = first_scene.get("motionPrompt", "Slow cinematic camera movement")
            test_motion_generation(image_url, motion_prompt, first_scene.get("sceneId", 1))
        else:
            print("⏭️  모션 생성 테스트를 건너뜁니다.")

    # 4. TTS 생성 (선택)
    print("\n" + "-"*80)
    choice = input("\n❓ TTS 생성 테스트를 진행하시겠습니까? (y/n): ").strip().lower()

    if choice == 'y':
        text = first_scene.get("originalScript", "")
        test_tts_generation(text, first_scene.get("sceneId", 1))
    else:
        print("⏭️  TTS 생성 테스트를 건너뜁니다.")

    # 최종 요약
    print_separator("✅ 테스트 완료")
    print("모든 모듈 테스트가 완료되었습니다.")
    print("\n📊 결과 요약:")
    print(f"   • 대본 생성: {'✅ 성공' if script_result else '❌ 실패'}")
    print(f"   • 이미지 생성: {'✅ 성공' if image_url else '⏭️  건너뜀'}")
    print(f"   • 이미지 프롬프트: {first_scene.get('imagePrompt', 'N/A')[:60]}...")
    print(f"   • 모션 프롬프트: {first_scene.get('motionPrompt', 'N/A')[:60]}...")

    print("\n💡 프론트엔드에서 테스트하려면:")
    print("   1. http://localhost:3000 접속")
    print("   2. 각 모듈 버튼을 클릭하여 기능 확인")

    print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  사용자가 테스트를 중단했습니다.")
    except Exception as e:
        print(f"\n\n❌ 예기치 않은 오류: {str(e)}")
