import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "http://localhost:8000"

def test_script_generation():
    print("\n[TEST] Script Generation & Segmentation")
    payload = {
        "topic": "The history of coffee",
        "style": "engaging",
        "settings": {
            "model": "gpt-4o-mini",
            "temperature": 0.7
        }
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/generate-script", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                scenes = data.get("scenes", [])
                print(f"✅ Success! Generated {len(scenes)} scenes.")
                for i, scene in enumerate(scenes):
                    print(f"  Scene #{i+1}:")
                    print(f"    Keys: {list(scene.keys())}")
                    img_p = scene.get('imagePrompt') or ""
                    orig_s = scene.get('originalScript') or ""
                    print(f"    - ID: {scene.get('sceneId')}")
                    print(f"    - Image Prompt: {img_p[:50]}...")
                    print(f"    - Script: {orig_s[:50]}...")
                return scenes
            else:
                print(f"❌ API Error: {data.get('error')}")
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Connection Error: {e}")
    return None

if __name__ == "__main__":
    test_script_generation()
