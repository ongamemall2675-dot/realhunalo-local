"""
Test Google TTS API
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import requests
import json
import time

def test_voices_api():
    """Test /api/tts/voices endpoint"""
    print("Testing /api/tts/voices endpoint...")

    try:
        response = requests.get("http://localhost:8000/api/tts/voices", timeout=10)

        if response.status_code == 200:
            data = response.json()

            if data.get("success"):
                voices = data.get("voices", {})
                google_voices = voices.get("google", [])

                print("[OK] Success!")
                print(f"  Azure voices: {len(voices.get('azure', []))}")
                print(f"  ElevenLabs voices: {len(voices.get('elevenlabs', []))}")
                print(f"  Google voices: {len(google_voices)}")

                if google_voices:
                    print(f"\nFirst 3 Google personas:")
                    for i, voice in enumerate(google_voices[:3]):
                        print(f"  {i+1}. {voice.get('name_ko')} ({voice.get('id')})")
                        print(f"     {voice.get('base_instruction', '')[:60]}...")
                    return True
                else:
                    print("  [WARNING] No Google voices found!")
                    return False
            else:
                print(f"[ERROR] API returned success=False: {data.get('error')}")
                return False
        else:
            print(f"[ERROR] HTTP Error {response.status_code}")
            print(f"  {response.text[:200]}")
            return False

    except requests.exceptions.ConnectionError:
        print("[ERROR] Connection refused - backend may not be running")
        return False
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        return False

def test_google_tts():
    """Test Google TTS generation"""
    print("\nTesting Google TTS generation...")

    payload = {
        "sceneId": "test",
        "text": "안녕하세요, 구글 제미나이 TTS 테스트입니다.",
        "settings": {
            "engine": "google",
            "voiceId": "Aoede",
            "stability": 0.5,
            "speed": 1.0
        }
    }

    try:
        response = requests.post(
            "http://localhost:8000/api/generate-tts",
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()

            if data.get("success"):
                print("[OK] TTS generation successful!")
                print(f"  Engine used: {data.get('usedEngine')}")
                print(f"  Processing time: {data.get('processingTimeSeconds')}s")
                print(f"  Audio URL type: {'base64' if 'base64' in data.get('audioUrl', '') else 'file'}")
                return True
            else:
                print(f"[ERROR] TTS generation failed: {data.get('error')}")
                return False
        else:
            print(f"[ERROR] HTTP Error {response.status_code}")
            print(f"  {response.text[:300]}")
            return False

    except Exception as e:
        print(f"[ERROR] Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Google TTS API Test")
    print("=" * 60)
    print()

    # Wait for server to start
    print("Waiting for backend to be ready...")
    time.sleep(3)

    # Test 1: Voices API
    voices_ok = test_voices_api()

    if voices_ok:
        print()
        # Test 2: TTS Generation
        tts_ok = test_google_tts()

        print()
        print("=" * 60)
        if tts_ok:
            print("[OK] All tests passed!")
        else:
            print("[ERROR] TTS generation test failed")
        print("=" * 60)
    else:
        print()
        print("=" * 60)
        print("[ERROR] Voices API test failed - skipping TTS test")
        print("=" * 60)
