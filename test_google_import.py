"""
Test Google TTS import
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("=" * 60)
print("Testing Google TTS Import")
print("=" * 60)
print()

print("Step 1: Import tts_google module...")
try:
    from services import tts_google
    print("[OK] Module imported successfully")
    print(f"  Module path: {tts_google.__file__}")
except Exception as e:
    print(f"[ERROR] Failed to import module: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()
print("Step 2: Check google_tts_engine...")
try:
    from services.tts_google import google_tts_engine
    print(f"[OK] google_tts_engine exists: {google_tts_engine is not None}")
    if google_tts_engine:
        print(f"  Type: {type(google_tts_engine)}")
        print(f"  Client initialized: {google_tts_engine.client is not None}")
        print(f"  Personas loaded: {len(google_tts_engine.personas)}")
except Exception as e:
    print(f"[ERROR] Failed to get google_tts_engine: {e}")
    import traceback
    traceback.print_exc()

print()
print("Step 3: Import tts_service...")
try:
    from services import tts_service as svc_module
    print("[OK] tts_service module imported")

    if svc_module.tts_service:
        print(f"  tts_service initialized: True")
        print(f"  Available engines: {svc_module.tts_service.get_available_engines()}")
        print(f"  Primary engine: {svc_module.tts_service.primary_engine}")
    else:
        print("  [ERROR] tts_service is None")
except Exception as e:
    print(f"[ERROR] Failed to import tts_service: {e}")
    import traceback
    traceback.print_exc()

print()
print("=" * 60)
