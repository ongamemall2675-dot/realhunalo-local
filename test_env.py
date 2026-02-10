"""
.env 파일 로드 테스트
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# .env 파일 경로
env_path = Path(__file__).parent / '.env'

print(f"\n{'='*60}")
print("🧪 환경변수 로드 테스트")
print(f"{'='*60}")
print(f"\n.env 파일 경로: {env_path}")
print(f"파일 존재 여부: {env_path.exists()}")

if not env_path.exists():
    print("❌ .env 파일이 없습니다!")
    exit(1)

# .env 파일 로드
load_dotenv(dotenv_path=env_path, override=True)

# API 키 확인
api_keys = {
    'OPENAI_API_KEY': os.getenv('OPENAI_API_KEY'),
    'GEMINI_API_KEY': os.getenv('GEMINI_API_KEY'),
    'ANTHROPIC_API_KEY': os.getenv('ANTHROPIC_API_KEY'),
    'DEEPSEEK_API_KEY': os.getenv('DEEPSEEK_API_KEY'),
    'PERPLEXITY_API_KEY': os.getenv('PERPLEXITY_API_KEY'),
    'REPLICATE_API_TOKEN': os.getenv('REPLICATE_API_TOKEN'),
    'ELEVENLABS_API_KEY': os.getenv('ELEVENLABS_API_KEY'),
    'AZURE_SPEECH_KEY': os.getenv('AZURE_SPEECH_KEY'),
}

print(f"\n{'='*60}")
print("📋 API 키 상태")
print(f"{'='*60}\n")

for key_name, key_value in api_keys.items():
    if key_value:
        # 키의 앞 10자와 뒤 4자만 표시
        if len(key_value) > 14:
            masked = f"{key_value[:10]}...{key_value[-4:]}"
        else:
            masked = key_value
        print(f"✅ {key_name:25s} {masked}")
    else:
        print(f"❌ {key_name:25s} 없음")

print(f"\n{'='*60}")

# AI 서비스 테스트
from services.ai_service import ai_service

print(f"\n{'='*60}")
print("🤖 AI 서비스 초기화 테스트")
print(f"{'='*60}\n")

available_models = []
for model_name, key in ai_service.api_keys.items():
    if key:
        available_models.append(model_name)
        print(f"✅ {model_name}: 사용 가능")
    else:
        print(f"❌ {model_name}: API 키 없음")

if available_models:
    print(f"\n✅ 총 {len(available_models)}개 AI 모델 사용 가능: {', '.join(available_models)}")
else:
    print(f"\n❌ 사용 가능한 AI 모델이 없습니다!")

print(f"\n{'='*60}\n")
