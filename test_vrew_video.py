import os
import sys
sys.path.append('.')
from services.vrew_service_new import vrew_service_new

# 샘플 타임라인 데이터 생성 (비디오 URL 포함)
sample_timeline = {
    "mergedGroups": [],
    "standalone": [
        {
            "text": "첫 번째 씬입니다.",
            "script": "첫 번째 씬입니다.",
            "duration": 5.0,
            "audioUrl": "/output/segments/62d15761/merged_audio.mp3#t=0,5",
            "videoUrl": "/output/001_grok-video-4d9946c3-3bce-4994-a72a-280e8723f3ff.mp4",
            "visualUrl": None,
            "generatedUrl": None,
            "sceneId": 1,
            "isVideo": True
        },
        {
            "text": "두 번째 씬입니다.",
            "script": "두 번째 씬입니다.",
            "duration": 5.0,
            "audioUrl": "/output/segments/62d15761/merged_audio.mp3#t=5,10",
            "videoUrl": "/output/001_grok-video-4d9946c3-3bce-4994-a72a-280e8723f3ff.mp4#t=0,5",
            "visualUrl": None,
            "generatedUrl": None,
            "sceneId": 2,
            "isVideo": True
        }
    ]
}

print("비디오 파일 존재 여부 확인:")
video_urls = [
    "/output/001_grok-video-4d9946c3-3bce-4994-a72a-280e8723f3ff.mp4",
    "/output/segments/62d15761/merged_audio.mp3"
]

for url in video_urls:
    exists = vrew_service_new._check_file_exists(url)
    print(f"  {url}: {exists}")

print("\nVREW 생성 테스트...")
try:
    result = vrew_service_new.generate_vrew_project(sample_timeline)
    print(f"결과: {result}")
    
    # 생성된 VREW 파일 확인
    output_dir = "c:/Users/ongam/antigravity project/realhunalo_local/output"
    vrew_files = [f for f in os.listdir(output_dir) if f.endswith('.vrew')]
    vrew_files.sort(key=lambda x: os.path.getmtime(os.path.join(output_dir, x)), reverse=True)
    
    if vrew_files:
        latest = os.path.join(output_dir, vrew_files[0])
        print(f"\n생성된 VREW 파일: {vrew_files[0]}")
        
        # 파일 분석
        import zipfile
        import json
        
        with zipfile.ZipFile(latest, 'r') as zf:
            data = json.loads(zf.read('project.json').decode('utf-8'))
            
            # 비디오 파일 찾기
            files = data.get('files', [])
            video_count = 0
            audio_count = 0
            image_count = 0
            
            for f in files:
                file_type = f.get('type', 'Unknown')
                if file_type == 'AVMedia':
                    meta = f.get('videoAudioMetaInfo', {})
                    if 'videoInfo' in meta:
                        video_count += 1
                        print(f"  Video: {f.get('name')} ({f.get('fileSize')} bytes)")
                    elif 'audioInfo' in meta:
                        audio_count += 1
                elif file_type == 'Image':
                    image_count += 1
            
            print(f"\n분석 결과:")
            print(f"  Video files: {video_count}")
            print(f"  Audio files: {audio_count}")
            print(f"  Image files: {image_count}")
            
            if video_count == 0:
                print("\n⚠️ 비디오 파일이 포함되지 않았습니다!")
                print("문제 원인 분석:")
                print("  1. videoUrl이 실제로 존재하는지 확인")
                print("  2. _check_file_exists 함수 작동 확인")
                print("  3. visual_url 선택 로직 확인")
        
except Exception as e:
    print(f"오류 발생: {e}")
    import traceback
    traceback.print_exc()