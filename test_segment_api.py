
import os
from dotenv import load_dotenv

# load_dotenv MUST come before any service imports that use os.getenv in __init__
load_dotenv()

import asyncio
from services.script_service import script_service

async def test_segmentation():
    print("--- Testing Script Segmentation ---")
    test_text = "안녕하세요. 반가워요. 오늘 날씨가 참 좋네요. 부동산 투자는 시점이 중요합니다. 시니어를 위한 플랫폼을 만들고 있습니다."
    
    # Use deepseek-reasoner as it's the default in the UI
    model = "deepseek-reasoner"
    
    print(f"Model: {model}")
    print(f"Input: {test_text}")
    print(f"DeepSeek Key available: {bool(os.getenv('DEEPSEEK_API_KEY'))}")
    
    try:
        result = script_service.segment_text(test_text, model=model)
        if result.get("success"):
            print("[SUCCESS]")
            print("Segmented Script:")
            print("-" * 30)
            print(result.get("originalScript"))
            print("-" * 30)
        else:
            print(f"[FAILED] {result.get('error')}")
    except Exception as e:
        print(f"[EXCEPTION] {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_segmentation())
