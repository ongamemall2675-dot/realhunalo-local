import os
import asyncio
from dotenv import load_dotenv

# Load env before importing services
load_dotenv(override=True)

from services.whisper_service import whisper_service

async def test_whisper():
    # Find any mp3 or wav in assets or temp
    test_file = None
    for d in ['assets', 'temp', 'output']:
        if os.path.exists(d):
            for f in os.listdir(d):
                if f.endswith('.mp3') or f.endswith('.wav'):
                    test_file = os.path.join(d, f)
                    break
        if test_file:
            break
            
    if not test_file:
        print("No test audio file found.")
        return
        
    print(f"Testing whisper with: {test_file}")
    try:
        timestamps, text = whisper_service.transcribe_audio(test_file)
        print("Success:", text[:50], f"({len(timestamps)} timestamps)")
    except Exception as e:
        print("Whisper Error:", str(e))

if __name__ == "__main__":
    asyncio.run(test_whisper())
