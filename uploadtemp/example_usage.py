"""
Vrew 파일 생성 예시

다양한 사용 시나리오를 보여주는 예제 코드
"""

from vrew_builder import VrewBuilder


def example1_simple_video():
    """예제 1: 간단한 비디오 + 자막"""
    print("예제 1: 간단한 비디오 + 자막")

    builder = VrewBuilder(width=1920, height=1080)

    # 비디오 추가
    video_id = builder.add_video(
        video_path="video.mp4",
        duration=10.0,
        include_in_archive=True  # .vrew 파일 안에 포함
    )

    # 자막 추가
    builder.add_clip("안녕하세요", start_time=0, duration=2.0)
    builder.add_clip("오늘은 좋은 날입니다", start_time=2.0, duration=3.0)
    builder.add_clip("감사합니다", start_time=5.0, duration=2.0)

    builder.save("example1_simple.vrew")


def example2_audio_with_subtitles():
    """예제 2: 오디오 파일 + 자막"""
    print("예제 2: 오디오 파일 + 자막")

    builder = VrewBuilder(width=1920, height=1080)

    # 오디오 추가
    audio_id = builder.add_audio(
        audio_path="audio.mp3",
        duration=30.0,
        include_in_archive=True
    )

    # 타임스탬프와 함께 자막 추가
    subtitles = [
        ("안녕하세요", 0.0, 2.0),
        ("오늘 주제는", 2.5, 2.0),
        ("양도세 중과유예입니다", 5.0, 3.0),
        ("자세히 알아보겠습니다", 8.5, 2.5),
    ]

    for text, start, duration in subtitles:
        builder.add_clip(text, start, duration, media_id=audio_id)

    builder.save("example2_audio.vrew")


def example3_with_images():
    """예제 3: 이미지 슬라이드쇼"""
    print("예제 3: 이미지 슬라이드쇼")

    builder = VrewBuilder(width=1920, height=1080)

    # 여러 이미지 추가
    images = [
        "image1.png",
        "image2.png",
        "image3.png"
    ]

    for img in images:
        builder.add_image(img, include_in_archive=True)

    # 오디오 설명 추가
    audio_id = builder.add_audio("narration.mp3", duration=15.0)

    builder.add_clip("첫 번째 슬라이드", start_time=0, duration=3.0)
    builder.add_clip("두 번째 슬라이드", start_time=3.0, duration=3.0)
    builder.add_clip("세 번째 슬라이드", start_time=6.0, duration=3.0)

    builder.save("example3_images.vrew")


def example4_with_silence():
    """예제 4: 무음 구간 포함"""
    print("예제 4: 무음 구간 포함")

    builder = VrewBuilder(width=1920, height=1080)

    video_id = builder.add_video("video.mp4", duration=20.0)

    # 자막 - 무음 - 자막 패턴
    builder.add_clip("인트로", start_time=0, duration=2.0)
    builder.add_silence(start_time=2.0, duration=1.0)  # 1초 무음
    builder.add_clip("본론", start_time=3.0, duration=3.0)
    builder.add_silence(start_time=6.0, duration=1.0)
    builder.add_clip("결론", start_time=7.0, duration=2.0)

    builder.save("example4_silence.vrew")


def example5_external_reference():
    """예제 5: 외부 파일 참조 (파일 미포함)"""
    print("예제 5: 외부 파일 참조")

    builder = VrewBuilder(width=1920, height=1080)

    # include_in_archive=False로 설정하면 LOCAL 참조
    # (실제 파일은 .vrew에 포함되지 않음)
    video_id = builder.add_video(
        video_path="C:/Users/ongam/Downloads/video.mp4",
        duration=60.0,
        include_in_archive=False  # ⚠️ 외부 참조만!
    )

    builder.add_clip("테스트", start_time=0, duration=2.0)

    builder.save("example5_external.vrew")
    print("⚠️ 주의: 이 파일은 외부 경로를 참조하므로")
    print("   해당 경로에 파일이 없으면 Vrew에서 열리지 않습니다!")


def example6_youtube_shorts():
    """예제 6: 유튜브 쇼츠 (세로 비디오)"""
    print("예제 6: 유튜브 쇼츠")

    # 9:16 비율 (세로)
    builder = VrewBuilder(width=1080, height=1920)

    video_id = builder.add_video("shorts_video.mp4", duration=30.0)

    # 짧고 임팩트 있는 자막들
    clips = [
        ("충격!", 0, 1),
        ("이것 보셨나요?", 1.5, 2),
        ("놀라운 사실", 4, 2),
        ("구독 좋아요", 27, 3)
    ]

    for text, start, duration in clips:
        builder.add_clip(text, start, duration)

    builder.save("example6_shorts.vrew")


def example7_programmatic_subtitles():
    """예제 7: 프로그래밍 방식으로 자막 생성"""
    print("예제 7: 프로그래밍 방식 자막 생성")

    builder = VrewBuilder()
    video_id = builder.add_video("lecture.mp4", duration=120.0)

    # STT 결과나 대본에서 자동 생성
    transcript = [
        {"text": "안녕하세요", "start": 0.0, "end": 1.5},
        {"text": "오늘의 강의를", "start": 1.5, "end": 3.0},
        {"text": "시작하겠습니다", "start": 3.0, "end": 5.0},
        # ... 더 많은 자막
    ]

    for item in transcript:
        duration = item["end"] - item["start"]
        builder.add_clip(
            text=item["text"],
            start_time=item["start"],
            duration=duration
        )

    builder.save("example7_programmatic.vrew")


def example8_get_json_only():
    """예제 8: JSON만 출력 (파일 저장 안 함)"""
    print("예제 8: JSON만 출력")

    import json

    builder = VrewBuilder()
    builder.add_video("test.mp4", duration=10.0, include_in_archive=False)
    builder.add_clip("테스트", start_time=0, duration=2.0)

    # build()로 딕셔너리만 얻기
    project_dict = builder.build()

    # 예쁘게 출력
    print(json.dumps(project_dict, ensure_ascii=False, indent=2))


# ==================== 실행 ====================

if __name__ == "__main__":
    print("=" * 50)
    print("Vrew 파일 생성 예제")
    print("=" * 50)
    print()

    # 원하는 예제의 주석을 해제하고 실행하세요

    # example1_simple_video()
    # example2_audio_with_subtitles()
    # example3_with_images()
    # example4_with_silence()
    # example5_external_reference()
    # example6_youtube_shorts()
    # example7_programmatic_subtitles()
    example8_get_json_only()

    print()
    print("=" * 50)
    print("완료!")
    print("=" * 50)
