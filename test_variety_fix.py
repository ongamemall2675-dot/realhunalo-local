
import os
import base64
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

def test_variety():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    model_name = "gemini-2.5-pro-preview-tts" # Exact string from Veteran's Fix
    
    test_cases = [
        {"id": "Charon", "desc": "Hardware Case Match"},
        {"id": "zephyr", "desc": "Hardware Case Mismatch"},
        {"id": "Achernar", "desc": "Hardware Case Match"},
        {"id": "puck", "desc": "Hardware Case Mismatch"}
    ]
    
    results = {}
    
    for case in test_cases:
        voice_id = case["id"]
        print(f"Testing Voice: {voice_id} ({case['desc']})")
        try:
            # We use the same instruction logic as in tts_google.py
            full_instruction = f"You are a professional voice actor. Tone: Professional."
            
            response = client.models.generate_content(
                model=model_name,
                contents=f"Hello, this is a test for {voice_id}.",
                config=types.GenerateContentConfig(
                    system_instruction=full_instruction,
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=voice_id # The SDK might be case-sensitive, so we handle mapping in the engine
                            )
                        )
                    )
                )
            )
            
            audio_data = None
            if hasattr(response, 'audio_bytes') and response.audio_bytes:
                audio_data = response.audio_bytes
            elif response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if part.inline_data and part.inline_data.data:
                        audio_data = part.inline_data.data
                        break
            
            if audio_data:
                length = len(audio_data)
                results[voice_id] = length
                print(f"  ✓ Success! Audio length: {length}")
            else:
                print(f"  X Failed: No audio data found.")
                
        except Exception as e:
            print(f"  X Failed: {e}")

    print("\nSummary of results:")
    for v, l in results.items():
        print(f"  {v}: {l} bytes")

if __name__ == "__main__":
    test_variety()
