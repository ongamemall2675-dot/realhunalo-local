"""
Azure TTS 음성 선택 테스트 스크립트
"""
import os
import sys
from pathlib import Path

# 프로젝트 루트 디렉토리를 Python 경로에 추가
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# 환경변수 로드
from dotenv import load_dotenv
env_path = project_root / ".env"
load_dotenv(env_path)

# TTS 서비스 임포트
from services.tts_azure import azure_tts_engine

def test_voice(voice_id, test_text):
    """특정 음성으로 TTS 생성 테스트"""
    print(f"\n{'='*60}")
    print(f"테스트: {voice_id}")
    print(f"텍스트: {test_text}")
    print(f"{'='*60}")

    result = azure_tts_engine.synthesize_speech(
        text=test_text,
        voice_id=voice_id,
        language="ko-KR",
        speed=1.0
    )

    if result.success:
        print(f"[OK] 성공!")
        print(f"  - 오디오 길이: {result.total_duration_ms}ms")
        print(f"  - 단어 개수: {len(result.timestamps)}")
        if len(result.timestamps) > 0:
            print(f"  - 첫 3단어: {[w.text for w in result.timestamps[:3]]}")
    else:
        print(f"[X] 실패: {result.error}")

    return result.success

def main():
    print("\n" + "="*60)
    print("Azure TTS 음성 선택 테스트")
    print("="*60)

    # Azure 엔진 초기화 확인
    if not azure_tts_engine:
        print("[X] Azure TTS 엔진을 사용할 수 없습니다.")
        print("   Azure API 키와 Region을 환경변수에 설정하세요.")
        return

    print(f"[OK] Azure TTS 엔진 초기화됨")
    print(f"   Region: {azure_tts_engine.region}")

    # 테스트할 음성 목록 (3개만 테스트)
    test_voices = [
        ("ko-KR-JiMinNeural", "안녕하세요. 저는 지민입니다."),
        ("ko-KR-BongJinNeural", "안녕하세요. 저는 봉진입니다."),
        ("ko-KR-SunHiNeural", "안녕하세요. 저는 선희입니다.")
    ]

    results = []
    for voice_id, text in test_voices:
        success = test_voice(voice_id, text)
        results.append((voice_id, success))

    # 결과 요약
    print(f"\n{'='*60}")
    print("테스트 결과 요약")
    print(f"{'='*60}")
    for voice_id, success in results:
        status = "[OK]" if success else "[X]"
        print(f"{status} {voice_id}")

    # 모든 테스트 통과 확인
    all_passed = all(success for _, success in results)
    if all_passed:
        print(f"\n[OK] 모든 테스트 통과! Azure 음성 선택이 정상 작동합니다.")
    else:
        print(f"\n[X] 일부 테스트 실패. 로그를 확인하세요.")

if __name__ == "__main__":
    main()
