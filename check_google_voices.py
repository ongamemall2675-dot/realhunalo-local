
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GOOGLE_TTS_API_KEY")
URL = f"https://texttospeech.googleapis.com/v1/voices?key={API_KEY}&languageCode=ko-KR"

try:
    response = requests.get(URL)
    if response.status_code == 200:
        voices = response.json().get('voices', [])
        print(f"Total ko-KR voices: {len(voices)}")
        for v in voices:
            # print(f"{v['name']} ({v['ssmlGender']})")
            if 'Chirp' in v['name']:
                print(f"FOUND CHIRP: {v['name']}")
            else:
                print(f"{v['name']}")
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
