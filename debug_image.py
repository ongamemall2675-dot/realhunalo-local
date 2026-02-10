import requests
import json
import time

BASE_URL = "http://localhost:8001"

def test_image_gen():
    print("\n[TEST] Image Generation Isolation")
    payload = {
        "prompt": "A cute robot holding a sign saying \"Hello World\"",
        "settings": {
            "model": "black-forest-labs/flux-schnell",
            "aspectRatio": "1:1",
            "numOutputs": 1
        }
    }
    
    try:
        start_t = time.time()
        print(f"Sending request to {BASE_URL}/api/generate-image...")
        res = requests.post(f"{BASE_URL}/api/generate-image", json=payload)
        elapsed = time.time() - start_t
        
        print(f"Status Code: {res.status_code}")
        try:
            data = res.json()
            print(json.dumps(data, indent=2))
        except:
            print("Response Text:", res.text)
            
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    test_image_gen()
