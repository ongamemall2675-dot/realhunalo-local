"""
Audio Segmentation Service 테스트
"""

import os
import sys

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.audio_segmentation_service import audio_segmentation_service


def test_audio_segmentation():
    """
    오디오 세분화 테스트
    
    주의: 이 테스트를 실행하려면:
    1. uploadtemp 폴더에 테스트용 MP3 파일 준비 (30초~1분 추천)
    2. OPENAI_API_KEY 환경 변수 설정
    3. ffmpeg 설치 (pydub 의존성)
    """
    
    print("\n" + "="*60)
    print("오디오 세분화 서비스 테스트")
    print("="*60)
    
    # 테스트 파일 경로 (사용자가 준비한 파일로 변경)
    test_audio_path = "uploadtemp/test_audio.mp3"
    
    if not os.path.exists(test_audio_path):
        print(f"\n⚠️ 테스트 파일을 찾을 수 없습니다: {test_audio_path}")
        print(f"uploadtemp 폴더에 test_audio.mp3 파일을 준비해주세요.")
        return
    
    try:
        # 1. 오디오 세분화
        print(f"\n[TEST] 오디오 파일: {test_audio_path}")
        session_folder, segmented_scenes, master_character_prompt = audio_segmentation_service.segment_audio(
            audio_path=test_audio_path,
            max_chars=30
        )
        
        # 2. 결과 검증
        print(f"\n[TEST] 세분화 결과 검증")
        print(f"  - 세션 폴더: {session_folder}")
        print(f"  - 총 세그먼트 수: {len(segmented_scenes)}")
        print(f"  - 마스터 캐릭터 프롬프트 [{len(master_character_prompt) if master_character_prompt else 0}명]:")
        if master_character_prompt and isinstance(master_character_prompt, list):
            for char in master_character_prompt:
                print(f"    - {char.get('type', '알수없음')}({char.get('name', '이름없음')}): {char.get('description', '')[:50]}...")
        else:
            print(f"    없음 또는 올바르지 않은 형식")
        
        # 각 세그먼트 검증
        for scene in segmented_scenes:
            text_len = len(scene.text)
            duration = scene.end_time - scene.start_time
            
            print(f"\n  씬 #{scene.index:03d}:")
            print(f"    - 텍스트: {scene.text}")
            print(f"    - 길이: {text_len}자 (최대 30자)")
            print(f"    - 시간: {scene.start_time:.2f}s ~ {scene.end_time:.2f}s ({duration:.2f}s)")
            print(f"    - 오디오: {os.path.exists(scene.audio_path)} (파일 존재)")
            print(f"    - 타임스탬프: {os.path.exists(scene.timestamp_path)} (파일 존재)")
            
            # 검증
            assert text_len <= 30, f"씬 {scene.index}: 텍스트 길이가 30자를 초과했습니다 ({text_len}자)"
            assert os.path.exists(scene.audio_path), f"씬 {scene.index}: 오디오 파일이 생성되지 않았습니다"
            assert os.path.exists(scene.timestamp_path), f"씬 {scene.index}: 타임스탬프 파일이 생성되지 않았습니다"
        
        # manifest.json 확인
        manifest_path = os.path.join(session_folder, "manifest.json")
        assert os.path.exists(manifest_path), "manifest.json이 생성되지 않았습니다"
        
        with open(manifest_path, 'r', encoding='utf-8') as f:
            import json
            manifest = json.load(f)
            assert "masterCharacterPrompt" in manifest, "manifest.json에 masterCharacterPrompt가 없습니다"
            print(f"\n✅ manifest.json 캐릭터 프롬프트 확인 통과!")
        
        print(f"\n✅ 모든 검증 통과!")
        print(f"생성된 파일 위치: {session_folder}")
        
    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")
        import traceback
        traceback.print_exc()


def test_image_prompt_generation():
    """
    배치 이미지 프롬프트 생성 테스트
    """
    from services.script_service import script_service
    
    print("\n" + "="*60)
    print("배치 이미지 프롬프트 생성 테스트")
    print("="*60)
    
    # 샘플 전사 데이터
    transcripts = [
        {"index": 1, "text": "안녕하세요 여러분, 오늘은 부동산 투자에 대해 알아보겠습니다"},
        {"index": 2, "text": "첫 번째로 위치 선정이 가장 중요합니다"},
        {"index": 3, "text": "두 번째로 시장 동향을 파악해야 합니다"}
    ]
    
    try:
        result = script_service.generate_image_prompts_from_transcripts(
            transcripts=transcripts,
            image_style="watercolor"
        )
        
        if result.get("success"):
            prompts = result.get("prompts", [])
            print(f"\n✅ {len(prompts)}개 프롬프트 생성 완료")
            
            for p in prompts:
                print(f"\n씬 {p['sceneId']}:")
                print(f"  {p['imagePrompt'][:100]}...")
        else:
            print(f"\n❌ 프롬프트 생성 실패: {result.get('error')}")
    
    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("\n🎯 Audio Segmentation Service 테스트 시작\n")
    
    # 1. 오디오 세분화 테스트
    test_audio_segmentation()
    
    # 2. 이미지 프롬프트 생성 테스트
    test_image_prompt_generation()
    
    print("\n✅ 모든 테스트 완료!")
