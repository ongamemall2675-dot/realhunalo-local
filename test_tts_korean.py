"""
Korean TTS Test
"""
import os
import sys

# Set UTF-8 encoding
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from dotenv import load_dotenv
load_dotenv()

print("Korean TTS Test")
print("=" * 60)

from services.tts_service import tts_service

if tts_service is None:
    print("ERROR: TTS service is None")
    sys.exit(1)

print(f"Primary Engine: {tts_service.primary_engine}")

# Test with Korean text
korean_text = "안녕하세요. 이것은 한국어 테스트입니다."

print(f"\nGenerating TTS for: {korean_text}")

try:
    result = tts_service.generate(
        text=korean_text,
        scene_id="korean_test",
        language="ko-KR",
        speed=1.0
    )

    if result.get("success"):
        print("\nSUCCESS!")
        print(f"  Engine used: {result.get('usedEngine')}")
        print(f"  Processing time: {result.get('processingTimeSeconds')}s")
        print(f"  Audio URL exists: {bool(result.get('audioUrl'))}")
        print(f"  Audio Base64 exists: {bool(result.get('audioBase64'))}")
        print(f"  SRT Data exists: {bool(result.get('srtData'))}")

        if result.get('srtData'):
            print(f"\nSRT Preview:")
            print(result.get('srtData')[:200])
        else:
            print("\nNo SRT data - checking alignment...")
            if result.get('alignment'):
                print("  Alignment data exists")
                timeline = result.get('alignment', {}).get('timeline', [])
                print(f"  Timeline entries: {len(timeline)}")
    else:
        print(f"\nFAILED: {result.get('error')}")

except Exception as e:
    print(f"\nERROR: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
