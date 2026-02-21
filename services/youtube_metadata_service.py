"""
YouTube Metadata Generation Service
유튜브 메타데이터 자동 생성 (제목, 설명문, 태그, 썸네일 컨셉)
"""

from typing import Dict, List
import json
from openai import AsyncOpenAI
import os
# services.image_service import is handled inside the method locally to avoid circular imports


class YouTubeMetadataService:
    """유튜브 메타데이터 자동 생성 서비스"""
    
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o-mini"
    
    async def generate_metadata(self, script: str) -> Dict:
        """
        대본을 기반으로 유튜브 메타데이터 생성
        
        Args:
            script: 비디오 대본 텍스트
            
        Returns:
            {
                "titles": ["제목1", "제목2", "제목3"],
                "description": "설명문...",
                "tags": ["태그1", "태그2", ...],
                "thumbnail_ideas": ["컨셉1", "컨셉2", "컨셉3"],
                "analytics": {
                    "estimated_duration": "3분 25초",
                    "word_count": 450,
                    "character_count": 1250,
                    "is_shorts_suitable": false
                }
            }
        """
        
        try:
            # 1. 기본 분석
            analytics = self._analyze_script(script)
            
            # 2. GPT를 통한 메타데이터 생성
            prompt = self._build_prompt(script, analytics)
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "당신은 유튜브 콘텐츠 전문가입니다. 주어진 대본을 분석하여 SEO 최적화된 메타데이터를 생성합니다."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            
            # GPT 응답 파싱
            gpt_result = json.loads(response.choices[0].message.content)
            
            # 3. 최종 결과 구성
            result = {
                "titles": gpt_result.get("titles", []),
                "description": gpt_result.get("description", ""),
                "tags": gpt_result.get("tags", []),
                "thumbnail_ideas": gpt_result.get("thumbnail_ideas", []),
                "analytics": analytics
            }
            
            return result
            
        except Exception as e:
            print(f"[YouTubeMetadataService] Error: {e}")
            raise
    
    def _analyze_script(self, script: str) -> Dict:
        """대본 기본 분석 (길이, 글자수 등)"""
        
        word_count = len(script.split())
        character_count = len(script)
        
        # 평균 말하기 속도: 분당 150-160 단어 (한국어는 약간 느림)
        # 한국어는 음절 기준으로 분당 약 300-350 음절
        estimated_seconds = (character_count / 5.5)  # 초당 약 5.5자
        
        minutes = int(estimated_seconds // 60)
        seconds = int(estimated_seconds % 60)
        estimated_duration = f"{minutes}분 {seconds}초" if minutes > 0 else f"{seconds}초"
        
        # 유튜브 숏츠 적합성 (60초 이하)
        is_shorts_suitable = estimated_seconds <= 60
        
        return {
            "estimated_duration": estimated_duration,
            "estimated_seconds": int(estimated_seconds),
            "word_count": word_count,
            "character_count": character_count,
            "is_shorts_suitable": is_shorts_suitable
        }
    
    def _build_prompt(self, script: str, analytics: Dict) -> str:
        """GPT 프롬프트 생성"""
        
        return f"""
다음 비디오 대본을 분석하여 유튜브 메타데이터를 JSON 형식으로 생성해주세요.

**대본:**
{script[:1000]}{"..." if len(script) > 1000 else ""}

**예상 길이:** {analytics['estimated_duration']}

다음 형식의 JSON을 반환해주세요:

{{
  "titles": [
    "메인 타겟 제목 (클릭률 최적화)",
    "SEO 최적화 제목 (검색 노출)",
    "호기심 자극 제목 (클릭베이트)"
  ],
  "description": "유튜브 설명문 (핵심 내용 요약, 타임스탬프 챕터 포함, SEO 키워드 자연스럽게 포함, 3-5문단)",
  "tags": ["태그1", "태그2", ..., "태그20"],
  "thumbnail_ideas": [
    "썸네일 컨셉 1: 시각적 요소 + 텍스트 제안",
    "썸네일 컨셉 2: 다른 스타일 접근",
    "썸네일 컨셉 3: 감정 자극형"
  ]
}}

**주의사항:**
1. 제목은 40자 이내로 작성
2. 태그는 관련성 높은 순으로 20개 생성 (한글/영어 혼용)
3. 설명문은 자연스럽고 읽기 쉽게 작성
4. 썸네일 컨셉은 구체적으로 제안 (색상, 텍스트, 이미지 요소 포함)
"""

    async def generate_thumbnail_prompts(self, script: str) -> List[str]:
        """
        대본을 기반으로 썸네일 프롬프트 3개 생성
        """
        try:
            # Import image_service locally if needed, but here we just need GPT
            
            prompt = f"""
다음은 유튜브 영상 대본입니다. 이 영상의 썸네일 이미지 생성을 위한 프롬프트 3개를 영어로 작성해주세요.
각 프롬프트는 고품질의 이미지 생성 AI(Flux, Midjourney 등)에 최적화되어야 합니다.

**대본 요약:**
{script[:500]}...

**요구사항:**
1. 3개의 서로 다른 스타일(예: 실사풍, 일러스트풍, 3D 렌더링 등)로 제안하세요.
2. 텍스트 요소보다는 시각적 묘사에 집중하세요.
3. 영어로 작성해주세요.
4. JSON 형식으로 반환해주세요: {{"prompts": ["prompt1", "prompt2", "prompt3"]}}
"""

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a prompt engineer for AI image generation."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            return result.get("prompts", [])
            
        except Exception as e:
            print(f"[YouTubeMetadataService] Error generating thumbnail prompts: {e}")
            raise

    async def generate_thumbnail_image(self, prompt: str) -> str:
        """
        프롬프트로 썸네일 이미지 생성 (ImageService 사용)
        """
        try:
            # 순환 참조 방지를 위해 메서드 내부에서 import
            from services.image_service import image_service
            
            # YouTube 썸네일 비율 16:9
            result = await image_service.generate(
                prompt=prompt,
                aspect_ratio="16:9",
                model="black-forest-labs/flux-schnell"
            )
            
            if result.get("success"):
                return result.get("imageUrl")
            else:
                raise Exception(result.get("error", "Unknown error"))
                
        except Exception as e:
            print(f"[YouTubeMetadataService] Error generating thumbnail image: {e}")
            raise


# 싱글톤 인스턴스
_youtube_metadata_service = None

def get_youtube_metadata_service() -> YouTubeMetadataService:
    """YouTube Metadata Service 싱글톤 인스턴스 반환"""
    global _youtube_metadata_service
    if _youtube_metadata_service is None:
        _youtube_metadata_service = YouTubeMetadataService()
    return _youtube_metadata_service
