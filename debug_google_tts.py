"""
Debug Google TTS persona loading
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import os
import json

# Test persona loading
config_path = os.path.join(os.path.dirname(__file__), 'config', 'voices_config.json')

print("=" * 60)
print("Google TTS Persona Loading Debug")
print("=" * 60)
print()

print(f"Config path: {config_path}")
print(f"File exists: {os.path.exists(config_path)}")
print()

if os.path.exists(config_path):
    with open(config_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        voices = data.get('voices', [])

        print(f"Total voices in config: {len(voices)}")
        print()

        if voices:
            print("First 3 voices:")
            for i, voice in enumerate(voices[:3]):
                print(f"\n{i+1}. Voice ID: {voice.get('id')}")
                print(f"   name_ko: {voice.get('name_ko')}")
                print(f"   gender: {voice.get('gender')}")
                print(f"   base_instruction: {voice.get('base_instruction', '')[:60]}...")

        # Test the dictionary construction
        print("\n" + "=" * 60)
        print("Testing dictionary construction:")
        print("=" * 60)

        personas = {}
        for voice in voices:
            personas[voice['id']] = voice

        print(f"Personas dict size: {len(personas)}")

        # Test get_voices_list() logic
        print("\n" + "=" * 60)
        print("Testing get_voices_list() logic:")
        print("=" * 60)

        result = []
        for persona_id, persona_data in personas.items():
            result.append({
                "id": persona_id,
                "name": persona_data.get("name_ko", persona_id),
                "name_ko": persona_data.get("name_ko", persona_id),
                "gender": persona_data.get("gender", "Unknown"),
                "base_instruction": persona_data.get("base_instruction", ""),
                "description": persona_data.get("base_instruction", "")
            })

        print(f"Result list size: {len(result)}")

        if result:
            print("\nFirst 3 results:")
            for i, voice in enumerate(result[:3]):
                print(f"\n{i+1}. ID: {voice['id']}")
                print(f"   name_ko: {voice['name_ko']}")
                print(f"   gender: {voice['gender']}")
                print(f"   base_instruction: {voice['base_instruction'][:60]}...")

else:
    print("[ERROR] Config file not found!")

print("\n" + "=" * 60)

# Now test the actual service
print("\nTesting actual GoogleTTSEngine:")
print("=" * 60)

try:
    from services.tts_google import google_tts_engine

    print(f"Engine initialized: {google_tts_engine is not None}")
    print(f"Client initialized: {google_tts_engine.client is not None}")
    print(f"Personas loaded: {len(google_tts_engine.personas)}")

    if google_tts_engine.personas:
        print("\nFirst persona from engine:")
        first_key = list(google_tts_engine.personas.keys())[0]
        first_persona = google_tts_engine.personas[first_key]
        print(f"  ID: {first_key}")
        print(f"  Data: {first_persona}")

    voices_list = google_tts_engine.get_voices_list()
    print(f"\nget_voices_list() returned: {len(voices_list)} voices")

    if voices_list:
        print("\nFirst voice from get_voices_list():")
        print(f"  {voices_list[0]}")

except Exception as e:
    print(f"[ERROR] Failed to test engine: {e}")
    import traceback
    traceback.print_exc()

print("=" * 60)
