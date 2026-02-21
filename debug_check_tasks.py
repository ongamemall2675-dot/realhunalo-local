
import requests
import json

try:
    response = requests.get("http://localhost:8000/api/debug/tasks")
    data = response.json()
    print(json.dumps(data, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Error fetching tasks: {e}")
