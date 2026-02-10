import os
from dotenv import load_dotenv

load_dotenv()

def check_env():
    keys = [
        "OPENAI_API_KEY",
        "REPLICATE_API_TOKEN",
        "ELEVENLABS_API_KEY",
        "AZURE_SPEECH_KEY",
        "GOOGLE_API_KEY"
    ]
    
    print("replicate token from os.environ:", os.environ.get("REPLICATE_API_TOKEN"))

    for key in keys:
        val = os.getenv(key)
        if val:
            masked = val[:4] + "*" * (len(val)-8) + val[-4:] if len(val) > 8 else "****"
            print(f"✅ {key}: {masked} (Len: {len(val)})")
        else:
            print(f"❌ {key}: MISSING")

if __name__ == "__main__":
    check_env()
