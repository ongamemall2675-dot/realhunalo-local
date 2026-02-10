import requests
import time
import json

BASE_URL = "http://localhost:8000"

def test_full_workflow():
    print("🚀 [START] 전체 워크플로우 통합 테스트...")

    # 1. 대본 생성
    print("\n[1] 📝 대본 생성 중 (Script)...")
    res = requests.post(f"{BASE_URL}/api/generate-script", json={
        "topic": "부동산 투자 전략 2026",
        "style": "informative"
    })
    if res.status_code == 200:
        print("✅ 대본 생성 성공")
    else:
        print(f"❌ 대본 생성 실패: {res.text}")
        return

    # 2. 이미지 생성
    print("\n[2] 🎨 이미지 생성 중 (Image)...")
    res = requests.post(f"{BASE_URL}/api/generate-image", json={
        "prompt": "futuristic real estate building, hyper-realistic, 8k",
        "settings": {"model": "black-forest-labs/flux-schnell"}
    })
    if res.status_code == 200:
        image_url = res.json().get('imageUrl') # imageUrl로 수정
        print(f"✅ 이미지 생성 성공 (Base64 데이터 수신)")
    else:
        print(f"❌ 이미지 생성 실패: {res.text}")
        image_url = "http://localhost:8000/assets/placeholder.png"

    # 3. 모션 생성 (Motion)
    print("\n[3] 🎬 모션 생성 중 (Motion)...")
    res = requests.post(f"{BASE_URL}/api/generate-motion", json={
        "sceneId": "scene_01", # sceneId 추가
        "imageUrl": image_url,
        "motionPrompt": "Slow cinematic zoom in" # motionType -> motionPrompt
    })
    if res.status_code == 200:
        motion_url = res.json().get('videoUrl')
        print(f"✅ 모션 생성 성공: {motion_url}")
    else:
        print(f"❌ 모션 생성 실패: {res.text}")
        motion_url = image_url # Fallback to static image

    # 4. TTS 생성
    print("\n[4] 🎤 TTS 생성 중 (TTS)...")
    res = requests.post(f"{BASE_URL}/api/generate-tts", json={
        "text": "안녕하세요, 2026년 부동산 시장의 새로운 패러다임을 소개합니다.",
        "sceneId": "scene_01"
    })
    if res.status_code == 200:
        audio_url = res.json().get('audioUrl')
        print(f"✅ TTS 생성 성공: {audio_url}")
    else:
        print(f"❌ TTS 생성 실패: {res.text}")
        audio_url = "http://localhost:8000/assets/placeholder.mp3"

    # 5. 최종 영상 생성 및 Vrew 내보내기 (비동기 처리)
    print("\n[5-1] 📽️ 최종 영상 생성 시작 (Video Task)...")
    video_request = {
        "mergedGroups": [],
        "standalone": [{
            "sceneId": "scene_01",
            "visualUrl": motion_url,
            "audioUrl": audio_url,
            "duration": 5.0,
            "script": "안녕하세요, 2026년 부동산 시장의 새로운 패러다임을 소개합니다."
        }]
    }
    res = requests.post(f"{BASE_URL}/api/generate-video", json=video_request)
    if res.status_code == 200:
        task_id = res.json().get('taskId')
        print(f"✅ 영상 작업 시작됨 (Task ID: {task_id})")
        
        # Polling for completion
        for _ in range(30):
            time.sleep(3)
            status = requests.get(f"{BASE_URL}/api/tasks/{task_id}").json()
            print(f"   - 상태: {status['status']} ({status['progress']}%) : {status['message']}")
            if status['status'] == 'completed':
                print(f"🎬 최종 영상 완료: {status['result']['videoUrl']}")
                break
            if status['status'] == 'failed':
                print(f"❌ 영상 생성 실패: {status['error']}")
                break

    print("\n[5-2] 📅 Vrew 프로젝트 내보내기 (Vrew Task)...")
    res = requests.post(f"{BASE_URL}/api/export-vrew", json=video_request)
    if res.status_code == 200:
        task_id = res.json().get('taskId')
        print(f"✅ Vrew 작업 시작됨 (Task ID: {task_id})")
        
        for _ in range(10):
            time.sleep(2)
            status = requests.get(f"{BASE_URL}/api/tasks/{task_id}").json()
            print(f"   - 상태: {status['status']} ({status['progress']}%) : {status['message']}")
            if status['status'] == 'completed':
                print(f"📁 Vrew 파일 완료: {status['result']['vrewUrl']}")
                break

    print("\n🚀 [FINISH] 모든 테스트가 완료되었습니다.")

if __name__ == "__main__":
    test_full_workflow()
