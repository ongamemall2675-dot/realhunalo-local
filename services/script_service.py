"""
Script Service
OpenAI를 사용한 AI 스크립트 생성
"""
import os
import openai
from typing import Dict, Any, List

# 화풍 카테고리 정의 (ImageModule과 동일)
STYLE_CATEGORIES = {
    'stickman': {'name': '스틱맨 (졸라맨)', 'prompt': 'simple stickman style, minimalist stick figure, blue shirt, red tie, clean lines, 2D flat design'},
    'animation': {'name': '애니메이션', 'prompt': 'anime style, animation, cel shaded, vibrant colors'},
    'european_graphic_novel': {'name': '유럽풍 그래픽 노블', 'prompt': 'European graphic novel style, bande dessinée, ligne claire, ink and watercolor'},
    'hand_drawn': {'name': '손그림 스타일', 'prompt': 'hand drawn sketch style, pencil drawing, rough sketch, artistic'},
    'cinematic_photorealistic': {'name': '시네마틱 실사', 'prompt': 'cinematic photorealistic, film photography, dramatic lighting, depth of field'},
    'kdrama_realistic': {'name': 'K-드라마 실사', 'prompt': 'Korean drama style, soft romantic lighting, emotional atmosphere, modern Korean aesthetic'},
    'noir': {'name': '느와르', 'prompt': 'film noir style, high contrast, dramatic shadows, black and white, vintage detective'},
    'webtoon': {'name': '웹툰', 'prompt': 'Korean webtoon style, digital comic, clean lines, vibrant colors, modern illustration'},
    '3d_animation': {'name': '3D 애니메이션', 'prompt': '3D animation style, Pixar style, CGI, smooth rendering, cartoon 3D'},
    'claymation': {'name': '클레이 애니메이션', 'prompt': 'claymation style, stop motion, clay models, tactile texture, handcrafted'},
    'fairy_tale_illustration': {'name': '동화 일러스트', 'prompt': 'fairy tale illustration, storybook art, whimsical, soft colors, children book style'},
    'wool_felt_doll': {'name': '동화 양모인형', 'prompt': 'wool felt doll style, needle felting, soft fuzzy texture, handmade crafts'},
    'diorama': {'name': '디오라마', 'prompt': 'diorama style, miniature scene, tilt-shift photography, tiny detailed model'},
    'emotional_historical_illustration': {'name': '감성 사극 일러스트', 'prompt': 'emotional Korean historical drama illustration, traditional hanbok, soft brush strokes, nostalgic atmosphere'},
    'web_novel_signature': {'name': '웹소설 시그니쳐', 'prompt': 'web novel cover illustration, fantasy romance style, detailed character art, dramatic composition'},
    'oriental_folklore_illustration': {'name': '동양 설화 일러스트', 'prompt': 'oriental folklore illustration, Asian mythology, traditional ink painting elements, mystical atmosphere'},
    'ghibli': {'name': '지브리', 'prompt': 'Studio Ghibli style, Miyazaki inspired, hand painted animation, whimsical nature, nostalgic'},
    'vintage': {'name': '빈티지', 'prompt': 'vintage style, retro aesthetic, aged paper texture, faded colors, nostalgic'},
    'watercolor': {'name': '수채화', 'prompt': 'watercolor painting, soft blending, fluid strokes, gentle colors, artistic'},
    'illustration': {'name': '일러스트', 'prompt': 'digital illustration, modern art style, clean and polished, professional artwork'},
    'flat_vector': {'name': '플랫 벡터', 'prompt': 'flat vector style, minimal design, geometric shapes, solid colors, modern graphic design'},
    'oil_painting': {'name': '유화', 'prompt': 'oil painting style, thick brush strokes, rich texture, classical art, impasto technique'},
    'pencil_drawing': {'name': '연필그림', 'prompt': 'pencil drawing, graphite sketch, detailed shading, realistic pencil art, black and white'},
    'pixel_art': {'name': '픽셀아트', 'prompt': 'pixel art style, 8-bit retro, blocky pixels, video game aesthetic, nostalgic gaming'},
    'low_poly': {'name': '로우폴리', 'prompt': 'low poly 3D style, geometric facets, minimal polygons, modern 3D art, angular shapes'},
    'origami': {'name': '오리가미', 'prompt': 'origami paper craft style, folded paper art, geometric paper sculpture, clean edges'},
    'comic_book': {'name': '만화책', 'prompt': 'comic book style, bold outlines, halftone dots, speech bubbles, superhero aesthetic'},
    'neon_punk': {'name': '네온펑크', 'prompt': 'neon punk style, cyberpunk aesthetic, glowing neon lights, futuristic urban, vibrant electric colors'},
    '3d_model': {'name': '3D 모델', 'prompt': '3D render, photorealistic 3D model, clean rendering, studio lighting, product visualization'},
    'craft_clay': {'name': '공예/점토', 'prompt': 'clay craft style, ceramic pottery, handmade clay sculpture, artisan crafts, tactile texture'}
}

