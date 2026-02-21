import os
import json
import zipfile

output_dir = r'c:\Users\ongam\antigravity project\realhunalo_local\output'
vrew_files = [f for f in os.listdir(output_dir) if f.endswith('.vrew')]
vrew_files.sort(key=lambda x: os.path.getmtime(os.path.join(output_dir, x)), reverse=True)

if not vrew_files:
    print('No VREW files found')
    exit(0)

latest = os.path.join(output_dir, vrew_files[0])
print(f'Latest VREW: {vrew_files[0]} ({os.path.getsize(latest)} bytes)')

with zipfile.ZipFile(latest, 'r') as zf:
    data = json.loads(zf.read('project.json').decode('utf-8'))
    
    # 비디오 파일 찾기
    files = data.get('files', [])
    video_files = []
    audio_files = []
    image_files = []
    
    for f in files:
        file_type = f.get('type', 'Unknown')
        if file_type == 'AVMedia':
            meta = f.get('videoAudioMetaInfo', {})
            if 'videoInfo' in meta:
                video_files.append(f)
            elif 'audioInfo' in meta:
                audio_files.append(f)
        elif file_type == 'Image':
            image_files.append(f)
    
    print(f'Total files: {len(files)}')
    print(f'  - Video files: {len(video_files)}')
    print(f'  - Audio files: {len(audio_files)}')
    print(f'  - Image files: {len(image_files)}')
    
    if video_files:
        print('\nVideo files found:')
        for vf in video_files:
            print(f'  - {vf.get("name", "unknown")}: {vf.get("fileSize", 0)} bytes')
    else:
        print('\nNo video files in VREW')
    
    # ZIP 내 실제 파일 확인
    print('\nFiles in ZIP:')
    for name in zf.namelist():
        info = zf.getinfo(name)
        print(f'  {name}: {info.file_size} bytes')
        
    # 확장자별 분류
    video_exts = ['.mp4', '.mov', '.avi', '.webm', '.m4v']
    audio_exts = ['.mp3', '.mpga', '.wav', '.m4a']
    image_exts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
    
    video_in_zip = []
    audio_in_zip = []
    image_in_zip = []
    
    for name in zf.namelist():
        if name.startswith('media/'):
            ext = os.path.splitext(name)[1].lower()
            info = zf.getinfo(name)
            if ext in video_exts:
                video_in_zip.append((name, info.file_size))
            elif ext in audio_exts:
                audio_in_zip.append((name, info.file_size))
            elif ext in image_exts:
                image_in_zip.append((name, info.file_size))
    
    print(f'\nMedia files in ZIP:')
    print(f'  - Video files: {len(video_in_zip)}')
    for v in video_in_zip:
        print(f'    {v[0]}: {v[1]} bytes')
    print(f'  - Audio files: {len(audio_in_zip)}')
    print(f'  - Image files: {len(image_in_zip)}')