
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

def test_combinations():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    
    # Preview TTS Model
    print("Test: models/gemini-2.5-flash-preview-tts + AUDIO modality")
    try:
        response = client.models.generate_content(
            model="models/gemini-2.5-flash-preview-tts",
            contents="Hello, testing the direct preview TTS model.",
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
        print(f"Candidates found: {len(response.candidates) if response.candidates else 0}")
        if hasattr(response, 'audio_bytes') and response.audio_bytes:
            print(f"Audio length (direct): {len(response.audio_bytes)}")
        elif response.candidates:
            for i, part in enumerate(response.candidates[0].content.parts):
                print(f"Part {i} type: {type(part)}")
                if part.inline_data:
                    print(f"Part {i} has inline_data! Length: {len(part.inline_data.data)}")
    except Exception as e:
        print(f"Test Failed: {e}")

if __name__ == "__main__":
    test_combinations()
