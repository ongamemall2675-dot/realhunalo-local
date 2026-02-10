"""
Azure TTS 속도 테스트
"""
import sys
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / ".env")

from services.tts_azure import azure_tts_engine

def test_speed(speed_value, description):
    """특정 속도로 TTS 생성 테스트"""
    print(f"\n{'='*60}")
    print(f"테스트: {description}")
    print(f"Speed 값: {speed_value}")
    print(f"{'='*60}")

    result = azure_tts_engine.synthesize_speech(
        text="이것은 속도 테스트입니다. 정상 속도로 들리나요?",
        voice_id="ko-KR-SunHiNeural",
        language="ko-KR",
        speed=speed_value
    )

    if result.success:
        print(f"[OK] 성공! 오디오 길이: {result.total_duration_ms}ms")
        print(f"생성된 파일: {result.audio_path}")
    else:
        print(f"[X] 실패: {result.error}")

    return result.success

def main():
    print("\n" + "="*60)
    print("Azure TTS 속도 테스트")
    print("="*60)

    if not azure_tts_engine:
        print("[X] Azure TTS 엔진을 사용할 수 없습니다.")
        return

    # 여러 속도 값 테스트
    test_cases = [
        (0.8, "느린 속도 (0.8)"),
        (1.0, "정상 속도 (1.0)"),
        (1.2, "빠른 속도 (1.2)")
    ]

    for speed_val, desc in test_cases:
        test_speed(speed_val, desc)
        print("\n오디오를 재생해서 속도를 확인하세요.")
        input("다음 테스트를 진행하려면 Enter를 누르세요...")

if __name__ == "__main__":
    main()
