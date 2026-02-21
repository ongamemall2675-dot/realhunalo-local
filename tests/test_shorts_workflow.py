import requests
import json
import time
import os

BASE_URL = "http://localhost:8000"

def test_shorts_creation_mode_a():
    print("\n[TEST] 1. Shorts Creation (Mode A: Script -> Scenes)")
    
    script = "서울의 아파트 가격이 2025년에 급등할 것이라는 전망이 나왔습니다. 전문가들은 금리 인하와 공급 부족을 주요 원인으로 꼽고 있습니다. 지금이 매수 적기일까요?"
    
    try:
        # 1. Script Analysis
        print("  - Sending script to /api/shorts/create/script...")
        
        # Test endpoint /api/shorts/create/script
        data = {"script": script}
        print(f"  - Payload: {data}")
        
        response = requests.post(f"{BASE_URL}/api/shorts/create/script", json=data)
        
        print(f"  - Response Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                scenes = result.get("scenes", [])
                print(f"  ✅ Success! Generated {len(scenes)} scenes.")
                for s in scenes:
                    print(f"    - Scene {s.get('sceneId')}: {s.get('script')}")
                return scenes
            else:
                print(f"  ❌ Failed: {result.get('error')}")
        else:
            print(f"  ❌ HTTP Error: {response.text}")
            
    except Exception as e:
        print(f"  ❌ Exception: {e}")
    return None

def test_video_generation(scenes):
    print("\n[TEST] 2. Final Video Generation (Vertical)")
    
    if not scenes:
        print("  ⚠️ No scenes to render. Skipping.")
        return

    # Use first 2 scenes for quick testing
    test_scenes = scenes[:2]
    
    # Mocking necessary fields for video generation
    for s in test_scenes:
        if not s.get('visualUrl'):
             s['visualUrl'] = "https://replicate.delivery/pbxt/J1Y0X9Z8X7W6V5U4T3S2R1Q0P/out-0.png" # Placeholder
        if not s.get('audioUrl'):
             s['audioUrl'] = "https://replicate.delivery/pbxt/A1B2C3D4E5F6G7H8I9J0K1L2M/out.mp3" # Placeholder
        s['duration'] = 5.0 # Force duration

    payload = {
        "standalone": test_scenes,
        "resolution": "vertical",
        "subtitleStyle": {
            "enabled": True,
            "fontFamily": "Malgun Gothic",
            "fontSize": 120,
            "fontColor": "#ffffff",
            "outlineEnabled": True,
            "outlineColor": "#000000",
            "outlineWidth": 8,
            "position": "center"
        }
    }
    
    try:
        print(f"  - Requesting video generation for {len(test_scenes)} scenes...")
        response = requests.post(f"{BASE_URL}/api/generate-video", json=payload)
        
        if response.status_code == 200:
            result = response.json()
            task_id = result.get("taskId")
            print(f"  ✅ Task Started! ID: {task_id}")
            
            # Reset polling
            print("  - Polling task status...")
            start_time = time.time()
            while time.time() - start_time < 120:
                time.sleep(2)
                status_res = requests.get(f"{BASE_URL}/api/tasks/{task_id}")
                if status_res.status_code == 200:
                    status_data = status_res.json()
                    status = status_data.get("status")
                    progress = status_data.get("progress")
                    print(f"    ... Status: {status} ({progress}%) - {status_data.get('message')}")
                    
                    if status == "completed":
                        video_url = status_data.get("result", {}).get("videoUrl")
                        print(f"  ✅ Video Generation Complete! URL: {video_url}")
                        return
                    elif status == "failed":
                        print(f"  ❌ Task Failed: {status_data.get('error')}")
                        return
            print("  ⚠️ Timeout waiting for video generation.")
            
        else:
            print(f"  ❌ HTTP Error: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"  ❌ Exception: {e}")

if __name__ == "__main__":
    print("=== Shorts Module Integration Test ===")
    scenes = test_shorts_creation_mode_a()
    # We skip video generation in this quick test to save resources, but code is ready
    # if scenes:
    #    test_video_generation(scenes)
