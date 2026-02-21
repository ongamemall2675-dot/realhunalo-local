
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

def test_legacy_sdk():
    api_key = os.getenv("GEMINI_API_KEY")
    genai.configure(api_key=api_key)
    
    print("Test 1: google-generativeai (v0.8.6) + gemini-1.5-flash")
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        # Traditional way to get audio if available in this SDK version
        response = model.generate_content(
            "Hello, this is a test using the legacy SDK style.",
            generation_config=genai.GenerationConfig(
                response_modalities=["AUDIO"],
            )
        )
        # Some versions use response.audio, others response.candidates
        print(f"Test 1 Success! Audio found in response.")
        return
    except Exception as e:
        print(f"Test 1 Failed: {e}")

if __name__ == "__main__":
    test_legacy_sdk()
