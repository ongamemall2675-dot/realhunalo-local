
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

def test_distinctiveness():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    results = {}
    
    voices = ["Charon", "Zephyr"]
    
    for voice in voices:
        print(f"Testing Voice: {voice}")
        try:
            response = client.models.generate_content(
                model="models/gemini-2.5-flash-preview-tts",
                contents=f"Hello, I am {voice}. This is a test of voice distinctness.",
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=voice
                            )
                        )
                    )
                )
            )
            if response.candidates:
                audio_data = response.candidates[0].content.parts[0].inline_data.data
                results[voice] = len(audio_data)
                print(f"  ✓ Success! Audio length: {len(audio_data)}")
            else:
                print(f"  X Failed: No candidates returned.")
        except Exception as e:
            print(f"  X Failed: {e}")
    
    if len(results) == 2:
        print("\nBoth voices generated audio successfully.")
        if results["Charon"] != results["Zephyr"]:
             print("Audio lengths differ, which is a good sign of distinct generation.")
        else:
             print("Audio lengths are identical - check if they sound the same (visual check only for now).")

if __name__ == "__main__":
    test_distinctiveness()
