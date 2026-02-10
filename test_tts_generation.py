"""
TTS 생성 기능 테스트
"""
from dotenv import load_dotenv
load_dotenv()

from services.tts_service import tts_service

def test_tts_generation():
    """TTS 생성 테스트"""
    print("="*60)
    print("TTS 생성 테스트 시작")
    print("="*60)

    # 테스트 텍스트
    test_text = "인공지능이 바꾸는 미래의 세상에 대해 이야기해볼까요?"

    print(f"\n[TTS 텍스트]")
    print(test_text)
    print(f"글자수: {len(test_text)}")

    # TTS 서비스 상태 확인
    if tts_service is None:
        print("\n[오류] TTS 서비스를 사용할 수 없습니다.")
        return

    status = tts_service.get_status()
    print(f"\n[TTS 서비스 상태]")
    print(f"Primary Engine: {status.get('primaryEngine')}")
    print(f"Available Engines: {status.get('availableEngines')}")

    # TTS 생성 실행
    print("\n[TTS 생성 중...]")
    result = tts_service.generate(
        text=test_text,
        voice_id=None,  # 기본 음성 사용
        language="ko-KR",
        speed=1.0,
        scene_id="test_1",
        engine="azure",  # Azure 엔진 사용
        enable_fallback=True
    )

    # 결과 확인
    print("\n" + "="*60)
    print("결과:")
    print("="*60)

    if result.get("success"):
        print(f"[성공!]")
        print(f"\n오디오 URL: {result.get('audioUrl', 'N/A')}")
        print(f"사용된 엔진: {result.get('usedEngine', 'N/A')}")
        print(f"처리 시간: {result.get('processingTimeSeconds', 'N/A')}초")
        print(f"총 길이: {result.get('totalDurationMs', 'N/A')}ms")

        if result.get('fallbackUsed'):
            print(f"Fallback 사용: {result.get('originalEngine')} -> {result.get('usedEngine')}")

        # SRT 데이터 확인
        if result.get('srtData'):
            srt_lines = result['srtData'].split('\n')
            print(f"\nSRT 데이터 (처음 10줄):")
            for line in srt_lines[:10]:
                if line.strip():
                    print(f"  {line}")
    else:
        print(f"[실패]: {result.get('error')}")
        if 'triedEngines' in result:
            print(f"시도한 엔진들: {result.get('triedEngines')}")

if __name__ == "__main__":
    test_tts_generation()
