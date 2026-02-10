"""
AI Service
다양한 AI 모델 (OpenAI, Claude, Gemini, DeepSeek, Perplexity) 통합 서비스
"""
import os
from typing import Dict, Any, List, Optional
import requests


class AIService:
    """AI 모델 통합 서비스"""

    def __init__(self):
        self.api_keys = {
            'openai': os.getenv('OPENAI_API_KEY'),
            'anthropic': os.getenv('ANTHROPIC_API_KEY'),
            # Backward compatibility: some setups store Gemini key as GOOGLE_API_KEY
            'gemini': os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY'),
            'deepseek': os.getenv('DEEPSEEK_API_KEY'),
            'perplexity': os.getenv('PERPLEXITY_API_KEY')
        }

        print("\n[AI] AI Service 초기화")
        for model_name, key in self.api_keys.items():
            if key:
                key_preview = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else key
                print(f"  [OK] {model_name}: {key_preview}")
            else:
                print(f"  [X] {model_name}: API 키 없음")

    def test_model(self, model: str, api_key: str) -> Dict[str, Any]:
        """
        AI 모델 API 키 테스트

        Args:
            model: 모델 이름 (openai, anthropic, gemini, deepseek, perplexity)
            api_key: API 키

        Returns:
            테스트 결과
        """
        try:
            if model == 'openai':
                return self._test_openai(api_key)
            elif model == 'anthropic':
                return self._test_anthropic(api_key)
            elif model == 'gemini':
                return self._test_gemini(api_key)
            elif model == 'deepseek':
                return self._test_deepseek(api_key)
            elif model == 'perplexity':
                return self._test_perplexity(api_key)
            else:
                return {"success": False, "error": "지원하지 않는 모델입니다."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _test_openai(self, api_key: str) -> Dict[str, Any]:
        """OpenAI API 테스트"""
        try:
            response = requests.post(
                'https://api.openai.com/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'gpt-3.5-turbo',
                    'messages': [{'role': 'user', 'content': 'test'}],
                    'max_tokens': 5
                },
                timeout=10
            )

            if response.status_code == 200:
                return {"success": True, "message": "OpenAI API 키가 유효합니다."}
            else:
                return {"success": False, "error": f"API 오류: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _test_anthropic(self, api_key: str) -> Dict[str, Any]:
        """Anthropic (Claude) API 테스트"""
        try:
            response = requests.post(
                'https://api.anthropic.com/v1/messages',
                headers={
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'claude-3-haiku-20240307',
                    'messages': [{'role': 'user', 'content': 'test'}],
                    'max_tokens': 5
                },
                timeout=10
            )

            if response.status_code == 200:
                return {"success": True, "message": "Anthropic API 키가 유효합니다."}
            else:
                return {"success": False, "error": f"API 오류: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _test_gemini(self, api_key: str) -> Dict[str, Any]:
        """Google Gemini API 테스트"""
        try:
            response = requests.post(
                f'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={api_key}',
                headers={'Content-Type': 'application/json'},
                json={
                    'contents': [{'parts': [{'text': 'test'}]}]
                },
                timeout=10
            )

            if response.status_code == 200:
                return {"success": True, "message": "Gemini API 키가 유효합니다."}
            else:
                return {"success": False, "error": f"API 오류: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _test_deepseek(self, api_key: str) -> Dict[str, Any]:
        """DeepSeek API 테스트"""
        try:
            response = requests.post(
                'https://api.deepseek.com/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'deepseek-chat',
                    'messages': [{'role': 'user', 'content': 'test'}],
                    'max_tokens': 5
                },
                timeout=10
            )

            if response.status_code == 200:
                return {"success": True, "message": "DeepSeek API 키가 유효합니다."}
            else:
                return {"success": False, "error": f"API 오류: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _test_perplexity(self, api_key: str) -> Dict[str, Any]:
        """Perplexity API 테스트"""
        try:
            response = requests.post(
                'https://api.perplexity.ai/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'llama-3.1-sonar-small-128k-online',
                    'messages': [{'role': 'user', 'content': 'test'}],
                    'max_tokens': 5
                },
                timeout=10
            )

            if response.status_code == 200:
                return {"success": True, "message": "Perplexity API 키가 유효합니다."}
            else:
                return {"success": False, "error": f"API 오류: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def recommend_keywords(self, base_keyword: str, model: str = 'openai') -> Dict[str, Any]:
        """
        트렌드 키워드 AI 추천

        Args:
            base_keyword: 기본 키워드
            model: 사용할 AI 모델

        Returns:
            추천 키워드 리스트
        """
        api_key = self.api_keys.get(model)
        if not api_key:
            return {"success": False, "error": f"{model} API 키가 설정되지 않았습니다."}

        prompt = f""""{base_keyword}"와 관련된 트렌드 키워드 5개를 추천해주세요.

요구사항:
1. 검색량이 높을 것으로 예상되는 키워드
2. 최근 트렌드를 반영한 키워드
3. 각 키워드는 한 줄에 하나씩, 번호 없이 작성

예시 형식:
키워드1
키워드2
키워드3
키워드4
키워드5"""

        try:
            if model == 'openai':
                result = self._call_openai(api_key, prompt)
            elif model == 'anthropic':
                result = self._call_anthropic(api_key, prompt)
            elif model == 'gemini':
                result = self._call_gemini(api_key, prompt)
            elif model == 'deepseek':
                result = self._call_deepseek(api_key, prompt)
            elif model == 'perplexity':
                result = self._call_perplexity(api_key, prompt)
            else:
                return {"success": False, "error": "지원하지 않는 모델입니다."}

            if not result.get('success'):
                return result

            # 키워드 추출
            text = result['text']
            keywords = [line.strip() for line in text.split('\n') if line.strip() and not line.strip().isdigit()]
            keywords = keywords[:5]  # 최대 5개

            return {
                "success": True,
                "keywords": keywords,
                "model": model
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    def discover_niche(self, topic: str, model: str = 'openai') -> Dict[str, Any]:
        """
        YouTube 틈새 키워드 발굴

        Args:
            topic: 주제/분야
            model: 사용할 AI 모델

        Returns:
            틈새 키워드 및 분석
        """
        api_key = self.api_keys.get(model)
        if not api_key:
            return {"success": False, "error": f"{model} API 키가 설정되지 않았습니다."}

        prompt = f"""YouTube에서 "{topic}" 분야의 틈새 키워드를 발굴해주세요.

요구사항:
1. 경쟁이 적고 수요가 있는 키워드
2. 구독자가 적어도 조회수를 얻기 좋은 키워드
3. 최근 1-2년 내 성장 가능성이 높은 키워드
4. 키워드 6개를 추천하고, 각 키워드는 한 줄에 하나씩 작성

형식:
키워드1
키워드2
키워드3
키워드4
키워드5
키워드6

---분석---
(간단한 시장 분석 2-3문장)"""

        try:
            if model == 'openai':
                result = self._call_openai(api_key, prompt)
            elif model == 'anthropic':
                result = self._call_anthropic(api_key, prompt)
            elif model == 'gemini':
                result = self._call_gemini(api_key, prompt)
            elif model == 'deepseek':
                result = self._call_deepseek(api_key, prompt)
            elif model == 'perplexity':
                result = self._call_perplexity(api_key, prompt)
            else:
                return {"success": False, "error": "지원하지 않는 모델입니다."}

            if not result.get('success'):
                return result

            # 키워드와 분석 분리
            text = result['text']
            parts = text.split('---분석---')

            keywords = []
            if len(parts) > 0:
                keyword_lines = parts[0].strip().split('\n')
                keywords = [line.strip() for line in keyword_lines if line.strip() and not line.strip().startswith('#')]
                keywords = keywords[:6]

            analysis = parts[1].strip() if len(parts) > 1 else ""

            return {
                "success": True,
                "keywords": keywords,
                "analysis": analysis,
                "topic": topic,
                "model": model
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    def generate_metadata(self, script: str, model: str = 'openai') -> Dict[str, Any]:
        """
        YouTube 메타데이터 생성 (제목 5개, 설명, 태그)

        Args:
            script: 영상 스크립트
            model: 사용할 AI 모델

        Returns:
            메타데이터 (제목, 설명, 태그)
        """
        print("\n" + "="*60)
        print("📊 메타데이터 생성 시작")
        print("="*60)
        print(f"스크립트 길이: {len(script)} 글자")

        # 사용 가능한 모델 찾기 (우선순위: openai > deepseek > gemini > anthropic)
        available_model = None
        for m in ['openai', 'deepseek', 'gemini', 'anthropic']:
            if self.api_keys.get(m):
                available_model = m
                print(f"✅ 사용 가능한 API 키 발견: {m}")
                break
            else:
                print(f"❌ API 키 없음: {m}")

        if not available_model:
            print("❌ 사용 가능한 AI API 키가 없습니다.")
            print("="*60 + "\n")
            return {"success": False, "error": "사용 가능한 AI API 키가 없습니다."}

        api_key = self.api_keys[available_model]

        prompt = f"""다음 YouTube 영상 스크립트를 기반으로 메타데이터를 생성해주세요.

스크립트:
{script}

요구사항:
1. **제목 5개** (각기 다른 스타일, 각 제목은 한 줄로):
   - 궁금증 유발형
   - 핵심 요약형
   - 감성 강조형
   - 숫자/통계형
   - 트렌디한 표현형

2. **설명** (200-300자, YouTube 설명란에 들어갈 내용):
   - 영상 내용 요약
   - 핵심 키워드 포함
   - 시청자 행동 유도 문구 포함

3. **태그** (10-15개, 쉼표로 구분):
   - 핵심 키워드
   - 관련 검색어
   - 트렌드 키워드

출력 형식 (정확히 이 형식으로):
===TITLE===
제목1
제목2
제목3
제목4
제목5
===DESCRIPTION===
(설명 내용)
===TAGS===
태그1, 태그2, 태그3, ..."""

        try:
            print(f"📡 AI 모델 호출 중: {available_model}")

            if available_model == 'openai':
                result = self._call_openai(api_key, prompt)
            elif available_model == 'anthropic':
                result = self._call_anthropic(api_key, prompt)
            elif available_model == 'gemini':
                result = self._call_gemini(api_key, prompt)
            elif available_model == 'deepseek':
                result = self._call_deepseek(api_key, prompt)
            else:
                print("❌ 지원하지 않는 모델")
                return {"success": False, "error": "지원하지 않는 모델입니다."}

            if not result.get('success'):
                print(f"❌ AI 호출 실패: {result.get('error')}")
                print("="*60 + "\n")
                return result

            # 파싱
            text = result['text']
            print(f"✅ AI 응답 받음 (길이: {len(text)} 글자)")

            # 제목 추출
            titles = []
            if '===TITLE===' in text:
                title_section = text.split('===TITLE===')[1].split('===DESCRIPTION===')[0].strip()
                titles = [line.strip() for line in title_section.split('\n') if line.strip()]
                titles = titles[:5]
                print(f"✅ 제목 {len(titles)}개 파싱 성공")
            else:
                print("⚠️ ===TITLE=== 마커 없음")

            # 설명 추출
            description = ""
            if '===DESCRIPTION===' in text:
                desc_section = text.split('===DESCRIPTION===')[1].split('===TAGS===')[0].strip()
                description = desc_section
                print(f"✅ 설명 파싱 성공 (길이: {len(description)} 글자)")
            else:
                print("⚠️ ===DESCRIPTION=== 마커 없음")

            # 태그 추출
            tags = []
            if '===TAGS===' in text:
                tags_section = text.split('===TAGS===')[1].strip()
                tags = [tag.strip() for tag in tags_section.split(',') if tag.strip()]
                tags = tags[:15]
                print(f"✅ 태그 {len(tags)}개 파싱 성공")
            else:
                print("⚠️ ===TAGS=== 마커 없음")

            # 기본값 설정 (파싱 실패 시)
            if not titles:
                print("⚠️ 제목 파싱 실패, 기본값 사용")
                titles = [
                    "흥미로운 영상 제목",
                    "반드시 봐야 할 영상",
                    "놀라운 사실 공개",
                    "10가지 핵심 내용",
                    "지금 바로 확인하세요"
                ]

            if not description:
                print("⚠️ 설명 파싱 실패, 기본값 사용")
                description = "이 영상에서는 흥미로운 내용을 다룹니다. 끝까지 시청해주세요!"

            if not tags:
                print("⚠️ 태그 파싱 실패, 기본값 사용")
                tags = ["유튜브", "영상", "추천", "정보", "꿀팁"]

            print("✅ 메타데이터 생성 완료")
            print("="*60 + "\n")

            return {
                "success": True,
                "titles": titles,
                "description": description,
                "tags": tags,
                "model": available_model
            }

        except Exception as e:
            print(f"❌ 예외 발생: {e}")
            import traceback
            traceback.print_exc()
            print("="*60 + "\n")
            return {"success": False, "error": str(e)}

    def generate_thumbnail_prompts(self, script: str, model: str = 'openai') -> Dict[str, Any]:
        """
        YouTube 썸네일 프롬프트 생성 (4개, 다양한 스타일)

        Args:
            script: 영상 스크립트
            model: 사용할 AI 모델

        Returns:
            썸네일 프롬프트 리스트
        """
        print("\n" + "="*60)
        print("🎨 썸네일 프롬프트 생성 시작")
        print("="*60)
        print(f"스크립트 길이: {len(script)} 글자")

        # 사용 가능한 모델 찾기
        available_model = None
        for m in ['openai', 'deepseek', 'gemini', 'anthropic']:
            if self.api_keys.get(m):
                available_model = m
                print(f"✅ 사용 가능한 API 키 발견: {m}")
                break
            else:
                print(f"❌ API 키 없음: {m}")

        if not available_model:
            print("❌ 사용 가능한 AI API 키가 없습니다.")
            print("="*60 + "\n")
            return {"success": False, "error": "사용 가능한 AI API 키가 없습니다."}

        api_key = self.api_keys[available_model]

        prompt = f"""다음 YouTube 영상 스크립트를 기반으로 썸네일 이미지 생성 프롬프트를 만들어주세요.

스크립트:
{script}

🎨 시각화 GEMS: 프롬프트 표준 구조 (6-Section)

프롬프트는 반드시 다음 6가지 섹션 순서로 작성:

1. **Style Wrapper** (고정)
   - "2D flat vector style, minimal design, 4K, crisp lines"

2. **Shot Size & Angle** (고정)
   - "Wide shot, full body, NO CLOSE-UP"

3. **Subject & Action**
   - 스틱맨의 구체적인 행동 설명 (예: pointing at a rising stock graph, holding a trophy, celebrating with arms raised)

4. **Environment**
   - 배경 설명 및 소품
   - 숫자나 한글 텍스트가 필요한 경우 명시

5. **Consistency Anchor** (고정)
   - "Stickman, blue shirt, red tie"

6. **Negative Wrapper** (고정)
   - "NO 3D, NO realistic photo, NO close-up, NO blurry, --ar 16:9"

요구사항:
1. **4개의 프롬프트** 생성 (각기 다른 씬/상황)
2. 각 프롬프트는 영문으로 작성
3. 각 프롬프트는 위 6-Section 구조를 정확히 따를 것
4. Subject & Action과 Environment만 스크립트에 맞게 변경
5. 나머지 섹션(Style, Shot, Anchor, Negative)은 고정값 사용

💡 실제 적용 예시:
"2D flat vector style, minimal design, 4K, Wide shot, full body, a stickman pointing at a rising stock graph, clean white office background with a simple desk, Stickman, blue shirt, red tie, NO 3D, NO realistic photo, --ar 16:9"

출력 형식 (정확히 이 형식으로):
===PROMPT1===
(6-Section 구조 프롬프트 1)
===PROMPT2===
(6-Section 구조 프롬프트 2)
===PROMPT3===
(6-Section 구조 프롬프트 3)
===PROMPT4===
(6-Section 구조 프롬프트 4)"""

        try:
            print(f"📡 AI 모델 호출 중: {available_model}")

            if available_model == 'openai':
                result = self._call_openai(api_key, prompt)
            elif available_model == 'anthropic':
                result = self._call_anthropic(api_key, prompt)
            elif available_model == 'gemini':
                result = self._call_gemini(api_key, prompt)
            elif available_model == 'deepseek':
                result = self._call_deepseek(api_key, prompt)
            else:
                print("❌ 지원하지 않는 모델")
                return {"success": False, "error": "지원하지 않는 모델입니다."}

            if not result.get('success'):
                print(f"❌ AI 호출 실패: {result.get('error')}")
                print("="*60 + "\n")
                return result

            # 파싱
            text = result['text']
            print(f"✅ AI 응답 받음 (길이: {len(text)} 글자)")
            print(f"응답 미리보기: {text[:200]}...")

            prompts = []

            for i in range(1, 5):
                marker = f"===PROMPT{i}==="
                if marker in text:
                    if i < 4:
                        next_marker = f"===PROMPT{i+1}==="
                        prompt_text = text.split(marker)[1].split(next_marker)[0].strip()
                    else:
                        prompt_text = text.split(marker)[1].strip()
                    prompts.append(prompt_text)
                    print(f"✅ PROMPT{i} 파싱 성공 (길이: {len(prompt_text)} 글자)")
                else:
                    print(f"⚠️ PROMPT{i} 마커 없음")

            # 기본값 설정 (파싱 실패 시) - 6-Section 구조
            if len(prompts) < 4:
                print(f"⚠️ 파싱된 프롬프트 수: {len(prompts)}개, 기본값 사용")
                prompts = [
                    "2D flat vector style, minimal design, 4K, crisp lines, Wide shot, full body, a stickman pointing at a rising chart with excitement, clean white office background with simple desk and computer, Stickman, blue shirt, red tie, NO 3D, NO realistic photo, NO close-up, NO blurry, --ar 16:9",
                    "2D flat vector style, minimal design, 4K, crisp lines, Wide shot, full body, a stickman holding a trophy above head celebrating, minimalist podium background with simple geometric shapes, Stickman, blue shirt, red tie, NO 3D, NO realistic photo, NO close-up, NO blurry, --ar 16:9",
                    "2D flat vector style, minimal design, 4K, crisp lines, Wide shot, full body, a stickman presenting with hand gesture toward presentation board, modern conference room with clean background, Stickman, blue shirt, red tie, NO 3D, NO realistic photo, NO close-up, NO blurry, --ar 16:9",
                    "2D flat vector style, minimal design, 4K, crisp lines, Wide shot, full body, a stickman working on laptop with focused expression, simple workspace with minimal desk setup, Stickman, blue shirt, red tie, NO 3D, NO realistic photo, NO close-up, NO blurry, --ar 16:9"
                ]
            else:
                print(f"✅ {len(prompts)}개 프롬프트 파싱 완료")

            print("="*60 + "\n")

            return {
                "success": True,
                "prompts": prompts[:4],
                "model": available_model
            }

        except Exception as e:
            print(f"❌ 예외 발생: {e}")
            import traceback
            traceback.print_exc()
            print("="*60 + "\n")
            return {"success": False, "error": str(e)}

    def _call_openai(self, api_key: str, prompt: str) -> Dict[str, Any]:
        """OpenAI API 호출"""
        try:
            response = requests.post(
                'https://api.openai.com/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'gpt-4o-mini',
                    'messages': [{'role': 'user', 'content': prompt}],
                    'max_tokens': 500,
                    'temperature': 0.7
                },
                timeout=60  # 60초로 증가
            )

            if response.status_code == 200:
                data = response.json()
                return {"success": True, "text": data['choices'][0]['message']['content']}
            elif response.status_code == 429:
                return {"success": False, "error": "API 사용 한도 초과. 잠시 후 다시 시도하세요."}
            elif response.status_code == 401:
                return {"success": False, "error": "API 키가 유효하지 않습니다. 설정을 확인하세요."}
            elif response.status_code == 500:
                return {"success": False, "error": "OpenAI 서버 오류. 잠시 후 다시 시도하세요."}
            else:
                return {"success": False, "error": f"API 오류 (코드: {response.status_code})"}
        except requests.Timeout:
            return {"success": False, "error": "요청 시간 초과 (60초). 네트워크를 확인하거나 다시 시도하세요."}
        except requests.ConnectionError:
            return {"success": False, "error": "네트워크 연결 오류. 인터넷 연결을 확인하세요."}
        except Exception as e:
            return {"success": False, "error": f"OpenAI API 오류: {str(e)}"}

    def _call_anthropic(self, api_key: str, prompt: str) -> Dict[str, Any]:
        """Anthropic API 호출"""
        try:
            response = requests.post(
                'https://api.anthropic.com/v1/messages',
                headers={
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'claude-3-haiku-20240307',
                    'messages': [{'role': 'user', 'content': prompt}],
                    'max_tokens': 500
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                return {"success": True, "text": data['content'][0]['text']}
            else:
                return {"success": False, "error": f"API 오류: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _call_gemini(self, api_key: str, prompt: str) -> Dict[str, Any]:
        """Gemini API 호출"""
        try:
            response = requests.post(
                f'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={api_key}',
                headers={'Content-Type': 'application/json'},
                json={
                    'contents': [{'parts': [{'text': prompt}]}],
                    'generationConfig': {
                        'temperature': 0.7,
                        'maxOutputTokens': 500
                    }
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                return {"success": True, "text": data['candidates'][0]['content']['parts'][0]['text']}
            else:
                return {"success": False, "error": f"API 오류: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _call_deepseek(self, api_key: str, prompt: str) -> Dict[str, Any]:
        """DeepSeek API 호출"""
        try:
            response = requests.post(
                'https://api.deepseek.com/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'deepseek-chat',
                    'messages': [{'role': 'user', 'content': prompt}],
                    'max_tokens': 500,
                    'temperature': 0.7
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                return {"success": True, "text": data['choices'][0]['message']['content']}
            else:
                return {"success": False, "error": f"API 오류: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _call_perplexity(self, api_key: str, prompt: str) -> Dict[str, Any]:
        """Perplexity API 호출"""
        try:
            response = requests.post(
                'https://api.perplexity.ai/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'llama-3.1-sonar-small-128k-online',
                    'messages': [{'role': 'user', 'content': prompt}],
                    'max_tokens': 500,
                    'temperature': 0.7
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                return {"success": True, "text": data['choices'][0]['message']['content']}
            else:
                return {"success": False, "error": f"API 오류: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}


# 싱글톤 인스턴스
ai_service = AIService()
