import requests

url = "http://localhost:8000/api/check-saved-keys"
try:
    response = requests.get(url)
    print("Status:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Error:", e)
