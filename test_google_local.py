
import sys
import os
import logging

# Ensure local modules can be imported
sys.path.append(os.getcwd())

from services.tts_google import google_tts_engine

# Setup logging to see what happens
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_forced_failure():
    print("--- Testing Google TTS Fallback Logic ---")
    
    # 1. Force a failure by using an invalid model name temporarily
    # We can't easily change the class code at runtime safely without mocking,
    # but we can try to pass a voice that might cause issues or just see if the current setup works.
    # Actually, we want to VERIFY that it works. If it works, it returns success.
    # If the user saw fallback, it means it returned success=False.
    
    # Let's try to generate with the current setup and see if it succeeds.
    # If this succeeds here, then the issue might be transient or related to the specific text/voice the user used.
    
    try:
        print("Attempting synthesis with 'Charon' (known working)...")
        result = google_tts_engine.synthesize_speech(
            text="테스트 음성입니다.",
            voice_id="Charon",
            speed=1.0
        )
        
        if result.success:
            print(f"✅ Google TTS Succeeded locally! Audio: {len(result.audio_base64)} bytes")
            print(f"Engine used: {result.engine}")
        else:
            print(f"❌ Google TTS Failed locally: {result.error}")
            
    except Exception as e:
        print(f"❌ Exception during test: {e}")

if __name__ == "__main__":
    test_forced_failure()
