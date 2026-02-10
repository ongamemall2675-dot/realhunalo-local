import requests
import time
import json

BASE_URL = "http://localhost:8000"

def test_api():
    print("🚀 API 통합 테스트 시작...")

    # 1. 대본 생성 테스트
    print("\n[1] 대본 생성 (Script)...")
    script_payload = {
        "topic": "부동산 투자 전략 2026",
        "style": "informative",
        "settings": {"model": "gpt-4o-mini", "temperature": 0.7}
    }
    # Mocking script generation for speed/cost if needed, but let's try real call
    # Note: If no API key, this might fail. processing gracefully.
    try:
        res = requests.post(f"{BASE_URL}/api/generate-script", json=script_payload)
        if res.status_code == 200:
            print("✅ 대본 생성 성공")
            # print(res.json()[:100])
        else:
            print(f"❌ 대본 생성 실패: {res.text}")
    except Exception as e:
        print(f"❌ 대본 생성 오류: {e}")

    # 2. 이미지 생성 테스트
    print("\n[2] 이미지 생성 (Image)...")
    image_payload = {
        "prompt": "futuristic city skyline, high quality, 8k",
        "settings": {"model": "black-forest-labs/flux-schnell", "aspectRatio": "16:9"}
    }
    try:
        res = requests.post(f"{BASE_URL}/api/generate-image", json=image_payload)
        if res.status_code == 200:
            image_result = res.json()
            image_url = image_result.get('url')
            print(f"✅ 이미지 생성 성공: {image_url}")
        else:
            print(f"❌ 이미지 생성 실패: {res.text}")
            image_url = None
    except Exception as e:
        print(f"❌ 이미지 생성 오류: {e}")
        image_url = None

    # 3. TTS 생성 테스트
    print("\n[3] TTS 생성 (TTS)...")
    tts_payload = {
        "text": "안녕하세요, 2026년 부동산 트렌드를 알려드리겠습니다.",
        "sceneId": "test_scene_01",
        "settings": {"voiceId": "nPczCjzI2devNBz1zQrb"}
    }
    try:
        res = requests.post(f"{BASE_URL}/api/generate-tts", json=tts_payload)
        if res.status_code == 200:
            tts_result = res.json()
            audio_url = tts_result.get('audioUrl')
            print(f"✅ TTS 생성 성공: {audio_url}")
        else:
            print(f"❌ TTS 생성 실패: {res.text}")
            audio_url = None
    except Exception as e:
        print(f"❌ TTS 생성 오류: {e}")
        audio_url = None

    # 4. 영상/Vrew 생성 시뮬레이션
    # 위에서 생성된(또는 더미) URL 사용
    if not image_url: image_url = "http://localhost:8000/assets/placeholder.png" # Fallback
    if not audio_url: audio_url = "http://localhost:8000/assets/placeholder.mp3" # Fallback
    
    scene_data = {
        "sceneId": "test_scene_01",
        "visualUrl": image_url,
        "audioUrl": audio_url,
        "duration": 3,
        "script": "안녕하세요 부동산입니다."
    }
    
    video_request = {
        "mergedGroups": [],
        "standalone": [scene_data]
    }

    # 4-1. Vrew 내보내기 테스트
    print("\n[4] Vrew 내보내기 (Export)...")
    try:
        res = requests.post(f"{BASE_URL}/api/export-vrew", json=video_request)
        if res.status_code == 200:
            task_id = res.json().get('taskId')
            print(f"✅ Vrew 작업 시작됨. Task ID: {task_id}")
            
            # Polling
            for _ in range(10):
                time.sleep(2)
                status_res = requests.get(f"{BASE_URL}/api/tasks/{task_id}")
                status_data = status_res.json()
                print(f"   - 상태: {status_data['status']}, 진행률: {status_data['progress']}%")
                if status_data['status'] == 'completed':
                    print(f"✅ Vrew 생성 완료: {status_data['result'].get('vrewUrl')}")
                    break
                if status_data['status'] == 'failed':
                    print(f"❌ Vrew 생성 실패: {status_data.get('error')}")
                    break
        else:
            print(f"❌ Vrew 요청 실패: {res.text}")
    except Exception as e:
        print(f"❌ Vrew 테스트 오류: {e}")

    # 4-2. 최종 영상 생성 테스트
    print("\n[5] 최종 영상 생성 (Video)...")
    try:
        res = requests.post(f"{BASE_URL}/api/generate-video", json=video_request)
        if res.status_code == 200:
            task_id = res.json().get('taskId')
            print(f"✅ 영상 작업 시작됨. Task ID: {task_id}")
            
            # Polling
            for _ in range(30): # Video takes longer
                time.sleep(2)
                status_res = requests.get(f"{BASE_URL}/api/tasks/{task_id}")
                status_data = status_res.json()
                print(f"   - 상태: {status_data['status']}, 진행률: {status_data['progress']}%")
                if status_data['status'] == 'completed':
                    print(f"✅ 영상 생성 완료: {status_data['result'].get('videoUrl')}")
                    break
                if status_data['status'] == 'failed':
                    print(f"❌ 영상 생성 실패: {status_data.get('error')}")
                    break
        else:
            print(f"❌ 영상 요청 실패: {res.text}")
    except Exception as e:
        print(f"❌ 영상 테스트 오류: {e}")

if __name__ == "__main__":
    test_api()
