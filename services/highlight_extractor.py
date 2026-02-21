import os
import json
import logging
from openai import OpenAI
from typing import List, Dict, Optional

# 로깅 설정
logger = logging.getLogger(__name__)

class HighlightExtractor:
    """
    기존 롱폼 영상의 대본(Long Script)에서 쇼츠로 제작하기 좋은 핵심 구간(Highlight)을 추출하는 클래스입니다.
    GPT-4o를 사용하여 시청 지속 시간(Retention)이 높을 것으로 예상되는 부분을 선별합니다.
    """

    def __init__(self):
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.deepseek_key = os.getenv("DEEPSEEK_API_KEY")
        
        self.client = None
        self.model = "gpt-4o"
        
        if self.deepseek_key:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.deepseek_key, base_url="https://api.deepseek.com")
            self.model = "deepseek-chat"
            print("[OK] HighlightExtractor: DeepSeek Client 초기화 완료")
        elif self.openai_key:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.openai_key)
            self.model = "gpt-4o"
            print("[OK] HighlightExtractor: OpenAI Client 초기화 완료")
        else:
            logger.warning("AI API 키가 설정되지 않았습니다.")

    def extract_highlights(self, full_script: str) -> Dict[str, List[Dict]]:
        """
        전체 대본에서 3가지 유형의 쇼츠 후보를 추출하여 반환합니다.

        Args:
            full_script (str): 전체 대본 텍스트

        Returns:
            Dict[str, List[Dict]]: 유형별 추천 쇼츠 대본 리스트
            {
                "summary": [...scenes...],
                "hook_first": [...scenes...],
                "qna": [...scenes...]
            }
        """
        try:
            logger.info("하이라이트 추출 시작...")
            
            prompt = f"""
            Analyze the following long-form script and extract 3 different short-form video scripts (approx. 45-60 seconds each).
            
            Types:
            1. 'summary': A concise summary of the key points.
            2. 'hook_first': Starts with the most shocking or interesting fact/statement to grab attention immediately.
            3. 'qna': Formatted as a question and answer session.

            For each type, generate a list of scenes similar to the previous task (text, duration, visual_keyword).
            
            Long Script:
            "{full_script[:15000]}" ... (truncated for token limit)

            Return ONLY a JSON object with keys 'summary', 'hook_first', 'qna', where each value is an array of scene objects.
            """

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert video editor who knows how to repurpose long content into viral shorts."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"} if "deepseek" not in self.model else None
            )

            result = json.loads(response.choices[0].message.content)
            
            # 후처리: 각 유형별 sceneId 재할당 및 검증
            processed_result = {}
            for key in ['summary', 'hook_first', 'qna']:
                scenes = result.get(key, [])
                processed_scenes = []
                for idx, scene in enumerate(scenes):
                    processed_scenes.append({
                        "sceneId": idx + 1,
                        "text": scene.get("text", ""),
                        "duration": scene.get("duration", 3.0),
                        "visual_keyword": scene.get("visual_keyword", "vertical video, 9:16"),
                        "visual_style": "repurposed"
                    })
                processed_result[key] = processed_scenes

            logger.info("하이라이트 추출 완료")
            return processed_result

        except Exception as e:
            logger.error(f"하이라이트 추출 중 오류: {str(e)}")
            return {}

    def analyze_project_script(self, project_path: str) -> Dict:
        """
        프로젝트 폴더 내의 script.json을 읽어 하이라이트를 추출합니다.
        """
        script_file = os.path.join(project_path, "script.json")
        if not os.path.exists(script_file):
            logger.error(f"대본 파일을 찾을 수 없음: {script_file}")
            return {}
        
        try:
            with open(script_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # data가 리스트인 경우 텍스트만 합침
                if isinstance(data, list):
                    full_text = " ".join([item.get('text', '') for item in data])
                else:
                    full_text = str(data)
                
                return self.extract_highlights(full_text)
        except Exception as e:
            logger.error(f"프로젝트 대본 읽기 실패: {str(e)}")
            return {}
