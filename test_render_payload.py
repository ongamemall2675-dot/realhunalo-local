import requests
import json

BASE_URL = "http://localhost:8000"

payload = {
    "mergedGroups": [],
    "standalone": [
        {
            "sceneId": 1,
            "visualUrl": "output/visual.jpeg",
            "audioUrl": "output/audio.mp3",
            "videoVolume": 1.0,
            "audioVolume": 1.0,
            "videoUrl": None,
            "isVideo": False,
            "script": "안녕하세요",
            "duration": 5,
            "srtData": None,
            "audioPath": None
        }
    ]
}

res = requests.post(f"{BASE_URL}/api/generate-video", json=payload)
print(f"Status Code: {res.status_code}")
try:
    print(json.dumps(res.json(), indent=2))
except:
    print(res.text)
