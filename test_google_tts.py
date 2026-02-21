import os
from services.tts_google import GoogleTTSEngine
from dotenv import load_dotenv

load_dotenv()

def test_google_tts():
    try:
        print("Initializing Google TTS Engine...")
        engine = GoogleTTSEngine()
        
        print("Testing synthesize_speech...")
        text = "안녕하세요. 이것은 테스트 음성입니다."
        voice_id = "Puck" # One of the personas
        
        result = engine.synthesize_speech(text=text, voice_id=voice_id)
        
        if result['audioUrl']:
            print("Success! Audio URL generated.")
            print(f"URL length: {len(result['audioUrl'])}")
        else:
            print("Failed: No Audio URL.")
            
    except Exception as e:
        print(f"Error occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_google_tts()
