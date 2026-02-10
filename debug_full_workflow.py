import requests
import json
import time
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "http://localhost:8001"

def run_test():
    print("🚀 Starting FULL WORKFLOW Test...")
    
    # 1. Script Generation
    print("\n[Step 1] Generating Script...")
    script_payload = {
        "topic": "Future of AI automation",
        "style": "engaging",
        "settings": {"model": "gpt-4o-mini"}
    }
    
    try:
        res = requests.post(f"{BASE_URL}/api/generate-script", json=script_payload)
        if res.status_code != 200:
            print(f"❌ Script API Failed: {res.status_code} {res.text}")
            return
        
        script_data = res.json()
        if not script_data.get("success"):
            print(f"❌ Script Generation Failed: {script_data.get('error')}")
            print(f"   Raw Content: {script_data.get('raw_content', 'N/A')}")
            return
            
        scenes = script_data.get("scenes", [])
        print(f"✅ Script Generated: {len(scenes)} scenes")
        
        if not scenes:
            print("❌ No scenes returned!")
            return

        first_scene = scenes[0]
        scene_id = first_scene.get("sceneId")
        image_prompt = first_scene.get("imagePrompt") or first_scene.get("visualPrompt")
        original_script = first_scene.get("originalScript") or first_scene.get("script")
        
        print(f"📝 First Scene Data:")
        print(f"   - ID: {scene_id}")
        print(f"   - Image Prompt: {image_prompt[:50]}...")
        print(f"   - Script: {original_script[:50]}...")
        
        if not image_prompt or not original_script:
            print("❌ MISSING KEY DATA in Scene 1!")
            return

        # 2. Image Generation
        print("\n[Step 2] Generating Image for Scene 1...")
        image_payload = {
            "prompt": image_prompt,
            "settings": {
                "model": "black-forest-labs/flux-schnell",
                "aspectRatio": "16:9",
                "numOutputs": 1
            }
        }
        
        start_t = time.time()
        res = requests.post(f"{BASE_URL}/api/generate-image", json=image_payload)
        elapsed = time.time() - start_t
        
        if res.status_code == 200:
            img_data = res.json()
            if img_data.get("imageUrl"):
                print(f"✅ Image Generated: {img_data['imageUrl'][:50]}... ({elapsed:.1f}s)")
            else:
                print(f"❌ Image Generation Failed: {img_data}")
        else:
            print(f"❌ Image API Failed: {res.status_code} {res.text}")

        # 3. TTS Generation
        print("\n[Step 3] Generating TTS for Scene 1...")
        tts_payload = {
            "sceneId": scene_id,
            "text": original_script,
            "settings": {
                "engine": "elevenlabs",
                "voiceId": "zcAOhNBS3c14rBihAFp1", # default
                "stability": 0.5,
                "speed": 1.0
            }
        }
        
        start_t = time.time()
        res = requests.post(f"{BASE_URL}/api/generate-tts", json=tts_payload)
        elapsed = time.time() - start_t
        
        if res.status_code == 200:
            tts_data = res.json()
            if tts_data.get("audioUrl"):
                print(f"✅ TTS Generated: {tts_data['audioUrl'][:50]}... ({elapsed:.1f}s)")
            else:
                print(f"❌ TTS Generation Failed: {tts_data}")
        else:
            print(f"❌ TTS API Failed: {res.status_code} {res.text}")

        print("\n🎉 Full Workflow Test Completed!")

    except Exception as e:
        print(f"❌ EXCEPTION: {e}")

if __name__ == "__main__":
    run_test()
