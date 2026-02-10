"""
Simple TTS Service Test
간단한 TTS 서비스 테스트 스크립트
"""
import os
from dotenv import load_dotenv
load_dotenv()

print("=" * 60)
print("TTS Service Test")
print("=" * 60)

# 1. 환경변수 확인
print("\n1. 환경변수 체크:")
print(f"   AZURE_SPEECH_KEY: {'[O] OK' if os.getenv('AZURE_SPEECH_KEY') else '[X] None'}")
print(f"   AZURE_SPEECH_REGION: {os.getenv('AZURE_SPEECH_REGION', '[X] None')}")
print(f"   ELEVENLABS_API_KEY: {'[O] OK' if os.getenv('ELEVENLABS_API_KEY') else '[X] None'}")

# 2. TTS 서비스 임포트
print("\n2. TTS 서비스 임포트:")
try:
    from services.tts_service import tts_service
    if tts_service is None:
        print("   [X] TTS 서비스가 None입니다. API 키를 확인하세요.")
        exit(1)
    print(f"   [OK] TTS 서비스 로드 성공")
    print(f"   Primary Engine: {tts_service.primary_engine}")
    print(f"   Available Engines: {tts_service.get_available_engines()}")
except Exception as e:
    print(f"   [X] TTS 서비스 임포트 실패: {e}")
    exit(1)

# 3. 간단한 TTS 생성 테스트
print("\n3. TTS 생성 테스트:")
try:
    result = tts_service.generate(
        text="안녕하세요. 테스트입니다.",
        scene_id="test_scene",
        language="ko-KR",
        speed=1.0
    )

    if result.get("success"):
        print(f"   [OK] TTS 생성 성공!")
        print(f"   사용된 엔진: {result.get('usedEngine')}")
        print(f"   처리 시간: {result.get('processingTimeSeconds')}초")
        print(f"   오디오 URL: {result.get('audioUrl', 'N/A')[:80]}...")
        print(f"   SRT 데이터: {'있음' if result.get('srtData') else '없음'}")
    else:
        print(f"   [X] TTS 생성 실패")
        print(f"   에러: {result.get('error')}")
except Exception as e:
    print(f"   [X] TTS 생성 중 예외 발생: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("테스트 완료")
print("=" * 60)
