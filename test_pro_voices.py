
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

def compare_pro_voices():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    model_name = "models/gemini-2.5-pro-preview-tts"
    
    voices = ["Charon", "Zephyr"]
    
    for v in voices:
        print(f"\nTesting Voice: {v}")
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=f"Testing {v} voice. The quick brown fox jumps over the lazy dog.",
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=v
                            )
                        )
                    )
                )
            )
            
            audio_data = None
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if part.inline_data and part.inline_data.data:
                        audio_data = part.inline_data.data
                        break
            
            if audio_data:
                print(f"  ✓ Success! Audio length: {len(audio_data)}")
            else:
                print(f"  X Failed: No audio data found in candidates.")
        except Exception as e:
            print(f"  X Failed: {e}")

if __name__ == "__main__":
    compare_pro_voices()
