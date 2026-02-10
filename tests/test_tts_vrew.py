"""
TTS + Vrew 통합 테스트
대본 → TTS → Vrew 전체 워크플로우 검증
"""
import os
import sys
import json
import unittest
from unittest.mock import Mock, patch, MagicMock

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.tts_base import WordTimestamp, TTSResult
from services.vrew_formatter import VrewFormatter, VrewClip, VrewMediaFile, VrewProjectBuilder
from services.vrew_service import parse_srt_to_timestamps, VrewService


class TestWordTimestamp(unittest.TestCase):
    """WordTimestamp 데이터 클래스 테스트"""

    def test_timestamp_creation(self):
        ts = WordTimestamp(text="안녕", start_ms=0, end_ms=500)
        self.assertEqual(ts.text, "안녕")
        self.assertEqual(ts.start_ms, 0)
        self.assertEqual(ts.end_ms, 500)

    def test_timestamp_seconds_conversion(self):
        ts = WordTimestamp(text="테스트", start_ms=1500, end_ms=3000)
        self.assertEqual(ts.start_seconds, 1.5)
        self.assertEqual(ts.end_seconds, 3.0)
        self.assertEqual(ts.duration_seconds, 1.5)


class TestSRTParser(unittest.TestCase):
    """SRT 파서 테스트"""

    def test_parse_simple_srt(self):
        srt = """1
00:00:00,000 --> 00:00:02,500
안녕하세요

2
00:00:02,500 --> 00:00:05,000
반갑습니다"""

        timestamps = parse_srt_to_timestamps(srt)

        self.assertEqual(len(timestamps), 2)
        self.assertEqual(timestamps[0].text, "안녕하세요")
        self.assertEqual(timestamps[0].start_ms, 0)
        self.assertEqual(timestamps[0].end_ms, 2500)
        self.assertEqual(timestamps[1].text, "반갑습니다")
        self.assertEqual(timestamps[1].start_ms, 2500)
        self.assertEqual(timestamps[1].end_ms, 5000)

    def test_parse_empty_srt(self):
        timestamps = parse_srt_to_timestamps("")
        self.assertEqual(len(timestamps), 0)

    def test_parse_none_srt(self):
        timestamps = parse_srt_to_timestamps(None)
        self.assertEqual(len(timestamps), 0)

    def test_parse_multiline_text(self):
        srt = """1
00:00:00,000 --> 00:00:03,000
첫 번째 줄
두 번째 줄"""

        timestamps = parse_srt_to_timestamps(srt)
        self.assertEqual(len(timestamps), 1)
        self.assertEqual(timestamps[0].text, "첫 번째 줄 두 번째 줄")


class TestVrewClip(unittest.TestCase):
    """VrewClip 테스트"""

    def test_clip_to_dict(self):
        clip = VrewClip(
            id="abc123",
            text="테스트 클립",
            start_time=0.0,
            duration=2.5,
            media_id="media-001",
            visual_ids=["visual-001"]
        )

        data = clip.to_dict()

        self.assertEqual(data["id"], "abc123")
        self.assertEqual(data["text"], "테스트 클립")
        self.assertEqual(data["startTime"], 0.0)
        self.assertEqual(data["duration"], 2.5)
        self.assertEqual(data["mediaId"], "media-001")
        self.assertEqual(data["assetIds"], ["visual-001"])
        self.assertTrue(data["aligned"])


class TestVrewFormatter(unittest.TestCase):
    """VrewFormatter 테스트"""

    def setUp(self):
        self.formatter = VrewFormatter()

    def test_timestamps_to_clips_word_level(self):
        timestamps = [
            WordTimestamp(text="안녕", start_ms=0, end_ms=500),
            WordTimestamp(text="하세요", start_ms=500, end_ms=1000),
        ]

        clips = self.formatter.timestamps_to_clips(
            timestamps=timestamps,
            audio_media_id="audio-001",
            visual_ids=["visual-001"]
        )

        self.assertEqual(len(clips), 2)
        self.assertEqual(clips[0].text, "안녕")
        self.assertEqual(clips[0].start_time, 0.0)
        self.assertEqual(clips[0].duration, 0.5)
        self.assertEqual(clips[1].text, "하세요")
        self.assertEqual(clips[1].start_time, 0.5)

    def test_timestamps_to_clips_sentence_grouping(self):
        timestamps = [
            WordTimestamp(text="첫", start_ms=0, end_ms=200),
            WordTimestamp(text="번째", start_ms=200, end_ms=400),
            WordTimestamp(text="문장.", start_ms=400, end_ms=1000),
            WordTimestamp(text="두", start_ms=1000, end_ms=1200),
            WordTimestamp(text="번째", start_ms=1200, end_ms=1400),
            WordTimestamp(text="문장.", start_ms=1400, end_ms=2000),
        ]

        clips = self.formatter.timestamps_to_clips(
            timestamps=timestamps,
            audio_media_id="audio-001",
            group_by_sentence=True
        )

        self.assertEqual(len(clips), 2)
        self.assertIn("첫 번째 문장.", clips[0].text)
        self.assertIn("두 번째 문장.", clips[1].text)

    def test_build_project_json(self):
        clips = [
            VrewClip(
                id="clip-001",
                text="테스트",
                start_time=0.0,
                duration=2.0,
                media_id="audio-001",
                visual_ids=[]
            )
        ]

        media_files = [
            VrewMediaFile(
                media_id="audio-001",
                name="audio.mp3",
                file_type="AVMedia",
                file_size=1024,
                local_path="/tmp/audio.mp3"
            )
        ]

        project = self.formatter.build_project_json(
            clips=clips,
            media_files=media_files,
            resolution=(1920, 1080)
        )

        self.assertEqual(project["version"], 15)
        self.assertEqual(len(project["files"]), 1)
        self.assertEqual(len(project["transcript"]["clips"]), 1)
        self.assertEqual(project["props"]["resolution"]["width"], 1920)
        self.assertEqual(project["props"]["duration"], 2.0)


