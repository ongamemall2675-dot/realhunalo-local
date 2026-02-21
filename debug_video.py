import os
import subprocess
import shutil

ASSETS_DIR = r"c:\Users\ongam\antigravity project\realhunalo_local\assets"
OUTPUT_DIR = r"c:\Users\ongam\antigravity project\realhunalo_local\output"
VISUAL_FILE = "upload_c580b66f-63de-4f42-838f-0d598a5adbdf_001_scene_01_2D_flat_ve_1_20260119_162752.png"
VISUAL_PATH = os.path.join(ASSETS_DIR, VISUAL_FILE)
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "debug_segment.mp4")

def test_ffmpeg():
    print(f"Testing FFmpeg generation with {VISUAL_PATH}")
    
    if not os.path.exists(VISUAL_PATH):
        print(f"ERROR: Visual file not found at {VISUAL_PATH}")
        return

    cmd = [
        'ffmpeg', '-y',
        '-loop', '1',
        '-i', VISUAL_PATH,
        '-t', '5',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-pix_fmt', 'yuv420p',
        '-b:v', '5000k',
        #'-c:a', 'aac', # No audio input, so no audio codec needed unless we add silent audio
        '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100:d=5', # Add silent audio
        '-c:a', 'aac',
        '-shortest',
        OUTPUT_PATH
    ]
    
    print(f"Executing: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        
        if result.returncode != 0:
            print("FFmpeg FAILED")
            print("STDERR:", result.stderr)
            print("STDOUT:", result.stdout)
        else:
            print(f"FFmpeg SUCCESS. Output at {OUTPUT_PATH}")
            print(f"File size: {os.path.getsize(OUTPUT_PATH)} bytes")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_ffmpeg()
