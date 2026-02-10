"""
Direct TTS Test - bypassing console encoding issues
"""
import os
import sys

# Set UTF-8 encoding for console
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from dotenv import load_dotenv
load_dotenv()

print("=" * 60)
print("Direct TTS Service Test")
print("=" * 60)

# Check environment
print("\nEnvironment Variables:")
print(f"  AZURE_SPEECH_KEY: {'Set' if os.getenv('AZURE_SPEECH_KEY') else 'Missing'}")
print(f"  AZURE_SPEECH_REGION: {os.getenv('AZURE_SPEECH_REGION', 'Missing')}")
print(f"  ELEVENLABS_API_KEY: {'Set' if os.getenv('ELEVENLABS_API_KEY') else 'Missing'}")

# Import TTS service
print("\nImporting TTS Service...")
try:
    from services.tts_service import tts_service
    if tts_service is None:
        print("ERROR: TTS service is None")
        sys.exit(1)
    print(f"SUCCESS: TTS service loaded")
    print(f"  Primary Engine: {tts_service.primary_engine}")
    print(f"  Available Engines: {tts_service.get_available_engines()}")
except Exception as e:
    print(f"ERROR: Failed to import TTS service: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test TTS generation
print("\nTesting TTS Generation...")
try:
    result = tts_service.generate(
        text="Hello, this is a test.",
        scene_id="test",
        language="en-US",
        speed=1.0
    )

    if result.get("success"):
        print("SUCCESS: TTS generated")
        print(f"  Engine: {result.get('usedEngine')}")
        print(f"  Processing time: {result.get('processingTimeSeconds')}s")
        print(f"  Has audio URL: {bool(result.get('audioUrl'))}")
        print(f"  Has SRT: {bool(result.get('srtData'))}")
    else:
        print(f"FAILED: {result.get('error')}")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("Test Complete")
print("=" * 60)
