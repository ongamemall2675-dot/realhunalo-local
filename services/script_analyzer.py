import os
import json
import logging
from openai import OpenAI
from typing import List, Dict

# 로깅 설정
logger = logging.getLogger(__name__)

class ScriptAnalyzer:
    """
    대본(Script)을 숏폼 영상 제작에 적합한 장면(Scene) 단위로 분석하고 분할하는 클래스입니다.
    OpenAI GPT-4o를 활용하여 맥락에 맞는 비주얼 키워드를 추출합니다.
    """

    def __init__(self):
        """
        AI 클라이언트를 초기화합니다.
        """
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.deepseek_key = os.getenv("DEEPSEEK_API_KEY")
        
        self.client = None
        self.model = "gpt-4o"
        
        if self.deepseek_key:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.deepseek_key, base_url="https://api.deepseek.com")
            self.model = "deepseek-chat"
            print("[OK] ScriptAnalyzer: DeepSeek Client 초기화 완료")
        elif self.openai_key:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.openai_key)
            self.model = "gpt-4o"
            print("[OK] ScriptAnalyzer: OpenAI Client 초기화 완료")
        else:
            logger.warning("AI API 키가 설정되지 않았습니다.")

    def analyze_script(self, script_text: str, style_context: Dict = None) -> List[Dict]:
        """
        텍스트 대본을 입력받아 장면별 정보(대사, 예상 지속시간, 비주얼 키워드)가 담긴 리스트를 반환합니다.

        Args:
            script_text (str): 분석할 전체 대본 텍스트
            style_context (Dict, optional): 사용자 선택 스타일 정보 (name, style_prompt, etc.)

        Returns:
            List[Dict]: 장면(Scene) 객체의 리스트.
        """
        try:
            logger.info("대본 분석 시작...")
            
            # 스타일 정보 구성
            style_instruction = ""
            if style_context:
                style_name = style_context.get('name', 'General')
                style_desc = style_context.get('style', '')
                style_shot = style_context.get('shot', '')
                style_env = style_context.get('environment', '')
                
                style_instruction = f"""
                CRITICAL: The user has selected the '{style_name}' art style.
                - Visual Style: {style_desc}
                - Shot Type: {style_shot}
                - Environment: {style_env}
                
                When generating 'visual_keyword', you MUST incorporate these style details.
                Ensure the prompts are optimized for this specific art style.
                """

            prompt = f"""Identify distinct scenes from the following script suitable for a vertical short-form video (YouTube Shorts/TikTok).
            **CRITICAL RULE: 50-Character Limit Per Scene.**
            1. Every scene text MUST be **UNDER 50 characters**.
            2. If a user sentence is longer than 50 characters, YOU MUST split it into multiple logical scenes.
            3. Do NOT provide any scene longer than 50 characters. This is a hard constraint for readability.
            4. Extract a 'visual_keyword' optimized for AI image generation (e.g., Flux).
               - Include 'vertical view', '9:16 aspect ratio', 'cinematic lighting'.
            5. Estimate 'duration' in seconds (approx. 4 chars per second).

            {style_instruction}

            Script:
            "{script_text}"

            Return A JSON OBJECT with a key "scenes" containing the array:
            {{
                "scenes": [
                    {{
                        "text": "Segment text (max 50 chars)",
                        "duration": 3.5,
                        "visual_keyword": "description, vertical 9:16"
                    }}
                ]
            }}
            """

            # Reasoner 모델 사용 시도 (설정된 경우)
            analyzer_model = self.model
            if "reasoner" in analyzer_model.lower():
                 # Reasoner 특화 설정
                 pass

            response = self.client.chat.completions.create(
                model=analyzer_model,
                messages=[
                    {"role": "system", "content": "You are a professional video director. You strictly follow the 50-character limit for every scene to ensure fast-paced content."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"} if "deepseek" not in analyzer_model.lower() else None
            )

            result = response.choices[0].message.content
            scenes_data = json.loads(result).get("scenes", [])
            
            # 후처리: sceneId 추가 및 최종 길이 검증
            formatted_scenes = []
            for idx, scene in enumerate(scenes_data):
                text = scene.get("text", "").strip()
                if not text: continue
                
                # AI가 50자를 넘겼을 경우를 대비한 최후의 보루 (강제 절단)
                if len(text) > 60:
                    logger.warning(f"Scene {idx+1} exceeds limit ({len(text)} chars). Forcing fallback split.")
                    parts = self._force_chunk_text(text, 50)
                    for p_idx, part in enumerate(parts):
                        formatted_scenes.append({
                            "sceneId": len(formatted_scenes) + 1,
                            "text": part,
                            "duration": len(part) * 0.25,
                            "visual_keyword": scene.get("visual_keyword", "abstract background, vertical 9:16"),
                            "visual_style": style_context.get('name', 'realistic') if style_context else "realistic"
                        })
                else:
                    formatted_scenes.append({
                        "sceneId": len(formatted_scenes) + 1,
                        "text": text,
                        "duration": scene.get("duration", 3.0),
                        "visual_keyword": scene.get("visual_keyword", "abstract background, vertical 9:16"),
                        "visual_style": style_context.get('name', 'realistic') if style_context else "realistic"
                    })
            
            logger.info(f"대본 분석 완료: 총 {len(formatted_scenes)}개 장면 생성")
            return formatted_scenes

        except Exception as e:
            logger.error(f"대본 분석 중 오류 발생: {str(e)}")
            return self._fallback_split(script_text)

    def _force_chunk_text(self, text: str, max_chars: int) -> List[str]:
        """텍스트를 강제로 지정된 길이로 쪼앱니다."""
        chunks = []
        words = text.split()
        current_chunk = ""
        for word in words:
            if len(current_chunk) + len(word) + 1 <= max_chars:
                current_chunk += (word + " ")
            else:
                if current_chunk: chunks.append(current_chunk.strip())
                current_chunk = word + " "
        if current_chunk: chunks.append(current_chunk.strip())
        return chunks

    def _fallback_split(self, text: str) -> List[Dict]:
        """
        AI 분석 실패 시 실행되는 백업 로직입니다.
        강력한 길이 기반 분할을 수행합니다.
        """
        logger.info("Fallback 분할 로직 실행 (50자 강제 쪼개기)")
        
        # 1. 일단 마침표와 줄바꿈으로 나눔
        raw_lines = []
        for line in text.replace('.', '.\n').split('\n'):
            if line.strip(): raw_lines.append(line.strip())
            
        # 2. 각 라인이 50자를 넘으면 강제로 쪼갬
        final_lines = []
        for line in raw_lines:
            if len(line) > 50:
                final_lines.extend(self._force_chunk_text(line, 50))
            else:
                final_lines.append(line)
                
        scenes = []
        for idx, sent in enumerate(final_lines):
            scenes.append({
                "sceneId": idx + 1,
                "text": sent,
                "duration": max(2.0, len(sent) * 0.25),
                "visual_keyword": "cinematic background, vertical 9:16",
                "visual_style": "realistic"
            })
        return scenes
