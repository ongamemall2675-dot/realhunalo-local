import zipfile
import json
import os

vrew_path = r"c:\Users\ongam\antigravity project\realhunalo_local\uploadtemp\양도세 중과유예.vrew"

try:
    with zipfile.ZipFile(vrew_path, 'r') as z:
        if 'project.json' in z.namelist():
            with z.open('project.json') as f:
                data = json.load(f)
                # Print a simplified structure to avoid huge output, 
                # focusing on 'clips' or 'scenes' which are likely the main part
                print(json.dumps(data, indent=2)[:2000]) 
                
                # Check for specific keys
                print("\n--- Keys in root ---")
                print(list(data.keys()))
                
        else:
            print("project.json not found in archive")

except Exception as e:
    print(f"Error: {e}")
