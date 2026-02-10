"""
Backend API를 통한 Azure TTS 테스트
"""
import requests
import json

def test_backend_tts(voice_id, text, voice_name):
    """Backend API로 TTS 요청"""
    url = "http://localhost:8000/api/generate-tts"

    payload = {
        "sceneId": 1,
        "text": text,
        "settings": {
            "engine": "azure",
            "voiceId": voice_id,
            "language": "ko-KR",
            "speed": 1.0,
            "stability": 0.5,
            "similarity": 0.75
        }
    }

    print(f"\n{'='*60}")
    print(f"테스트: {voice_name} ({voice_id})")
    print(f"텍스트: {text}")
    print(f"{'='*60}")

    try:
        response = requests.post(url, json=payload, timeout=30)

        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                engine = result.get("usedEngine", "unknown")
                duration = result.get("totalDurationMs", 0)
                has_audio = "audioUrl" in result and result["audioUrl"]

                print(f"[OK] 성공!")
                print(f"  - 사용 엔진: {engine}")
                print(f"  - 오디오 길이: {duration}ms")
                print(f"  - 오디오 데이터: {'있음' if has_audio else '없음'}")

                if result.get("fallbackUsed"):
                    print(f"  - Fallback 사용됨: {result.get('originalEngine')} → {engine}")

                return True
            else:
                error = result.get("error", "알 수 없는 오류")
                print(f"[X] 실패: {error}")
                return False
        else:
            print(f"[X] HTTP 오류: {response.status_code}")
            print(f"  - 응답: {response.text[:200]}")
            return False

    except requests.exceptions.Timeout:
        print(f"[X] 타임아웃 (30초 초과)")
        return False
    except Exception as e:
        print(f"[X] 예외: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("Backend API를 통한 Azure TTS 테스트")
    print("="*60)

    # 테스트할 음성 목록
    test_voices = [
        ("ko-KR-JiMinNeural", "지민 음성으로 말하고 있습니다.", "지민"),
        ("ko-KR-BongJinNeural", "봉진 음성으로 말하고 있습니다.", "봉진"),
        ("ko-KR-SunHiNeural", "선희 음성으로 말하고 있습니다.", "선희")
    ]

    results = []
    for voice_id, text, name in test_voices:
        success = test_backend_tts(voice_id, text, name)
        results.append((name, success))

    # 결과 요약
    print(f"\n{'='*60}")
    print("테스트 결과 요약")
    print(f"{'='*60}")
    for name, success in results:
        status = "[OK]" if success else "[X]"
        print(f"{status} {name}")

    all_passed = all(success for _, success in results)
    if all_passed:
        print(f"\n[OK] 모든 테스트 통과! Azure 음성 선택이 백엔드에서 정상 작동합니다.")
    else:
        print(f"\n[X] 일부 테스트 실패.")

if __name__ == "__main__":
    main()
