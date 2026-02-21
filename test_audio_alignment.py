
import os
import json
from dotenv import load_dotenv
load_dotenv()

from services.audio_segmentation_service import audio_segmentation_service
from services.tts_base import WordTimestamp

def test_alignment_logic():
    print("--- Testing Audio Alignment Logic (Logic 3.1 Refinement) ---")
    
    # 1. Mock Data: AI-Segmented Script (with \n\n)
    original_script = "안녕하세요. 반가워요.\n\n오늘 날씨가 참 좋네요.\n\n부동산 투자는 시점이 중요합니다."
    
    # 2. Mock Data: Whisper Word Timestamps (flat list)
    # Note: Whisper might transcribe slightly differently or merge words
    word_timestamps = [
        WordTimestamp(text="안녕하세요", start_ms=0, end_ms=500),
        WordTimestamp(text="반가워요", start_ms=600, end_ms=1100),
        WordTimestamp(text="오늘", start_ms=1500, end_ms=1800),
        WordTimestamp(text="날씨가", start_ms=1900, end_ms=2200),
        WordTimestamp(text="참", start_ms=2300, end_ms=2500),
        WordTimestamp(text="좋네요", start_ms=2600, end_ms=3000),
        WordTimestamp(text="부동산", start_ms=3500, end_ms=3900),
        WordTimestamp(text="투자는", start_ms=4000, end_ms=4400),
        WordTimestamp(text="시점이", start_ms=4500, end_ms=4900),
        WordTimestamp(text="중요합니다", start_ms=5000, end_ms=5500),
    ]
    
    print(f"Input Script Paragraphs: {len(original_script.split('\\n\\n'))}")
    print(f"Input Whisper Words: {len(word_timestamps)}")
    
    # 3. Run Alignment
    groups = audio_segmentation_service.align_script_with_audio(original_script, word_timestamps, max_chars=50)
    
    # 4. Verify
    print("\nAlignment Results:")
    print("-" * 50)
    for i, g in enumerate(groups, 1):
        print(f"Scene #{i}:")
        print(f"  Text: {g['text']}")
        print(f"  Time: {g['start_time']:.2f}s ~ {g['end_time']:.2f}s")
        print(f"  Words: {[w.text for w in g['timestamps']]}")
        print("-" * 50)
    
    assert len(groups) == 3, f"Expected 3 groups, but got {len(groups)}"
    assert "안녕하세요" in groups[0]['text']
    assert "날씨가" in groups[1]['text']
    assert "부동산" in groups[2]['text']
    
    # Check if boundaries are correct
    assert groups[0]['end_time'] == 1.1
    assert groups[1]['start_time'] == 1.5
    assert groups[1]['end_time'] == 3.0
    assert groups[2]['start_time'] == 3.5
    
    print("\n[SUCCESS] Alignment logic verified correctly with paragraph preservation!")

if __name__ == "__main__":
    test_alignment_logic()
