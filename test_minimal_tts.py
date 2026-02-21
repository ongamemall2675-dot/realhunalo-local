
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

def test_minimal():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    
    models = ["models/gemini-2.5-pro-preview-tts", "models/gemini-2.5-flash-preview-tts"]
    
    for model in models:
        print(f"\nTesting Model: {model}")
        try:
            response = client.models.generate_content(
                model=model,
                contents="Hello, this is a minimal stability test.",
                config=types.GenerateContentConfig(
                    system_instruction="You are a professional voice actor.",
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name="Aoede"
                            )
                        )
                    )
                )
            )
            print(f"  ✓ Success! Audio bytes: {len(response.audio_bytes) if hasattr(response, 'audio_bytes') and response.audio_bytes else 'N/A'}")
        except Exception as e:
            print(f"  X Failed: {e}")

if __name__ == "__main__":
    test_minimal()
