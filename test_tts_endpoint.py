"""
Test the actual TTS endpoint via HTTP
"""
import requests
import json

print("Testing TTS API Endpoint")
print("=" * 60)

url = "http://localhost:8000/api/generate-tts"

payload = {
    "text": "안녕하세요. 테스트 메시지입니다.",
    "sceneId": "test_1",
    "settings": {
        "engine": "elevenlabs",
        "voiceId": "nPczCjzI2devNBz1zQrb",
        "stability": 0.5,
        "similarity": 0.75,
        "speed": 1.0
    }
}

print(f"\nPOST {url}")
print(f"Payload: {json.dumps(payload, indent=2, ensure_ascii=False)}")

try:
    response = requests.post(url, json=payload, timeout=60)

    print(f"\nResponse Status: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print("\nSUCCESS!")
        print(f"  success: {result.get('success')}")
        print(f"  usedEngine: {result.get('usedEngine')}")
        print(f"  processingTimeSeconds: {result.get('processingTimeSeconds')}")
        print(f"  has audioUrl: {bool(result.get('audioUrl'))}")
        print(f"  has audioBase64: {bool(result.get('audioBase64'))}")
        print(f"  has srtData: {bool(result.get('srtData'))}")
        print(f"  sceneId: {result.get('sceneId')}")

        if not result.get('success'):
            print(f"\n  ERROR: {result.get('error')}")
    else:
        print(f"\nFAILED!")
        print(f"  Response: {response.text}")

except requests.exceptions.ConnectionError:
    print("\nERROR: Cannot connect to backend server")
    print("Make sure the backend is running: python backend.py")
except requests.exceptions.Timeout:
    print("\nERROR: Request timed out")
except Exception as e:
    print(f"\nERROR: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
