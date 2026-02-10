import zipfile
import os

vrew_path = r"c:\Users\ongam\antigravity project\realhunalo_local\uploadtemp\양도세 중과유예.vrew"

try:
    if not zipfile.is_zipfile(vrew_path):
        print("Not a zip file")
    else:
        with zipfile.ZipFile(vrew_path, 'r') as z:
            print("Files in archive:")
            for name in z.namelist():
                print(f"- {name}")
                
            # Try to read project data file if it exists
            # Common names: project.json, data.xml, etc.
            # I'll look for json or xml files
            for name in z.namelist():
                if name.endswith('.json') or name.endswith('.xml'):
                    print(f"\n--- Content of {name} (first 500 chars) ---")
                    try:
                        with z.open(name) as f:
                            content = f.read().decode('utf-8')[:500]
                            print(content)
                    except Exception as e:
                        print(f"Error reading {name}: {e}")

except Exception as e:
    print(f"Error: {e}")
