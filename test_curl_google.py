"""
Test Google TTS with detailed logging
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import requests

payload = {
    "sceneId": "test_google",
    "text": "구글 제미나이 TTS 테스트입니다. 정상적으로 작동하는지 확인합니다.",
    "settings": {
        "engine": "google",
        "voiceId": "Aoede",
        "stability": 0.5,
        "speed": 1.0
    }
}

print("=" * 60)
print("Testing Google TTS via API")
print("=" * 60)
print()
print("Request payload:")
print(f"  Engine: {payload['settings']['engine']}")
print(f"  VoiceId: {payload['settings']['voiceId']}")
print(f"  Text: {payload['text']}")
print()

try:
    print("Sending POST request...")
    response = requests.post(
        "http://localhost:8000/api/generate-tts",
        json=payload,
        timeout=60
    )

    print(f"HTTP Status: {response.status_code}")
    print()

    if response.status_code == 200:
        data = response.json()

        print("Response data:")
        print(f"  success: {data.get('success')}")
        print(f"  usedEngine: {data.get('usedEngine')}")
        print(f"  sceneId: {data.get('sceneId')}")
        print(f"  processingTimeSeconds: {data.get('processingTimeSeconds')}")
        print(f"  fallbackUsed: {data.get('fallbackUsed')}")

        if data.get('success'):
            if data.get('usedEngine') == 'google':
                print()
                print("[OK] Google TTS used successfully!")
            else:
                print()
                print(f"[WARNING] Expected 'google', but got '{data.get('usedEngine')}'")
                print("  This indicates Google TTS failed and fallback was used")

            if data.get('audioBase64'):
                print(f"  Audio base64 length: {len(data.get('audioBase64'))}")
            if data.get('audioUrl'):
                print(f"  Audio URL: {data.get('audioUrl')[:50]}...")
        else:
            print()
            print("[ERROR] Request failed:")
            print(f"  error: {data.get('error')}")

    else:
        print(f"[ERROR] HTTP error: {response.status_code}")
        print(response.text[:500])

except Exception as e:
    print(f"[ERROR] Exception: {e}")
    import traceback
    traceback.print_exc()

print()
print("=" * 60)
