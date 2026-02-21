import os
import base64
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

def probe_pro_model():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    
    potential_models = [
        "models/gemini-2.5-pro-preview-tts",
        "gemini-2.5-pro-preview-tts",
        "models/gemini-2.5-pro",
        "models/gemini-2.0-flash-preview-tts" # Fallback check
    ]
    
    for model_name in potential_models:
        print(f"\nProbing Model: {model_name}")
        try:
            response = client.models.generate_content(
                model=model_name,
                contents="Instruction: You are a professional voice actor. Persona: Deep and calm. Tone: Professional. Pace: 1.0x. Text to speak: 이것은 장면 분절 테스트를 위한 한국어 예시 문장입니다.",
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name="Charon"
                            )
                        )
                    )
                )
            )
            print(f"  ✓ SUCCESS with {model_name}")
            return
        except Exception as e:
            print(f"  X FAILED: {e}")

if __name__ == "__main__":
    probe_pro_model()
