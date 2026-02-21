
import requests
import time
import json

def test_full_segmentation_flow():
    print("--- Starting Full Segmentation Integration Test ---")
    base_url = "http://localhost:8000"
    
    payload = {
        "script": "안녕하세요. 이것은 통합 테스트입니다. 한 문장 더 추가합니다.",
        "model": "deepseek-chat"
    }
    
    try:
        print(f"1. Sending request to {base_url}/api/script/segment...")
        r = requests.post(f"{base_url}/api/script/segment", json=payload)
        r.raise_for_status()
        data = r.json()
        
        if not data.get("success"):
            print(f"[FAILED] API returned success: False. Error: {data.get('error')}")
            return
            
        task_id = data.get("taskId")
        print(f"2. Task ID received: {task_id}")
        
        print("3. Swiching to Polling...")
        start_time = time.time()
        timeout = 60 # 60 seconds
        
        while time.time() - start_time < timeout:
            res_r = requests.get(f"{base_url}/api/tasks/{task_id}")
            res_r.raise_for_status()
            res = res_r.json()
            
            status = res.get("status")
            message = res.get("message")
            print(f"   [Polling] Status: {status}, Message: {message}")
            
            if status == "completed":
                print("\n[SUCCESS] Task completed!")
                print("Resulting Script:")
                print("-" * 30)
                print(res.get("result", {}).get("originalScript"))
                print("-" * 30)
                return
            elif status == "failed":
                print(f"\n[FAILED] Task failed. Error: {res.get('error')}")
                return
                
            time.sleep(2)
            
        print("\n[FAILED] Polling timeout reached.")
        
    except Exception as e:
        print(f"\n[EXCEPTION] {str(e)}")

if __name__ == "__main__":
    test_full_segmentation_flow()
