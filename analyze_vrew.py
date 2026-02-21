import zipfile
import json
import os

vrew_path = r'c:\Users\ongam\antigravity project\realhunalo_local\output\vrew_project_b7829b84.vrew'

if not os.path.exists(vrew_path):
    print('VREW 파일이 존재하지 않습니다.')
    exit(1)

print(f'VREW 파일 크기: {os.path.getsize(vrew_path)} bytes')

try:
    with zipfile.ZipFile(vrew_path, 'r') as zf:
        files = zf.namelist()
        print(f'\nZIP 내 파일 수: {len(files)}')
        print('ZIP 파일 목록:')
        for f in files:
            info = zf.getinfo(f)
            print(f'  {f}: {info.file_size} bytes')
        
        # project.json 분석
        if 'project.json' in files:
            data = json.loads(zf.read('project.json').decode('utf-8'))
            
            # files 섹션 분석
            media_files = data.get('files', [])
            print(f'\nproject.json 내 media 파일 수: {len(media_files)}')
            
            # 파일 타입별 통계
            audio_count = 0
            image_count = 0
            video_count = 0
            
            for i, mf in enumerate(media_files):
                file_type = mf.get('type', 'Unknown')
                name = mf.get('name', '?')
                size = mf.get('fileSize', 0)
                
                if 'AVMedia' in file_type:
                    audio_count += 1
                elif 'Image' in file_type:
                    image_count += 1
                
                if i < 20:  # 처음 20개만 출력
                    print(f'  {i+1}. {name} (type: {file_type}, size: {size})')
            
            print(f'\n파일 타입 통계:')
            print(f'  Audio (AVMedia): {audio_count}')
            print(f'  Image: {image_count}')
            print(f'  Video: {video_count}')
            
            # assets 섹션 분석
            assets = data.get('props', {}).get('assets', {})
            print(f'\nAssets 수: {len(assets)}')
            for i, (aid, asset) in enumerate(list(assets.items())[:10]):
                print(f'  {i+1}. {aid}: mediaId={asset.get("mediaId")}, type={asset.get("type")}')
            
            # media/ 디렉토리 파일과 files 항목 비교
            media_dir_files = [f for f in files if f.startswith('media/')]
            print(f'\nmedia/ 디렉토리 실제 파일 수: {len(media_dir_files)}')
            
            # media 파일 크기 확인 (0바이트 파일 찾기)
            zero_size_files = []
            for mf in media_dir_files:
                info = zf.getinfo(mf)
                if info.file_size == 0:
                    zero_size_files.append(mf)
            
            if zero_size_files:
                print(f'\n⚠️ 0바이트 파일 발견 ({len(zero_size_files)}개):')
                for zf_file in zero_size_files:
                    print(f'  - {zf_file}')
            else:
                print('\n✅ 모든 media 파일이 유효한 크기를 가짐')
                
except Exception as e:
    print(f'파일 분석 중 오류: {e}')
    import traceback
    traceback.print_exc()