
import os
import requests
import json
import base64
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GOOGLE_TTS_API_KEY")
API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
# Chirp 3 might require v1beta1? Let's try v1 first, then v1beta1.
# API_URL = "https://texttospeech.googleapis.com/v1beta1/text:synthesize"

def test_voice(voice_name):
    url = f"{API_URL}?key={API_KEY}"
    payload = {
        "input": {"text": "안녕하세요, 저는 구글 첩 쓰리 보이스입니다."},
        "voice": {
            "languageCode": "ko-KR",
            "name": voice_name
        },
        "audioConfig": {
            "audioEncoding": "MP3"
        }
    }
    
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            print(f"[SUCCESS] {voice_name} works!")
            # Save to file to be sure
            # with open(f"test_{voice_name}.mp3", "wb") as f:
            #     f.write(base64.b64decode(response.json()['audioContent']))
        else:
            print(f"[FAILED] {voice_name}: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"[ERROR] {voice_name}: {e}")

# Test the 8 suspected voices
voices = [
    "ko-KR-Chirp-3-HD-Aoede",
    "ko-KR-Chirp-3-HD-Kore",
    "ko-KR-Chirp-3-HD-Leda",
    "ko-KR-Chirp-3-HD-Zephyr",
    "ko-KR-Chirp-3-HD-Charon",
    "ko-KR-Chirp-3-HD-Fenrir",
    "ko-KR-Chirp-3-HD-Orus",
    "ko-KR-Chirp-3-HD-Puck"
]

for v in voices:
    test_voice(v)
