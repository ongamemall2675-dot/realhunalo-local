
import sys
import os
import logging

# Ensure local modules can be imported
sys.path.append(os.getcwd())

from services.tts_service import tts_service

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_fallback_is_disabled():
    print("--- Testing TTS Service Fallback Disabling ---")
    
    # 1. Force Google to fail by temporarily overriding the model name in the engine instance
    # We'll use a bogus model name to trigger an API error.
    if "google" in tts_service.engines:
        google_engine = tts_service.engines["google"]
        print("Forcing Google TTS to fail for test purposes...")
        
        # We need to reach into the instance to break it
        # The generate_content call uses a hardcoded model name in the prompt fix version.
        # So we'll temporarily break the client or similar.
        original_client = google_engine.client
        google_engine.client = None # This will cause an immediate "Gemini API Client 미설정" error
        
        try:
            print("Attempting to generate with Google engine (which is now broken)...")
            result = tts_service.generate(
                text="테스트입니다.",
                engine="google",
                enable_fallback=True # Even if requested, it should be disabled internally
            )
            
            if result.get("success"):
                print(f"❌ ERROR: Generation SUCCEEDED with {result.get('usedEngine')}! Fallback occurred.")
            else:
                print(f"✅ SUCCESS: Generation FAILED as expected. No fallback occurred.")
                print(f"Error message: {result.get('error')}")
                
        finally:
            # Restore client
            google_engine.client = original_client
            print("Restored Google engine client.")

if __name__ == "__main__":
    test_fallback_is_disabled()
