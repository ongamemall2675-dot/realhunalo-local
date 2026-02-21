import requests
import json

url = "http://localhost:8000/api/vrew/autofill"
# We need to send a dummy vrew file and media files using multipart/form-data
files = {
    'vrew_file': ('dummy.vrew', b'PK\x03\x04', 'application/octet-stream'),
    'media_files': ('test.jpg', b'dummy_image', 'image/jpeg')
}

try:
    response = requests.post(url, files=files)
    print("Status:", response.status_code)
    print("Response:", response.text[:200])
except Exception as e:
    print("Error:", e)
