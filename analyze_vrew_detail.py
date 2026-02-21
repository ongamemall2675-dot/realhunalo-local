import zipfile
import json
import os

# 최신 VREW 파일 찾기
output_dir = r'c:\Users\ongam\antigravity project\realhunalo_local\output'
vrew_files = [f for f in os.listdir(output_dir) if f.endswith('.vrew')]
vrew_files.sort(key=lambda x: os.path.getmtime(os.path.join(output_dir, x)), reverse=True)

if not vrew_files:
    print('VREW 파일이 존재하지 않습니다.')
    exit(1)

latest_vrew = os.path.join(output_dir, vrew_files[0])
print(f'분석할 VREW 파일: {latest_vrew}')
print(f'파일 크기: {os.path.getsize(latest_vrew)} bytes')

try:
    with zipfile.ZipFile(latest_vrew, 'r') as zf:
        # project.json 분석
        if 'project.json' not in zf.namelist():
            print('project.json이 없습니다.')
            exit(1)
            
        data = json.loads(zf.read('project.json').decode('utf-8'))
        
        # files 섹션 분석 - 타입별 상세 분석
        media_files = data.get('files', [])
        print(f'\n=== Media Files 분석 ({len(media_files)}개) ===')
        
        avmedia_count = 0
        image_count = 0
        video_count = 0
        
        for i, mf in enumerate(media_files):
            file_type = mf.get('type', 'Unknown')
            name = mf.get('name', '?')
            size = mf.get('fileSize', 0)
            media_id = mf.get('mediaId', '?')
            
            if file_type == 'AVMedia':
                # AVMedia인 경우, videoAudioMetaInfo에서 비디오 정보 확인
                meta = mf.get('videoAudioMetaInfo', {})
                if 'videoInfo' in meta:
                    video_count += 1
                    video_info = meta.get('videoInfo', {})
                    print(f'  {i+1}. [VIDEO] {name} (size: {size}, mediaId: {media_id})')
                    print(f'      Resolution: {video_info.get("width", "?")}x{video_info.get("height", "?")}, Codec: {video_info.get("codec", "?")}')
                else:
                    avmedia_count += 1
                    audio_info = meta.get('audioInfo', {})
                    print(f'  {i+1}. [AUDIO] {name} (size: {size}, mediaId: {media_id})')
                    print(f'      SampleRate: {audio_info.get("sampleRate", "?")}, Codec: {audio_info.get("codec", "?")}')
            elif file_type == 'Image':
                image_count += 1
                print(f'  {i+1}. [IMAGE] {name} (size: {size}, mediaId: {media_id})')
            else:
                print(f'  {i+1}. [UNKNOWN] {name} (type: {file_type}, size: {size})')
        
        print(f'\n=== 통계 ===')
        print(f'  Audio files: {avmedia_count}')
        print(f'  Video files: {video_count}')
        print(f'  Image files: {image_count}')
        print(f'  Total: {len(media_files)}')
        
        # Assets 분석 - 비디오 타입 확인
        assets = data.get('props', {}).get('assets', {})
        print(f'\n=== Assets 분석 ({len(assets)}개) ===')
        
        video_assets = 0
        image_assets = 0
        
        for aid, asset in assets.items():
            asset_type = asset.get('type', 'unknown')
            media_id = asset.get('mediaId', '?')
            if asset_type == 'video':
                video_assets += 1
                print(f'  [VIDEO] {aid}: mediaId={media_id}')
            elif asset_type == 'image':
                image_assets += 1
                print(f'  [IMAGE] {aid}: mediaId={media_id}')
            else:
                print(f'  [UNKNOWN] {aid}: type={asset_type}, mediaId={media_id}')
        
        print(f'\nAssets 통계:')
        print(f'  Video assets: {video_assets}')
        print(f'  Image assets: {image_assets}')
        
        # ZIP 내 실제 파일 확인
        print(f'\n=== ZIP 내 실제 파일 ===')
        media_dir_files = [f for f in zf.namelist() if f.startswith('media/')]
        
        video_extensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv']
        audio_extensions = ['.mp3', '.mpga', '.wav', '.m4a']
        image_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
        
        video_files = []
        audio_files = []
        image_files = []
        other_files = []
        
        for mf in media_dir_files:
            ext = os.path.splitext(mf)[1].lower()
            info = zf.getinfo(mf)
            
            if ext in video_extensions:
                video_files.append((mf, info.file_size))
            elif ext in audio_extensions:
                audio_files.append((mf, info.file_size))
            elif ext in image_extensions:
                image_files.append((mf, info.file_size))
            else:
                other_files.append((mf, info.file_size))
        
        print(f'Video files in ZIP: {len(video_files)}')
        for vf, size in video_files[:10]:
            print(f'  {vf}: {size} bytes')
        
        print(f'\nAudio files in ZIP: {len(audio_files)}')
        for af, size in audio_files[:10]:
            print(f'  {af}: {size} bytes')
        
        print(f'\nImage files in ZIP: {len(image_files)}')
        for img, size in image_files[:10]:
            print(f'  {img}: {size} bytes')
        
        if other_files:
            print(f'\nOther files in ZIP: {len(other_files)}')
            for of, size in other_files[:10]:
                print(f'  {of}: {size} bytes')
                
except Exception as e:
    print(f'파일 분석 중 오류: {e}')
    import traceback
    traceback.print_exc()