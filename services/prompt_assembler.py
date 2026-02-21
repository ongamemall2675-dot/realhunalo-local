import json
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class PromptAssembler:
    """
    모듈화된 JSON 프롬프트 조립기 (Modular Prompt Assembler)
    캐릭터(Character), 화풍(Style), 장면(Scene) JSON 데이터를 받아
    이미지/영상 생성 AI에 적합한 최종 프롬프트 문자열로 병합합니다.
    """

    def __init__(self):
        pass

    def assemble_prompt(self, scene_json: Dict[str, Any], style_json: Dict[str, Any] = None, character_json: List[Dict[str, Any]] = None) -> str:
        """
        주어진 JSON 모듈들을 결합하여 최종 영문 프롬프트를 생성합니다.
        
        Args:
            scene_json: 현재 씬의 동작과 배경 정보 (action, background 필수)
            style_json: 화풍 및 카메라 셋업 정보 (선택적)
            character_json: 마스터 캐릭터 JSON 배열 (선택적)
            
        Returns:
            str: 조립된 최종 문자열 (프롬프트 결합체)
        """
        try:
            # 1. Base Style (화풍)
            base_style = style_json.get("base_style", "") if style_json else ""
            camera = style_json.get("camera", "") if style_json else ""
            
            # 2. Scene (장면 - 필수)
            action = scene_json.get("action", "doing something")
            background = scene_json.get("background", "neutral background")
            
            # 3. Character (캐릭터)
            # 마스터 캐릭터가 여러 명일 수 있으므로 배열 처리
            character_desc = ""
            fixed_accessories = ""
            
            if character_json and isinstance(character_json, list):
                for char in character_json:
                    profile = char.get("json_profile", {})
                    # 외형 설명 추출
                    app_desc = profile.get("appearance", {}).get("description", "")
                    if app_desc:
                        character_desc += f"{app_desc}. "
                    
                    # 고정 액세서리 처리
                    accs = profile.get("appearance", {}).get("locked_accessories", [])
                    if accs:
                        fixed_accessories += ", ".join(accs) + ". "

            # 부위별 누락 방지 (Fallback)
            if not base_style:
                base_style = "High quality, clear details"
            if not background or background.strip() == "":
                background = "neutral background, studio lighting"

            # 4. 문자열 결합 (조립)
            # 기본 문법: [Style]. [Character] is [Action] in [Background]. [Accessories], [Camera].
            parts = []
            
            # 문장 시작은 화풍
            if base_style:
                parts.append(base_style)
            
            # 메인 피사체와 동작, 그리고 배경
            main_action = []
            if character_desc:
                main_action.append(f"{character_desc.strip()}")
            main_action.append(f"{action}")
            if background:
                main_action.append(f"in {background}")
                
            parts.append(" ".join(main_action).strip())
            
            # 고정 액세서리와 카메라 설정
            if fixed_accessories:
                parts.append(fixed_accessories.strip())
            if camera:
                parts.append(camera)

            # 불필요한 공백 제거 및 마침표로 연결
            final_prompt = ". ".join(p.strip() for p in parts if p.strip()).replace("..", ".")
            
            logger.info(f"Assembled Prompt: {final_prompt[:100]}...")
            return final_prompt
            
        except Exception as e:
            logger.error(f"Error assembling prompt: {e}")
            # 에러 발생 시 scene_json의 정보라도 살려서 최소한의 프롬프트 반환
            action = scene_json.get("action", "") if scene_json else "error parsing scene"
            bg = scene_json.get("background", "") if scene_json else "studio"
            return f"{action} in {bg}"

    def build_system_prompt_for_llm(self, style_json: Dict = None, character_json: List[Dict] = None) -> str:
        """
        DeepSeek 등 외부 LLM에게 번역 및 문장 구성을 요새화(Fortify)하기 위해
        가드레일용 시스템 프롬프트(JSON 구조)를 생성합니다.
        LLM이 환각을 일으키지 못하도록 방어적인 스트링을 생성합니다.
        """
        instruction = "You are a Master Prompt Engineer. Assemble the final image prompt precisely according to the following strict rules.\n"
        instruction += "NO HALLUCINATIONS. STRICTLY USE THE PROVIDED ATTRIBUTES.\n\n"
        
        if style_json:
            instruction += "== STYLE MODULE ==\n"
            instruction += f"Base Style: {style_json.get('base_style', 'None')}\n"
            instruction += f"Camera: {style_json.get('camera', 'None')}\n"
            instruction += f"Negative Prompt: {style_json.get('negative_prompt', 'None')}\n\n"
            
        if character_json and len(character_json) > 0:
            instruction += "== CHARACTER MODULE (STRICTLY ENFORCE) ==\n"
            for char in character_json:
                instruction += f"- Name: {char.get('name')}\n"
                instruction += f"- Profile: {json.dumps(char.get('json_profile', {}), ensure_ascii=False)}\n"
            instruction += "\n* RULE: You MUST NOT invent new clothes, eye colors, or hair styles that conflict with this Character JSON.\n\n"
            
        return instruction

# 싱글톤 인스턴스
prompt_assembler = PromptAssembler()
