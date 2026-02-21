import sys
import os
import base64
# Add current directory to path
sys.path.append(os.getcwd())

from services.tts_google import google_tts_engine

def test_veteran_mapping():
    print("--- Testing Veteran's Mapping Fix (Live Simulation) ---")
    
    # 1. Simulate the nested settings structure from frontend
    test_kwargs = {
        "settings": {
            "voiceId": "Charon",
            "speed": 1.0,
            "stability": 0.5
        }
    }
    
    print(f"Calling synthesize_speech with nested settings: {test_kwargs}")
    
    # We call with voice_id=None to force it to look into kwargs
    result = google_tts_engine.synthesize_speech(
        text="이것은 베테랑의 안목으로 수정한 이중 안전장치 테스트입니다.",
        voice_id=None,
        **test_kwargs
    )
    
    if result.success:
        print(f"✅ Success! Audio generated ({len(result.audio_base64)} chars base64)")
        # Save for manual check if needed
        output_path = "test_veteran_result.mp3"
        with open(output_path, "wb") as f:
            f.write(base64.b64decode(result.audio_base64))
        print(f"Generated audio saved to {output_path}")
    else:
        print(f"❌ Failed: {result.error}")

if __name__ == "__main__":
    test_veteran_mapping()
