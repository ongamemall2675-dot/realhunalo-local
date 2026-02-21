import requests
import json
import os

BASE_URL = "http://localhost:8000"

def test_video_settings():
    print("\n[Test] Video Settings API")
    
    # 1. GET Settings
    res = requests.get(f"{BASE_URL}/api/video/settings")
    print(f"GET /api/video/settings: {res.status_code}")
    if res.status_code == 200:
        print(f"Response: {json.dumps(res.json(), indent=2)}")
    else:
        print(f"Error: {res.text}")
        return False

    # 2. POST Settings
    settings = {
        "resolution": "vertical",
        "fps": 60,
        "preset": "fast",
        "bitrate": "10M"
    }
    res = requests.post(f"{BASE_URL}/api/video/settings", json=settings)
    print(f"\nPOST /api/video/settings: {res.status_code}")
    if res.status_code == 200:
        print(f"Response: {json.dumps(res.json(), indent=2)}")
    else:
        print(f"Error: {res.text}")
        return False
        
    return True

def test_video_status():
    print("\n[Test] Video Status API")
    res = requests.get(f"{BASE_URL}/api/video/status")
    print(f"GET /api/video/status: {res.status_code}")
    if res.status_code == 200:
        print(f"Response: {json.dumps(res.json(), indent=2)}")
    else:
        print(f"Error: {res.text}")
        return False
    return True

if __name__ == "__main__":
    s1 = test_video_settings()
    s2 = test_video_status()
    
    if s1 and s2:
        print("\n" + "="*40)
        print("모든 API 검증 성공!")
        print("="*40)
    else:
        print("\n" + "="*40)
        print("일부 검증 실패")
        print("="*40)
