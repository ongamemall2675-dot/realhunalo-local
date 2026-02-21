import os
import sys
sys.path.append('.')
from services.vrew_service_new import vrew_service_new

# 다양한 비디오 URL 시나리오 테스트
test_cases = [
    {
        "name": "상대 경로 (/output/...)",
        "video_url": "/output/001_grok-video-4d9946c3-3bce-4994-a72a-280e8723f3ff.mp4",
        "expected_exists": True
    },
    {
        "name": "로컬호스트 URL",
        "video_url": "http://localhost:8000/output/001_grok-video-4d9946c3-3bce-4994-a72a-280e8723f3ff.mp4",
        "expected_exists": True
    },
    {
        "name": "절대 경로 (Windows)",
        "video_url": r"C:\Users\ongam\antigravity project\realhunalo_local\output\001_grok-video-4d9946c3-3bce-4994-a72a-280e8723f3ff.mp4",
        "expected_exists": True
    },
    {
        "name": "프래그먼트 포함 URL",
        "video_url": "/output/001_grok-video-4d9946c3-3bce-4994-a72a-280e8723f3ff.mp4#t=0,5",
        "expected_exists": True  # 프래그먼트 제거 후 확인
    },
    {
        "name": "존재하지 않는 파일",
        "video_url": "/output/nonexistent_video.mp4",
        "expected_exists": False
    },
    {
        "name": "HTTP 외부 URL (예시)",
        "video_url": "https://example.com/sample_video.mp4",
        "expected_exists": False  # 실제로 존재하지 않음
    },
    {
        "name": "파일명만 (output 디렉토리에서 찾기)",
        "video_url": "001_grok-video-4d9946c3-3bce-4994-a72a-280e8723f3ff.mp4",
        "expected_exists": True
    },
    {
        "name": "data: URI (이미지 데이터)",
        "video_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "expected_exists": False  # 비디오 파일 아님
    }
]

print("=" * 60)
print("VREW 비디오 파일 처리 종합 테스트")
print("=" * 60)

# 1. _check_file_exists 함수 테스트
print("\n1. _check_file_exists 함수 테스트")
print("-" * 40)

for test in test_cases:
    result = vrew_service_new._check_file_exists(test["video_url"])
    status = "✓" if result == test["expected_exists"] else "✗"
    print(f"{status} {test['name']}:")
    print(f"  URL: {test['video_url'][:80]}...")
    print(f"  결과: {result} (기대값: {test['expected_exists']})")
    
    # 프래그먼트 처리 확인
    if '#t=' in test['video_url']:
        clean_url = test['video_url'].split('#t=')[0]
        print(f"  프래그먼트 제거 후: {clean_url}")

# 2. 실제 VREW 생성 테스트 (다양한 케이스)
print("\n\n2. 실제 VREW 생성 테스트")
print("-" * 40)

# 테스트용 타임라인 생성
sample_timeline = {
    "mergedGroups": [],
    "standalone": []
}

# 존재하는 비디오 파일이 있는 씬 추가
for i, test in enumerate(test_cases[:4]):  # 처음 4개 케이스만 테스트
    scene = {
        "text": f"테스트 씬 {i+1}: {test['name']}",
        "script": f"테스트 씬 {i+1}: {test['name']}",
        "duration": 5.0,
        "audioUrl": "/output/segments/62d15761/merged_audio.mp3#t=0,5",
        "videoUrl": test["video_url"],
        "visualUrl": None,
        "generatedUrl": None,
        "sceneId": i+1,
        "isVideo": True
    }
    sample_timeline["standalone"].append(scene)

print(f"총 {len(sample_timeline['standalone'])}개 씬으로 VREW 생성 테스트")
print("첫 번째 씬 정보:")
print(f"  - videoUrl: {sample_timeline['standalone'][0]['videoUrl']}")
print(f"  - _check_file_exists 결과: {vrew_service_new._check_file_exists(sample_timeline['standalone'][0]['videoUrl'])}")

