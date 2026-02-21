
import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

def list_models():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    print("Checking available models...")
    try:
        # Note: Depending on the SDK version, the method to list models might differ.
        # This is a generic check.
        models = client.models.list()
        for m in models:
            print(f"Model: {m.name}")
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    list_models()
