import requests
import time
import sys

def test_image_prompts():
    print("Testing /api/generate-image-prompts-batch...")
    url = "http://localhost:8000/api/generate-image-prompts-batch"
    payload = {
        "scenes": [
            {"sceneId": 1, "script": "안녕하세요. 반갑습니다."}
        ],
        "imgSettings": {"stylePrompt": "realistic"}
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
                print("Result:", status_data['result'])
                break
            elif status_data['status'] == 'failed':
                print("Error:", status_data['error'])
                break
                
            time.sleep(1)
            
    except Exception as e:
        print("Request failed:", str(e))

if __name__ == "__main__":
    test_image_prompts()