# VREW 생성
try:
    print("\nVREW 생성 중...")
    vrew_url = vrew_service_new.generate_vrew_project(sample_timeline)
    print(f"✓ VREW 생성 완료: {vrew_url}")
    
    # 생성된 VREW 파일 분석
    import zipfile
    import json
    
    vrew_filename = vrew_url.split('/')[-1]
    vrew_path = os.path.join(vrew_service_new.output_dir, vrew_filename)
    
    if os.path.exists(vrew_path):
        with zipfile.ZipFile(vrew_path, 'r') as zf:
            data = json.loads(zf.read('project.json').decode('utf-8'))
            
            # 파일 목록 분석
            files = data.get('files', [])
            print(f"\n생성된 VREW 파일 분석:")
            print(f"  - 총 파일 수: {len(files)}")
            
            video_count = 0
            audio_count = 0
            image_count = 0
            
            for f in files:
                file_type = f.get('type', 'Unknown')
                if file_type == 'AVMedia':
                    meta = f.get('videoAudioMetaInfo', {})
                    if 'videoInfo' in meta:
                        video_count += 1
                        print(f"    비디오: {f.get('name')} ({f.get('fileSize')} bytes)")
                    elif 'audioInfo' in meta:
                        audio_count += 1
                elif file_type == 'Image':
                    image_count += 1
            
            print(f"  - 비디오 파일: {video_count}개")
            print(f"  - 오디오 파일: {audio_count}개")
            print(f"  - 이미지 파일: {image_count}개")
            
            # ZIP 내 실제 미디어 파일 확인
            print(f"\nZIP 내 실제 파일:")
            video_in_zip = 0
            for name in zf.namelist():
                if name.startswith('media/'):
                    if name.lower().endswith(('.mp4', '.mov', '.avi', '.webm', '.m4v')):
                        video_in_zip += 1
                        info = zf.getinfo(name)
                        print(f"    {name}: {info.file_size} bytes")
            
            print(f"  - ZIP 내 비디오 파일: {video_in_zip}개")
            
            # 문제 진단
            expected_videos = 4  # 테스트한 4개 씬
            if video_count < expected_videos:
                print(f"\n⚠️ 경고: 예상 {expected_videos}개 비디오 중 {video_count}개만 포함됨")
                print("  가능한 원인:")
                print("    1. _check_file_exists 실패")
                print("    2. _download_file 실패")
                print("    3. visual_url 선택 로직 문제")
                print("    4. 파일 확장자 인식 문제")
            else:
                print(f"\n✅ 성공: 모든 비디오 파일이 포함됨 ({video_count}/{expected_videos})")
                
    else:
        print(f"✗ VREW 파일을 찾을 수 없음: {vrew_path}")
        
except Exception as e:
    print(f"✗ VREW 생성 실패: {e}")
    import traceback
    traceback.print_exc()

# 3. _download_file 함수 디버깅
print("\n\n3. _download_file 함수 디버깅 테스트")
print("-" * 40)

# 테스트용 임시 파일 경로
import tempfile
temp_dir = tempfile.mkdtemp()
print(f"임시 디렉토리: {temp_dir}")

for i, test in enumerate(test_cases[:3]):  # 처음 3개만 테스트
    if not test["expected_exists"]:
        continue
        
    print(f"\n테스트 {i+1}: {test['name']}")
    print(f"  URL: {test['video_url'][:80]}...")
    
    target_path = os.path.join(temp_dir, f"test_{i}.mp4")
    
    try:
        # _check_file_exists 먼저 확인
        exists = vrew_service_new._check_file_exists(test['video_url'])
        print(f"  _check_file_exists: {exists}")
        
        if exists:
            # _download_file 실행
            print(f"  _download_file 실행...")
            vrew_service_new._download_file(test['video_url'], target_path)
            
            # 결과 확인
            if os.path.exists(target_path):
                file_size = os.path.getsize(target_path)
                print(f"  ✓ 다운로드 성공: {target_path} ({file_size} bytes)")
            else:
                print(f"  ✗ 다운로드 실패: 파일 생성되지 않음")
        else:
            print(f"  ✗ 파일 존재하지 않음 (예상: {test['expected_exists']})")
            
    except Exception as e:
        print(f"  ✗ 오류: {e}")

# 임시 디렉토리 정리
import shutil
try:
    shutil.rmtree(temp_dir)
    print(f"\n임시 디렉토리 정리: {temp_dir}")
except:
    pass

print("\n" + "=" * 60)
print("테스트 완료")
print("=" * 60)