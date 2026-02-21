"""
Debug Gemini API response structure
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

print("=" * 60)
print("Debugging Gemini TTS Response Structure")
print("=" * 60)
print()

client = genai.Client(api_key=api_key)

text = "테스트 음성입니다."
voice_name = "Aoede"

print(f"Requesting TTS:")
print(f"  Text: {text}")
print(f"  Voice: {voice_name}")
print()

response = client.models.generate_content(
    model="models/gemini-2.5-pro-preview-tts",
    contents=text,
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=voice_name
                )
            )
        )
    )
)

print("Response received!")
print()
print("=" * 60)
print("Response Structure Analysis:")
print("=" * 60)
print()

print(f"Response type: {type(response)}")
print(f"Response class: {response.__class__.__name__}")
print()

print("Response attributes:")
attrs = [a for a in dir(response) if not a.startswith('_')]
for attr in attrs:
    print(f"  - {attr}")
print()

# Check for audio_bytes
if hasattr(response, 'audio_bytes'):
    print(f"✓ response.audio_bytes exists")
    if response.audio_bytes:
        print(f"  Type: {type(response.audio_bytes)}")
        print(f"  Length: {len(response.audio_bytes)} bytes")
        print(f"  First 32 bytes: {response.audio_bytes[:32].hex()}")
    else:
        print(f"  Value: None or empty")
else:
    print(f"✗ response.audio_bytes does NOT exist")
print()

# Check for parts
if hasattr(response, 'parts'):
    print(f"✓ response.parts exists")
    if response.parts:
        print(f"  Number of parts: {len(response.parts)}")
        for i, part in enumerate(response.parts):
            print(f"\n  Part {i}:")
            print(f"    Type: {type(part)}")
            print(f"    Attributes: {[a for a in dir(part) if not a.startswith('_')]}")

            if hasattr(part, 'inline_data'):
                print(f"    ✓ has inline_data")
                if part.inline_data:
                    print(f"      Type: {type(part.inline_data)}")
                    if hasattr(part.inline_data, 'data'):
                        print(f"      ✓ has data")
                        print(f"        Length: {len(part.inline_data.data)} bytes")
                        print(f"        First 32 bytes: {part.inline_data.data[:32].hex()}")
                    if hasattr(part.inline_data, 'mime_type'):
                        print(f"      MIME type: {part.inline_data.mime_type}")

            if hasattr(part, 'data'):
                print(f"    ✓ has data (direct)")
                if part.data:
                    print(f"      Length: {len(part.data)} bytes")
    else:
        print(f"  Value: None or empty")
else:
    print(f"✗ response.parts does NOT exist")
print()

# Check for candidates
if hasattr(response, 'candidates'):
    print(f"✓ response.candidates exists")
    if response.candidates:
        print(f"  Number of candidates: {len(response.candidates)}")
        for i, candidate in enumerate(response.candidates):
            print(f"\n  Candidate {i}:")
            print(f"    Type: {type(candidate)}")

            if hasattr(candidate, 'content'):
                print(f"    ✓ has content")
                if candidate.content and hasattr(candidate.content, 'parts'):
                    print(f"      Number of parts: {len(candidate.content.parts)}")
                    for j, part in enumerate(candidate.content.parts):
                        print(f"\n      Part {j}:")
                        print(f"        Type: {type(part)}")
                        if hasattr(part, 'inline_data'):
                            print(f"        ✓ has inline_data")
    else:
        print(f"  Value: None or empty")
else:
    print(f"✗ response.candidates does NOT exist")

print()
print("=" * 60)