class ScriptService:
    """AI 스크립트 생성 서비스"""

    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            print("[WARN] OPENAI_API_KEY가 설정되지 않았습니다.")
        else:
            openai.api_key = self.api_key
            # OpenAI 클라이언트에 타임아웃 설정 (Cloudflare 100초 제한 고려)
            self.client = openai.OpenAI(api_key=self.api_key, timeout=90.0)
            print("[OK] Script Service 초기화 완료 (timeout: 90s)")

        # Load character anchor configuration
        self.use_fixed_anchor = os.getenv('USE_FIXED_ANCHOR', 'false').lower() == 'true'
        self.fixed_anchor_text = os.getenv('FIXED_ANCHOR', 'Stickman, blue shirt, red tie')
        print(f"[OK] Character Anchor Mode: {'FIXED' if self.use_fixed_anchor else 'DYNAMIC (from script)'}")

    def generate(self, topic: str, style: str = "engaging", image_style: str = "none",
                 model: str = "gpt-4o-mini", temperature: float = 0.7) -> Dict[str, Any]:
        """
        ?????????? ???????? (Segmentation)

        Args:
            topic: ??????? (UI??topic??? ????)
            style: ????? ?? (engaging, formal, casual ??)
            model: ?????OpenAI ???
            temperature: ???????? (0-1)

        Returns:
            ??? ??? ???
        """
        if not self.api_key:
            return {"success": False, "error": "OpenAI API ??? ?????? ????????"}

        content = None
        try:
            print(f"[OK] Segmenting script (len={len(topic)})")

            # 선택된 화풍 정보 가져오기
            style_info = STYLE_CATEGORIES.get(image_style) if image_style and image_style != 'none' else None

            # Style 섹션 내용 결정
            if style_info:
                style_description = style_info['prompt']
                style_name = style_info['name']
                print(f"[OK] Image style applied: {style_name} ({image_style})")
            else:
                style_description = '2D flat vector style, minimal design, 4K, crisp lines'
                print(f"[OK] Using default style (no style selected)")

            # Anchor 섹션 내용 결정
            if self.use_fixed_anchor:
                anchor_instruction = f"(Anchor) {self.fixed_anchor_text},"
                anchor_example = f"{self.fixed_anchor_text}"
                master_char_instruction = f"Use the fixed character: {self.fixed_anchor_text}"
            else:
                anchor_instruction = "(Anchor) [main character identifier extracted from the script - describe their key visual features],"
                anchor_example = "main character identifier from script"
                master_char_instruction = "Extract the main character's appearance details from the script itself. DO NOT use generic descriptions. Use specific details from the script."

            prompt = f"""You are a video script segmenter for senior-friendly YouTube content.

Given the script below, split it into 2-10 scenes. Do NOT invent new content.
Preserve the meaning and wording as much as possible. Each scene should have:
- sceneId (number, starting at 1)
- imagePrompt (visual description using 6-Section GEMS structure - see format below)
- motionPrompt (short camera/animation instruction for converting static image to video)
- originalScript (the exact narration text for that scene)

**IMAGE PROMPT FORMAT (6-Section GEMS Structure):**
Create image prompts in this EXACT format with all 6 sections:
(Style) {style_description},
(Shot) Wide shot, full body, NO CLOSE-UP,
(Subject) [describe character's specific action related to the scene],
(Environment) [describe background, props, and context],
{anchor_instruction}
(Negative) NO 3D, NO realistic photo, NO blurry, --ar 16:9

**Example:**
"(Style) {style_description}, (Shot) Wide shot, full body, (Subject) a character pointing at a rising stock graph with a happy expression, (Environment) clean white office background with a simple desk, (Anchor) {anchor_example}, (Negative) NO 3D, NO realistic photo, NO blurry, --ar 16:9"

**MOTION PROMPT FORMAT:**
Create a short, specific motion instruction (5-15 words) based on the scene content:
- For action scenes: "camera slowly zooms in, character gestures excitedly"
- For explanation scenes: "gentle pan right, character points to diagram"
- For emotional scenes: "slow zoom out, character nods thoughtfully"
- For dramatic scenes: "camera tilts up, dynamic lighting changes"

**MASTER CHARACTER PROMPT (REQUIRED):**
IMPORTANT: You MUST create a master reference image prompt for the main character.
This will be used consistently across all scenes for character consistency.
{master_char_instruction}
Describe the character's appearance in detail (face, body, clothing, style) using the same GEMS structure.

Return JSON ONLY in the following structure:
{{
  "title": "Title inferred from the script or 'Untitled'",
  "masterCharacterPrompt": "(Style) {style_description}, (Shot) Full body portrait shot, (Subject) [detailed character description - describe face features, body type, clothing, accessories], (Environment) neutral white background, (Anchor) {anchor_example}, (Negative) NO 3D, NO realistic photo, NO blurry, --ar 1:1",
  "scenes": [
    {{
      "sceneId": 1,
      "imagePrompt": "(Style) ... (Shot) ... (Subject) ... (Environment) ... (Anchor) ... (Negative) ...",
      "motionPrompt": "camera slowly zooms in, character gestures naturally",
      "originalScript": "Narration text"
    }}
  ]
}}

Script:
{topic}

Style hint (optional): {style}
"""

            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a precise script segmentation assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                max_tokens=4000  # 긴 대본 처리를 위해 증가
            )

            finish_reason = response.choices[0].finish_reason
            content = response.choices[0].message.content
            print(f"[DEBUG] Finish Reason: {finish_reason}")
            print(f"[DEBUG] Raw Content: {content}")

            # Clean up markdown code blocks if present
            if "```json" in content:
                content = content.replace("```json", "").replace("```", "")
            elif "```" in content:
                content = content.replace("```", "")

            content = content.strip()

            # Parse JSON response
            import json
            try:
                script_data = json.loads(content)
            except json.JSONDecodeError as e:
                print(f"[ERROR] JSON extraction failed. Raw content: {content[:100]}...")
                # Attempt to find JSON array or object pattern
                import re
                match = re.search(r'\{.*\}', content, re.DOTALL)
                if match:
                    script_data = json.loads(match.group())
                else:
                    raise e

            # Ensure keys match frontend expectations
            scenes = script_data.get("scenes", [])
            for scene in scenes:
                # Fallback mapping if AI uses old keys
                if 'visualPrompt' in scene and 'imagePrompt' not in scene:
                    scene['imagePrompt'] = scene['visualPrompt']
                if 'script' in scene and 'originalScript' not in scene:
                    scene['originalScript'] = scene['script']

                # Ensure numeric ID
                if 'sceneId' in scene:
                    try:
                        scene['sceneId'] = int(scene['sceneId'])
                    except:
                        pass

            # 마스터 캐릭터 프롬프트 추출
            master_character_prompt = script_data.get("masterCharacterPrompt", "")
            if master_character_prompt:
                print(f"[OK] Master character prompt generated: {master_character_prompt[:100]}...")

            return {
                "success": True,
                "title": script_data.get("title", topic),
                "masterCharacterPrompt": master_character_prompt,
                "scenes": scenes,
                "model": model
            }

        except Exception as e:
            print(f"[X] Script generation error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e),
                "raw_content": locals().get('content', 'No content captured')
            }

    def regenerate_prompts_with_style(self, scenes: List[Dict], new_style: str) -> Dict[str, Any]:
        """
        기존 씬들의 이미지 프롬프트를 새로운 스타일로 재생성
        originalScript는 유지하고 imagePrompt만 새로운 스타일로 재생성

        Args:
            scenes: 기존 씬 리스트
            new_style: 새로운 화풍 ID (e.g., 'watercolor', 'animation')

        Returns:
            업데이트된 씬 리스트
        """
        if not self.api_key:
            return {"success": False, "error": "OpenAI API 키가 설정되지 않았습니다"}

        try:
            print(f"[OK] Regenerating image prompts with new style: {new_style}")

            # Style 섹션 내용 결정
            style_info = STYLE_CATEGORIES.get(new_style) if new_style and new_style != 'none' else None

            if style_info:
                style_description = style_info['prompt']
                style_name = style_info['name']
                print(f"[OK] New style: {style_name} ({new_style})")
            else:
                style_description = '2D flat vector style, minimal design, 4K, crisp lines'
                print(f"[OK] Using default style")

            # Anchor 섹션 내용 결정
            if self.use_fixed_anchor:
                anchor_instruction = f"(Anchor) {self.fixed_anchor_text},"
            else:
                anchor_instruction = "(Anchor) [character identifier from original script],"

            # AI에게 각 씬의 originalScript를 기반으로 새로운 imagePrompt 생성 요청
            updated_scenes = []
            for scene in scenes:
                original_script = scene.get('originalScript', '')
                scene_id = scene.get('sceneId', 0)

                if not original_script:
                    # originalScript가 없으면 기존 프롬프트 유지
                    updated_scenes.append(scene)
                    continue

                prompt = f"""You are an image prompt generator for video scenes.

Given the scene narration below, create a NEW image prompt using the 6-Section GEMS structure with the NEW STYLE specified.

**NEW STYLE**: {style_description}

**ORIGINAL NARRATION**: {original_script}

**6-Section GEMS Structure**:
(Style) {style_description},
(Shot) Wide shot, full body, NO CLOSE-UP,
(Subject) [describe character's specific action related to the scene],
(Environment) [describe background, props, and context],
{anchor_instruction}
(Negative) NO 3D, NO realistic photo, NO blurry, --ar 16:9

Return ONLY the image prompt in the exact GEMS format above. Do NOT include explanations or additional text.
"""

                response = self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "You are a precise image prompt generator."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=500
                )

                new_image_prompt = response.choices[0].message.content.strip()

                # Clean up any markdown formatting
                new_image_prompt = new_image_prompt.replace('```', '').strip()

                # Update scene with new imagePrompt but keep all other fields
                updated_scene = scene.copy()
                updated_scene['imagePrompt'] = new_image_prompt
                updated_scenes.append(updated_scene)

                print(f"[OK] Scene {scene_id}: Updated imagePrompt")

            return {
                "success": True,
                "scenes": updated_scenes,
                "appliedStyle": new_style
            }

        except Exception as e:
            print(f"[X] Style regeneration error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }

# 싱글톤 인스턴스
script_service = ScriptService()
