"""
배치 Vrew 생성 테스트 스크립트

사용 예시:
    python test_batch_vrew.py
"""

import os
import json
from services.vrew_batch_service import vrew_batch_service


def create_test_data():
    """테스트용 더미 데이터 생성"""
    print("테스트 데이터 생성 중...")

    # 테스트 폴더 생성
    test_dir = "./output/test_batch"
    audio_dir = f"{test_dir}/audio"
    timestamp_dir = f"{test_dir}/timestamps"
    visual_dir = f"{test_dir}/visuals"

    os.makedirs(audio_dir, exist_ok=True)
    os.makedirs(timestamp_dir, exist_ok=True)
    os.makedirs(visual_dir, exist_ok=True)

    # 더미 타임스탬프 생성 (3개)
    for i in range(1, 4):
        timestamps = [
            {
                "text": f"씬 {i} 첫 번째 문장입니다.",
                "start_ms": 0,
                "end_ms": 2000
            },
            {
                "text": f"씬 {i} 두 번째 문장입니다.",
                "start_ms": 2000,
                "end_ms": 4000
            },
            {
                "text": f"씬 {i} 세 번째 문장입니다.",
                "start_ms": 4000,
                "end_ms": 6000
            }
        ]

        timestamp_file = f"{timestamp_dir}/{i:03d}_timestamps.json"
        with open(timestamp_file, 'w', encoding='utf-8') as f:
            json.dump(timestamps, f, ensure_ascii=False, indent=2)

        print(f"  ✓ {timestamp_file}")

    print(f"""
⚠️ 주의: 실제 오디오 파일과 비주얼 파일을 추가하세요!

다음 위치에 파일을 넣으세요:
1. 오디오 파일:
   {audio_dir}/001_audio.mp3
   {audio_dir}/002_audio.mp3
   {audio_dir}/003_audio.mp3

2. 비주얼 파일 (선택):
   {visual_dir}/001_image.png
   {visual_dir}/002_video.mp4
   {visual_dir}/003_image.jpg

타임스탬프 파일은 이미 생성되었습니다:
   {timestamp_dir}/001_timestamps.json
   {timestamp_dir}/002_timestamps.json
   {timestamp_dir}/003_timestamps.json
""")

    return test_dir


def test_batch_from_folder():
    """폴더 기반 배치 생성 테스트"""
    print("\n" + "="*60)
    print("테스트 1: 폴더 기반 배치 생성")
    print("="*60)

    test_dir = "./output/test_batch"

    # 실제 파일이 있는지 확인
    audio_dir = f"{test_dir}/audio"
    if not os.path.exists(audio_dir) or len(os.listdir(audio_dir)) == 0:
        print("⚠️ 오디오 파일이 없습니다. create_test_data()를 먼저 실행하세요.")
        return

    try:
        vrew_url = vrew_batch_service.create_from_folder(
            audio_folder=f"{test_dir}/audio",
            timestamp_folder=f"{test_dir}/timestamps",
            visual_folder=f"{test_dir}/visuals",
            output_filename="test_batch.vrew"
        )

        print(f"\n✅ 성공! Vrew 파일: {vrew_url}")

    except Exception as e:
        print(f"\n❌ 실패: {e}")
        import traceback
        traceback.print_exc()


def test_batch_from_lists():
    """파일 리스트 기반 배치 생성 테스트"""
    print("\n" + "="*60)
    print("테스트 2: 파일 리스트 기반 배치 생성")
    print("="*60)

    test_dir = "./output/test_batch"

    # 파일 리스트 생성
    audio_files = [
        f"{test_dir}/audio/001_audio.mp3",
        f"{test_dir}/audio/002_audio.mp3",
        f"{test_dir}/audio/003_audio.mp3"
    ]

    timestamp_files = [
        f"{test_dir}/timestamps/001_timestamps.json",
        f"{test_dir}/timestamps/002_timestamps.json",
        f"{test_dir}/timestamps/003_timestamps.json"
    ]

    visual_files = [
        f"{test_dir}/visuals/001_image.png",
        f"{test_dir}/visuals/002_video.mp4",
        f"{test_dir}/visuals/003_image.jpg"
    ]

    # 오디오 파일 확인
    existing_audio = [f for f in audio_files if os.path.exists(f)]
    if not existing_audio:
        print("⚠️ 오디오 파일이 없습니다.")
        return

    try:
        vrew_url = vrew_batch_service.create_from_file_lists(
            audio_files=audio_files,
            timestamp_files=timestamp_files,
            visual_files=visual_files,
            output_filename="test_batch_list.vrew"
        )

        print(f"\n✅ 성공! Vrew 파일: {vrew_url}")

    except Exception as e:
        print(f"\n❌ 실패: {e}")
        import traceback
        traceback.print_exc()


def main():
    """메인 테스트 함수"""
    print("\n" + "="*60)
    print("배치 Vrew 생성 테스트")
    print("="*60)

    # 1. 테스트 데이터 생성
    test_dir = create_test_data()

    # 2. 사용자에게 파일 준비 안내
    print("\n다음 단계:")
    print("1. 위 경로에 오디오 파일을 추가하세요")
    print("2. (선택) 비주얼 파일도 추가하세요")
    print("3. 이 스크립트를 다시 실행하세요")

    # 오디오 파일이 있으면 테스트 실행
    audio_dir = f"{test_dir}/audio"
    if os.path.exists(audio_dir) and len(os.listdir(audio_dir)) > 0:
        print("\n오디오 파일 발견! 테스트를 시작합니다...")

        # 테스트 1: 폴더 기반
        test_batch_from_folder()

        # 테스트 2: 리스트 기반
        # test_batch_from_lists()

    else:
        print("\n⚠️ 오디오 파일을 먼저 추가하세요!")


if __name__ == "__main__":
    main()
