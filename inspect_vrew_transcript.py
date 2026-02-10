import zipfile
import json
import os

vrew_path = r"c:\Users\ongam\antigravity project\realhunalo_local\uploadtemp\양도세 중과유예.vrew"

try:
    with zipfile.ZipFile(vrew_path, 'r') as z:
        if 'project.json' in z.namelist():
            with z.open('project.json') as f:
                data = json.load(f)
                transcripts = data.get('transcript', [])
                print(json.dumps(transcripts, indent=2)[:3000]) # First 3000 chars of transcript
        else:
            print("project.json not found")
except Exception as e:
    print(f"Error: {e}")
