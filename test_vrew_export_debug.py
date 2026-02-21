import os
import sys
import shutil
import zipfile
from services.vrew_service_new import vrew_service_new

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_vrew_export():
    print("Testing Vrew Export...")
    
    # Create dummy output dir
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    
    # Create dummy image
    dummy_image_path = os.path.join(output_dir, "test_image.png")
    with open(dummy_image_path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00"*100) # Dummy content
        
    # Dummy timeline data
    timeline_data = {
        "mergedGroups": [],
        "standalone": [
            {
                "sceneId": 1,
                "script": "Hello world",
                "duration": 5.0,
                "visualUrl": dummy_image_path, # Local file
                "generatedUrl": dummy_image_path,
                "audioPath": "", # No audio for this test
                "srtData": "1\n00:00:00,000 --> 00:00:05,000\nHello world"
            }
        ]
    }
    
    try:
        url = vrew_service_new.generate_vrew_project(timeline_data)
        print(f"Generated URL: {url}")
        
        filename = os.path.basename(url)
        filepath = os.path.join(output_dir, filename)
        
        if os.path.exists(filepath):
            print(f"File created at: {filepath}")
            with open(filepath, "rb") as f:
                header = f.read(2)
                if header == b'PK':
                    print("SUCCESS: File is a valid ZIP (starts with PK)")
                else:
                    print(f"FAILURE: File starts with {header}")
                    # Read first 100 bytes
                    f.seek(0)
                    print(f"Content start: {f.read(100)}")
            
            # Check zip content
            if zipfile.is_zipfile(filepath):
                with zipfile.ZipFile(filepath, 'r') as zf:
                    print("ZIP Content:")
                    for name in zf.namelist():
                        print(f" - {name}")
            else:
                print("FAILURE: zipfile module says it is not a zip file")
                
        else:
            print("FAILURE: File not found")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_vrew_export()
