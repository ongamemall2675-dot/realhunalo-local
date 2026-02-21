"""
Direct test of Google TTS engine
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import os
from dotenv import load_dotenv

# Load environment
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path, override=True)

print("=" * 60)
print("Google TTS Direct Test")
print("=" * 60)
print()

# Check API key
api_key = os.getenv("GEMINI_API_KEY")
print(f"GEMINI_API_KEY present: {bool(api_key)}")
if api_key:
    print(f"API Key (first 20 chars): {api_key[:20]}...")
print()

# Test engine initialization
print("Initializing Google TTS Engine...")
try:
    from services.tts_google import google_tts_engine

    print(f"[OK] Engine created")
    print(f"  Client initialized: {google_tts_engine.client is not None}")
    print(f"  Personas loaded: {len(google_tts_engine.personas)}")
    print()

    # Test TTS generation
    print("Testing TTS generation...")
    print("  Text: '안녕하세요, 제미나이 테스트입니다.'")
    print("  Voice: Aoede (아오이데)")
    print()

    result = google_tts_engine.synthesize_speech(
        text="안녕하세요, 제미나이 테스트입니다.",
        voice_id="Aoede",
        language="ko-KR",
        speed=1.0
    )

    print("=" * 60)
    print("Result:")
    print("=" * 60)
    print(f"Success: {result.success}")
    print(f"Engine: {result.engine}")

    if result.success:
        print(f"[OK] TTS generation successful!")
        print(f"  Audio URL length: {len(result.audio_url) if result.audio_url else 0}")
        print(f"  Audio path: {result.audio_path}")
        print(f"  Has base64: {bool(result.audio_base64)}")
        if result.audio_base64:
            print(f"  Base64 length: {len(result.audio_base64)}")
    else:
        print(f"[ERROR] TTS generation failed!")
        print(f"  Error: {result.error}")

except Exception as e:
    print(f"[ERROR] Exception occurred: {e}")
    import traceback
    traceback.print_exc()

print()
print("=" * 60)