class TestTTSResult(unittest.TestCase):
    """TTSResult 테스트"""

    def test_result_to_dict(self):
        timestamps = [
            WordTimestamp(text="테스트", start_ms=0, end_ms=1000)
        ]

        result = TTSResult(
            success=True,
            audio_url="data:audio/mpeg;base64,ABC",
            audio_base64="ABC",
            timestamps=timestamps,
            total_duration_ms=1000,
            srt="1\n00:00:00,000 --> 00:00:01,000\n테스트",
            engine="elevenlabs"
        )

        data = result.to_dict()

        self.assertTrue(data["success"])
        self.assertEqual(data["engine"], "elevenlabs")
        self.assertEqual(data["duration"], 1.0)
        self.assertIsNotNone(data["alignment"])
        self.assertEqual(len(data["alignment"]["words"]), 1)

    def test_failed_result(self):
        result = TTSResult(
            success=False,
            audio_url="",
            engine="azure",
            error="API 키 오류"
        )

        data = result.to_dict()

        self.assertFalse(data["success"])
        self.assertEqual(data["error"], "API 키 오류")


class TestIntegration(unittest.TestCase):
    """통합 테스트 (Mock 사용)"""

    def test_full_workflow_mock(self):
        """대본 → TTS → Vrew 전체 워크플로우 (Mock)"""

        # 1. TTS 결과 시뮬레이션
        mock_tts_result = {
            "success": True,
            "audioUrl": "data:audio/mpeg;base64,MOCK_AUDIO",
            "audioBase64": "MOCK_AUDIO",
            "alignment": {
                "timeline": [
                    {"text": "안녕하세요", "start": 0.0, "end": 1.5},
                    {"text": "반갑습니다", "start": 1.5, "end": 3.0}
                ]
            },
            "srtData": "1\n00:00:00,000 --> 00:00:01,500\n안녕하세요\n\n2\n00:00:01,500 --> 00:00:03,000\n반갑습니다",
            "duration": 3.0,
            "engine": "elevenlabs"
        }

        # 2. 타임스탬프 추출
        timeline = mock_tts_result["alignment"]["timeline"]
        timestamps = [
            WordTimestamp(
                text=item["text"],
                start_ms=int(item["start"] * 1000),
                end_ms=int(item["end"] * 1000)
            )
            for item in timeline
        ]

        self.assertEqual(len(timestamps), 2)
        self.assertEqual(timestamps[0].text, "안녕하세요")

        # 3. Vrew 클립 변환
        formatter = VrewFormatter()
        clips = formatter.timestamps_to_clips(
            timestamps=timestamps,
            audio_media_id="mock-audio-id",
            visual_ids=["mock-visual-id"]
        )

        self.assertEqual(len(clips), 2)
        self.assertEqual(clips[0].start_time, 0.0)
        self.assertEqual(clips[0].duration, 1.5)

        # 4. project.json 생성
        media_files = [
            VrewMediaFile(
                media_id="mock-audio-id",
                name="audio.mp3",
                file_type="AVMedia",
                file_size=1024,
                local_path="/tmp/mock.mp3"
            )
        ]

        project = formatter.build_project_json(
            clips=clips,
            media_files=media_files
        )

        self.assertEqual(project["version"], 15)
        self.assertEqual(len(project["transcript"]["clips"]), 2)
        self.assertEqual(project["props"]["duration"], 3.0)

        print("✅ 통합 테스트 통과: 대본 → TTS → Vrew 워크플로우")


class TestVrewService(unittest.TestCase):
    """VrewService 테스트"""

    def setUp(self):
        self.service = VrewService()

    def test_parse_timeline_data(self):
        """타임라인 데이터 파싱 테스트"""
        timeline_data = {
            "mergedGroups": [],
            "standalone": [
                {
                    "audioUrl": "http://localhost:8000/output/test.mp3",
                    "visualUrl": None,
                    "duration": 3.0,
                    "script": "테스트 스크립트",
                    "srtData": "1\n00:00:00,000 --> 00:00:03,000\n테스트 스크립트"
                }
            ]
        }

        # SRT 파싱 확인
        srt = timeline_data["standalone"][0]["srtData"]
        timestamps = parse_srt_to_timestamps(srt)

        self.assertEqual(len(timestamps), 1)
        self.assertEqual(timestamps[0].text, "테스트 스크립트")
        self.assertEqual(timestamps[0].duration_seconds, 3.0)


if __name__ == "__main__":
    print("=" * 60)
    print("TTS + Vrew 통합 테스트")
    print("=" * 60)

    unittest.main(verbosity=2)
