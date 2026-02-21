import requests
import time
import sys
import os

def test_audio_segment():
    print("Testing /api/segment-audio-from-path...")
    url = "http://localhost:8000/api/segment-audio-from-path"
    
    # Find test audio
    test_file = None
    for d in ['assets', 'temp', 'output']:
        if os.path.exists(d):
            for f in os.listdir(d):
                if f.endswith('.mp3') or f.endswith('.wav'):
                    test_file = os.path.join(d, f)
                    break
        if test_file:
            break
            
    if not test_file:
        print("No test file found")
        return
        
    print(f"Using {test_file}")
    payload = {
        "audioPath": test_file,
        "maxChars": 30,
        "originalScript": "안녕하세요"
    }
    
    try:
        res = requests.post(url, json=payload)
        res.raise_for_status()
        data = res.json()
        task_id = data.get("taskId")
        print(f"Task ID received: {task_id}")
        
        while True:
            status_res = requests.get(f"http://localhost:8000/api/tasks/{task_id}")
            status_data = status_res.json()
            print(f"Status: {status_data['status']}, Progress: {status_data['progress']}%, Message: {status_data['message']}")
            
            if status_data['status'] == 'completed':
                print("Result SUCCESS")
                break
            elif status_data['status'] == 'failed':
                print("Error:", status_data.get('error'))
                break
                
            time.sleep(1)
            
    except Exception as e:
        print("Request failed:", str(e))

if __name__ == "__main__":
    test_audio_segment()
