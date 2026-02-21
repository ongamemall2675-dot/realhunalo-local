"""
Script Service
OpenAI를 사용한 AI 스크립트 생성
"""
import os
import openai
from typing import Dict, Any, List

# 화풍 카테고리 정의 (ImageModule과 동일)
STYLE_CATEGORIES = {
    # ⭐ Nano Banana 템플릿 (AI가 영문 프롬프트 자동 생성)
    'stickman': {
        'name': '졸라맨 (Stickman)',
        'prompt': '2D flat vector style, minimal design, 4K'
    },
    'realistic': {
        'name': '극실사 시네마틱',
        'prompt': 'cinematic photorealistic, 8k, dramatic lighting'
    },
    'ghibli': {
        'name': '지브리/수채화 애니',
        'prompt': 'Studio Ghibli style, watercolor, soft'
    },
    'cyberpunk': {
        'name': '사이버펑크/네온',
        'prompt': 'cyberpunk, neon lights, futuristic'
    },
    # 기존 스타일들
    'animation': {
        'name': '애니메이션',
        'prompt': 'vibrant anime style, cel shaded, high-quality animation frames, expressive facial features, dynamic composition, bright saturated colors, sharp linework'
    },
    'european_graphic_novel': {
        'name': '유럽풍 그래픽 노블',
        'prompt': 'European graphic novel style, bande dessinée, ligne claire, sophisticated ink and watercolor, detailed backgrounds, artistic storytelling, matte finish'
    },
    'hand_drawn': {
        'name': '손그림 스타일',
        'prompt': 'hand drawn sketch style, artistic pencil drawing, rough charcoal strokes, graphite texture, creative hatching, paper tooth visible, expressive lines'
    },
    'cinematic_photorealistic': {
        'name': '시네마틱 실사',
        'prompt': 'cinematic photorealistic, 8k resolution, film photography, dramatic lighting, sharp focus, professional color grading, anamorphic lens flare, depth of field'
    },
    'kdrama_realistic': {
        'name': 'K-드라마 실사',
        'prompt': 'Korean drama style, soft romantic lighting, emotional atmosphere, modern Korean aesthetic, clean skin tones, high-end production quality, serene urban background'
    },
    'noir': {
        'name': '느와르',
        'prompt': 'film noir style, high contrast, dramatic chiaroscuro shadows, black and white, vintage detective aesthetic, rainy urban streets, smoke and fog, mysterious mood'
    },
    'webtoon': {
        'name': '웹툰',
        'prompt': 'Korean webtoon style, digital comic illustration, clean vibrant lines, modern manhwa aesthetic, cell shading, trendy character design'
    },
    '3d_animation': {
        'name': '3D 애니메이션',
        'prompt': '3D animation style, Pixar/Disney inspired, high-quality CGI, smooth clay-like rendering, expressive characters, vibrant studio lighting, subsurface scattering'
    },
    'claymation': {
        'name': '클레이 애니메이션',
        'prompt': 'claymation style, stop motion aesthetic, handcrafted clay models, fingerprints texture, tactile material, studio mini-lighting, Aardman inspired'
    },
    'fairy_tale_illustration': {
        'name': '동화 일러스트',
        'prompt': 'fairy tale illustration, storybook art style, whimsical, soft pastel colors, children\'s book aesthetic, magical atmosphere, golden hour lighting'
    },
    'wool_felt_doll': {
        'name': '동화 양모인형',
        'prompt': 'wool felt doll style, needle felting, soft fuzzy texture, handmade crafts, macro photography, warm cozy lighting, tactile fiber details, cute plushy look'
    },
    'diorama': {
        'name': '디오라마',
        'prompt': 'diorama style, miniature scene, tilt-shift photography, tiny detailed models, scale model aesthetic, fake plastic texture, overhead perspective'
    },
    'emotional_historical_illustration': {
        'name': '감성 사극 일러스트',
        'prompt': 'emotional Korean historical illustration, traditional hanbok, soft brush strokes, nostalgic watercolor wash, serene ancient architecture, poetic oriental atmosphere'
    },
    'web_novel_signature': {
        'name': '웹소설 시그니쳐',
        'prompt': 'web novel cover illustration, high-fantasy romance style, detailed character art, dramatic lighting, magical particle effects, epic composition, glowing eyes'
    },
    'oriental_folklore_illustration': {
        'name': '동양 설화 일러스트',
        'prompt': 'oriental folklore illustration, Asian mythology, traditional ink and wash, mystical spirit energy, stylized clouds and waves, golden gold-leaf accents'
    },
    'ghibli': {
        'name': '지브리',
        'prompt': 'Studio Ghibli style, Miyazaki inspired, hand-painted background, whimsical nature, lush greenery, nostalgic childhood atmosphere, soft natural lighting'
    },
    'vintage': {
        'name': '빈티지',
        'prompt': 'vintage retro style, aged paper texture, faded nostalgic colors, 1960s aesthetic, halftone dots, distressed edges, old magazine print look'
    },
    'watercolor': {
        'name': '수채화',
        'prompt': 'watercolor painting, soft wet-on-wet blending, fluid brush strokes, gentle bleeding colors, artistic paper texture, airy and light atmosphere'
    },
    'illustration': {
        'name': '일러스트',
        'prompt': 'modern digital illustration, clean and polished art, professional vector-like rendering, trendy color palette, sharp edges, balanced composition'
    },
    'flat_vector': {
        'name': '플랫 벡터',
        'prompt': 'flat vector style, minimal graphic design, geometric shapes, solid bold colors, 2D corporate aesthetic, clean infographic look'
    },
    'oil_painting': {
        'name': '유화',
        'prompt': 'classical oil painting, thick impasto brush strokes, rich oil texture, heavy lighting, museum quality, canvas texture, Rembrandt inspired'
    },
    'pencil_drawing': {
        'name': '연필그림',
        'prompt': 'pencil drawing, graphite sketch, detailed cross-hatching, realistic shading, hand-drawn charcoal texture, monochromatic, paper grain'
    },
    'pixel_art': {
        'name': '픽셀아트',
        'prompt': 'pixel art style, 8-bit retro video game aesthetic, blocky pixels, vibrant limited palette, nostalgic gaming vibe, pixelated sprites'
    },
    'low_poly': {
        'name': '로우폴리',
        'prompt': 'low poly 3D style, geometric facets, minimal polygons, modern 3D art, angular shapes, flat shaded faces, stylized abstract look'
    },
    'origami': {
        'name': '오리가미',
        'prompt': 'origami paper craft style, folded paper art, geometric paper sculpture, sharp creases, clean paper texture, soft studio lighting'
    },
    'comic_book': {
        'name': '만화책',
        'prompt': 'classic comic book style, bold black outlines, halftone Ben-Day dots, high action contrast, pop art aesthetic, superhero comic vibe'
    },
    'neon_punk': {
        'name': '네온펑크',
        'prompt': 'neon punk style, cyberpunk aesthetic, glowing neon lights, futuristic urban night, vibrant electric colors, rain-slicked streets, high tech vibe'
    },
    '3d_model': {
        'name': '3D 모델',
        'prompt': 'photorealistic 3D render, studio lighting, clean product visualization, octane render, smooth surfaces, high detail materials, professional 3D output'
    },
    'craft_clay': {
        'name': '공예/점토',
        'prompt': 'clay craft style, ceramic pottery texture, handmade clay sculpture, artisan pottery, tactile clay material, earthy tones, natural organic shapes'
    }
}

# 나노 바나나 프롬프트 템플릿 시스템
# [Base Action] + [Detail + Style Constants] + [Parameters]
NANO_BANANA_TEMPLATES = {
    "stickman": {
        "name": "부동산 전문가 스틱맨 (Professional Agent)",
        "description": "부동산 정보 분석 및 전달용 - 신뢰감 있는 전문가 스타일",
        "constants": ", professional stickman character, veteran real estate analyst, spherical white head with no face, wearing sharp reflective glasses, dark charcoal grey suit, white button-up shirt, blue tie, white hands, holding a long thin black pointer stick with a red tip, carrying a worn brown leather briefcase marked 'DATA & FACT', clean bold line art, simple cel-shading, technical blueprint atmosphere, professional and analytical vibe",
        "params": " --ar 16:9 --v 6.0"
    },
    "realistic": {
        "name": "극실사 시네마틱",
        "description": "부동산, 경제, 정보 전달용 - 신뢰감과 전문성",
        "constants": ", extreme detail, 8k resolution, cinematic lighting, sharp focus, 35mm lens, f/1.8, photorealistic, shot on Sony A7R IV, realistic skin texture, volumetric lighting, masterpiece quality, professional photography",
        "params": " --ar 16:9 --v 6.0 --style raw"
    },
    "ghibli": {
        "name": "지브리/수채화 애니",
        "description": "감성, 에세이, 동화용 - 따뜻한 무드",
        "constants": ", soft focus, delicate brushstrokes, watercolor texture, pastel color palette, warm sunlight filtering through, Studio Ghibli inspired, hand-painted background, Makoto Shinkai lighting, nostalgic mood, whimsical nature",
        "params": " --ar 16:9 --niji 6"
    },
    "cyberpunk": {
        "name": "사이버펑크/네온",
        "description": "테크, 미래, 암호화폐 테마용 - 강렬한 대비",
        "constants": ", vibrant neon lights, high contrast, rainy night reflections, ultra-detailed city background, synthwave aesthetic, Cyberpunk 2077 art style, digital art, intense electric blue and pink color grade, futuristic urban environment",
        "params": " --ar 16:9 --v 6.0 --stylize 500"
    }
}

class ScriptService:
    """AI 스크립트 생성 서비스"""

    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        self.deepseek_key = os.getenv('DEEPSEEK_API_KEY')
        
        # 클라이언트 초기화 로직 통합 및 개선
        self.openai_client = None
        self.deepseek_client = None
        self.primary_client = None
        
        # 1. DeepSeek 우선 (기본)
        if self.deepseek_key:
            self.deepseek_client = openai.OpenAI(
                api_key=self.deepseek_key,
                base_url="https://api.deepseek.com",
                timeout=600.0  # 타임아웃 대폭 연장 (10분)
            )
            self.primary_client = self.deepseek_client
            print("[OK] DeepSeek Client 초기화 완료 (Primary, timeout: 60s)")
        else:
            print("[WARN] DEEPSEEK_API_KEY가 설정되지 않았습니다.")
            
        # 2. OpenAI (백업)
        if self.api_key:
            self.openai_client = openai.OpenAI(api_key=self.api_key, timeout=600.0)
            print("[OK] OpenAI Client 초기화 완료 (Backup, timeout: 30s)")
        else:
            print("[WARN] OPENAI_API_KEY가 설정되지 않았습니다.")

        # 기본 클라이언트가 없으면 OpenAI 클라이언트 사용
        if not self.primary_client and self.openai_client:
            self.primary_client = self.openai_client
            print("[OK] OpenAI를 기본 클라이언트로 설정")

        if not self.primary_client:
            print("[WARN] 사용 가능한 AI 클라이언트가 없습니다.")
        else:
            print("[OK] Script Service 초기화 완료 (Primary Client: " + 
                  ("DeepSeek" if self.primary_client == self.deepseek_client else "OpenAI") + ")")

        # Load character anchor configuration
        self.use_fixed_anchor = os.getenv('USE_FIXED_ANCHOR', 'false').lower() == 'true'
        self.fixed_anchor_text = os.getenv('FIXED_ANCHOR', 'Stickman, blue shirt, red tie')
        print(f"[OK] Character Anchor Mode: {'FIXED' if self.use_fixed_anchor else 'DYNAMIC (from script)'}")

        # Load Camera Motion Guide (relative to this file)
        self.camera_motion_guide = ""
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            guide_path = os.path.join(current_dir, '..', '카메라 모션.txt')
            if os.path.exists(guide_path):
                with open(guide_path, 'r', encoding='utf-8') as f:
                    self.camera_motion_guide = f.read()
                print(f"[OK] Camera Motion Guide loaded ({len(self.camera_motion_guide)} chars)")
            else:
                print(f"[WARN] Camera Motion Guide not found at {guide_path}")
        except Exception as e:
            print(f"[WARN] Failed to load Camera Motion Guide: {e}")

    def generate(self, topic: str, style: str = "engaging", image_style: str = "none",
                 model: str = "deepseek-chat", temperature: float = 0.7) -> Dict[str, Any]:
        """
        스크립트 생성 및 세분화 (Segmentation)
        """
        if not self.api_key:
            return {"success": False, "error": "OpenAI API 키가 설정되지 않았습니다"}

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
                # Default to Professional Real Estate Stickman
                default_style_key = 'stickman'
                style_description = STYLE_CATEGORIES[default_style_key]['prompt']
                print(f"[OK] Using default style: {STYLE_CATEGORIES[default_style_key]['name']}")

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

Given the script below, reformat it into a structured JSON for video production.
**CRITICAL RULE: User Line Breaks (\n) Determine Scene Boundaries.**
- The input script has likely been pre-segmented for optimal pacing (approx. 50 chars).
- **RESPECT THESE LINE BREAKS** as absolute scene boundaries.
- Do NOT merge lines. Do NOT re-segment unless a line is absurdly long (>100 chars).
- Treat each line (or double-spaced block) as a separate scene.
- These line breaks will directly determine the audio segments and subtitles.

**IMAGE PROMPT FORMAT (6-Section GEMS Structure):**
Create image prompts in this EXACT format:
(Style) {style_description},
(Shot) Wide shot, full body, NO CLOSE-UP,
(Subject) [describe character's action],
(Environment) [describe background/props],
{anchor_instruction}
(Negative) NO 3D, NO realistic photo, NO blurry, --ar 16:9

**MOTION PROMPT (Natural Description):**
A single fluid sentence (15-25 words) describing character action, emotion, and environmental movement.

**MASTER CHARACTER PROMPT:**
{master_char_instruction}

Return JSON ONLY:
{{
  "title": "Title",
  "masterCharacterPrompt": "...",
  "scenes": [
    {{
      "sceneId": 1,
      "imagePrompt": "...",
      "motionPrompt": "...",
      "originalScript": "First line of narration." 
    }}
  ]
}}
* Note: 'originalScript' MUST match the user's line exactly.

Script:
{topic}

Style hint: {style}
"""

            # 모델에 따른 클라이언트 선택 (개선된 로직)
            target_client = self.primary_client  # 기본 클라이언트
            if "deepseek" in model.lower():
                if not self.deepseek_client:
                    return {"success": False, "error": "DeepSeek API 키가 설정되지 않았습니다"}
                target_client = self.deepseek_client
            elif not self.openai_client:
                return {"success": False, "error": "OpenAI API 키가 설정되지 않았습니다"}
            else:
                target_client = self.openai_client

            response = target_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a precise script segmentation assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                max_tokens=4000
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

            import json
            try:
                script_data = json.loads(content)
            except json.JSONDecodeError as e:
                print(f"[ERROR] JSON extraction failed. Raw content: {content[:100]}...")
                import re
                match = re.search(r'\{.*\}', content, re.DOTALL)
                if match:
                    script_data = json.loads(match.group())
                else:
                    raise e
            
            scenes = script_data.get("scenes", [])
            for scene in scenes:
                if 'visualPrompt' in scene and 'imagePrompt' not in scene:
                    scene['imagePrompt'] = scene['visualPrompt']
                if 'script' in scene and 'originalScript' not in scene:
                    scene['originalScript'] = scene['script']
                
                if 'sceneId' in scene:
                    try:
                        scene['sceneId'] = int(scene['sceneId'])
                    except:
                        pass
            
            master_character_prompt = script_data.get("masterCharacterPrompt", "")
            if master_character_prompt:
                print(f"[OK] Master character prompt generated: {master_character_prompt[:100]}...")

            # Join all scene scripts to reconstruct the full script with double line breaks for pacing
            full_script = "\n\n".join(
                [s.get('originalScript', '') for s in scenes if s.get('originalScript')]
            )

            return {
                "success": True,
                "title": script_data.get("title", topic),
                "originalScript": full_script,  # Added for Logic 3.0 consistency
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
        """
        if not self.api_key:
            return {"success": False, "error": "OpenAI API 키가 설정되지 않았습니다"}

        try:
            print(f"[OK] Regenerating image prompts with new style: {new_style}")

            style_info = STYLE_CATEGORIES.get(new_style) if new_style and new_style != 'none' else None

            if style_info:
                style_description = style_info['prompt']
                style_name = style_info['name']
                print(f"[OK] New style: {style_name} ({new_style})")
            else:
                default_style_key = 'stickman'
                style_description = STYLE_CATEGORIES[default_style_key]['prompt']
                print(f"[OK] Using default style: {STYLE_CATEGORIES[default_style_key]['name']}")

            if self.use_fixed_anchor:
                anchor_instruction = f"(Anchor) {self.fixed_anchor_text},"
            else:
                anchor_instruction = "(Anchor) [character identifier from original script],"

            updated_scenes = []
            for scene in scenes:
                original_script = scene.get('originalScript', '')
                scene_id = scene.get('sceneId', 0)

                if not original_script:
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

                # DeepSeek을 기본 모델로 사용 (재선택 로직)
                model = "deepseek-chat"
                target_client = self.deepseek_client if self.deepseek_client else self.client
                
                if not target_client:
                    updated_scenes.append(scene)
                    continue

                response = target_client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "You are a precise image prompt generator."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=500
                )

                new_image_prompt = response.choices[0].message.content.strip()
                new_image_prompt = new_image_prompt.replace('```', '').strip()

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

    def generate_image_prompts_from_transcripts(
        self,
        transcripts: List[Dict[str, Any]],
        image_style: str = "none"
    ) -> Dict[str, Any]:
        """
        Whisper 전사 결과에서 이미지 프롬프트 배치 생성
        """
        # DeepSeek을 기본 모델로 사용
        model = "deepseek-chat"
        if not self.api_key:
            return {"success": False, "error": "OpenAI API 키가 설정되지 않았습니다"}
        
        try:
            print(f"[OK] 배치 이미지 프롬프트 생성 시작 ({len(transcripts)}개 씬)")
            
            use_nano_banana = image_style in NANO_BANANA_TEMPLATES

            if use_nano_banana:
                template = NANO_BANANA_TEMPLATES[image_style]
                style_name = template['name']
                style_constants = template['constants']
                style_params = template['params']
                print(f"[OK] 나노 바나나 템플릿: {style_name} ({image_style})")
                print(f"    {template['description']}")
            else:
                style_info = STYLE_CATEGORIES.get(image_style) if image_style and image_style != 'none' else None

                if style_info:
                    style_description = style_info['prompt']
                    style_name = style_info['name']
                    print(f"[OK] Image style: {style_name} ({image_style})")
                else:
                    default_style_key = 'stickman'
                    if default_style_key in NANO_BANANA_TEMPLATES:
                         # Fallback to Nano Banana Stickman
                         use_nano_banana = True
                         template = NANO_BANANA_TEMPLATES[default_style_key]
                         style_name = template['name']
                         style_constants = template['constants']
                         style_params = template['params']
                         image_style = default_style_key # Set explicitly to avoid issues
                         print(f"[OK] Using default style (Nano Banana): {style_name}")
                    else:
                         style_description = STYLE_CATEGORIES[default_style_key]['prompt']
                         print(f"[OK] Using default style: {STYLE_CATEGORIES[default_style_key]['name']}")

            prompts = []
            for transcript in transcripts:
                scene_index = transcript.get('index', 0)
                scene_text = transcript.get('text', '')

                if not scene_text:
                    print(f"  ⚠️ Scene {scene_index}: 텍스트 없음, 스킵")
                    continue

                if use_nano_banana:
                    prompt = f"""You are an image prompt generator using the Nano Banana format.

**NARRATION**: {scene_text}
**STYLE**: {style_name}

Create a single-line image prompt following this exact format:

[Base Scene Description]{style_constants}{style_params}

Instructions:
1. [Base Scene Description]: Describe the COMPLETE scene with background context in 15-20 words
   - Include CHARACTER action (what they're doing, their emotion)
   - Include BACKGROUND/ENVIRONMENT (location, time of day, atmosphere, props)
   - Example: "A character sitting at a desk in a small office, late evening, warm desk lamp lighting, financial documents scattered"
2. Translate Korean narration into English visual description
3. For "{image_style}" style, emphasize appropriate visual characteristics
4. IMPORTANT: Focus on the SETTING and ATMOSPHERE, not just the character action
5. Extract context clues from narration:
   - Is it indoors/outdoors?
   - What time is it (day/night/morning)?
   - What's the mood (busy/quiet/tense/cheerful)?
   - What objects/props are relevant?
6. Keep all style constants and parameters exactly as shown
7. Return ONLY the complete prompt. NO explanations, NO extra text, NO line breaks.

Example format: "A stick figure character analyzing documents at a cluttered office desk, late night, fluorescent ceiling lights, coffee mug nearby{style_constants}{style_params}"
"""

                    system_message = f"You are a Nano Banana prompt generator specialized in {style_name} style for consistent video frame generation."
                else:
                    prompt = f"""You are an image prompt generator using the Nano Banana format for video consistency.

**NARRATION**: {scene_text}
**STYLE**: {style_description}

Create a single-line image prompt following this exact format:

[Base Scene Description], highly detailed, cinematic lighting, 8k resolution, sharp focus, professional photography, {style_description}, 35mm lens, f/1.8, masterpiece quality, consistent character design, NO blurry, NO low quality, NO distortion, --ar 16:9

Instructions:
1. [Base Scene Description]: Describe the COMPLETE scene in 15-20 words including:
   - Character action and emotion
   - Background environment (location, time, atmosphere)
   - Key props or objects in the scene
   Example: "A person reviewing documents at a wooden desk in a cozy home office, warm evening light through window, bookshelves in background"
2. Extract contextual details from the narration to build a rich visual scene
3. Focus on creating an immersive environment, not just the character
4. Keep all fixed quality keywords (highly detailed, 8k, etc.) exactly as shown
5. Return ONLY the complete prompt. NO explanations or extra text.
"""
                    system_message = "You are a Nano Banana prompt generator for consistent video frame generation."

                # 모델에 따른 클라이언트 선택
                target_client = self.deepseek_client if "deepseek" in model.lower() and self.deepseek_client else self.client
                
                if not target_client:
                    print(f"  ⚠️ Scene {scene_index}: AI 클라이언트 없음, 스킵")
                    continue

                response = target_client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.6,
                    max_tokens=250
                )

                image_prompt = response.choices[0].message.content.strip()
                image_prompt = image_prompt.replace('```', '').strip()

                prompts.append({
                    "sceneId": scene_index,
                    "imagePrompt": image_prompt
                })

                print(f"  ✓ Scene {scene_index}: 나노 바나나 프롬프트 생성 완료 (len={len(image_prompt)})")
            
            if len(prompts) != len(transcripts):
                 print(f"[WARN] Input count ({len(transcripts)}) != Output count ({len(prompts)})")
            else:
                 print(f"[OK] 배치 이미지 프롬프트 생성 완료 ({len(prompts)}개) - 1:1 매핑 확인됨")
            
            return {
                "success": True,
                "prompts": prompts,
                "appliedStyle": image_style
            }
        
        except Exception as e:
            print(f"[X] 배치 프롬프트 생성 에러: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }

    def generate_motion_prompts_from_scenes(
        self,
        scenes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        여러 씬의 모션 프롬프트를 AI로 배치 생성
        """
        # DeepSeek을 기본 모델로 사용
        model = "deepseek-chat"
        if not self.api_key:
            return {"success": False, "error": "OpenAI API 키가 없습니다."}

        try:
            import json

            print(f"[OK] 배치 모션 프롬프트 생성 시작 ({len(scenes)}개 씬)")

            prompts = []

            for scene in scenes:
                scene_id = scene.get("sceneId", 0)
                original_script = scene.get("originalScript", "")
                image_prompt = scene.get("imagePrompt", "")

                if not original_script:
                    print(f"  ⚠️ Scene {scene_id}: 대본 없음, 스킵")
                    continue

                # guide_reference removed as per user request for VEO3/GROK natural style
                
                prompt = f"""You are a creative director for high-end AI video models like VEO3 and Grok.
Given a scene with narration and image description, create a **descriptive motion prompt** in fluent English.

**NARRATION**: {original_script}
**IMAGE**: {image_prompt}

**INSTRUCTIONS**:
Create a SINGLE fluid sentence (15-25 words) that describes the movement.
**Strictly follow this priority order:**
1. **PRIORITY 1 (MAIN): CHARACTER ACTION & EMOTION**
   - What are they doing precisely? (e.g., slamming a desk, wiping tears, adjusting glasses, laughing uncontrollably)
   - How do they feel? (e.g., trembling with anger, beaming with joy)

2. **PRIORITY 2 (CONTEXT): ENVIRONMENTAL MOVEMENT & BACKGROUND**
   - What is moving around them? (e.g., wind blowing hair, curtain swaying, rain falling, busy street behind)
   - Lighting changes? (e.g., shadows lengthening, lights flickering)

3. **PRIORITY 3 (SUPPORT): CAMERA MOVEMENT**
   - Use natural language, NOT technical jargon.
   - Bad: "Dolly In" / Good: "The camera slowly moves closer"
   - Bad: "Truck Left" / Good: "Following the character as they walk"

**OUTPUT FORMAT:**
- Return ONLY the descriptive sentence.
- NO labels like "Action:", "Camera:". Just the sentence.

**Examples:**
- "The character slumps into the chair with a heavy sigh, dust floating in the light beams, as the camera slowly drifts closer to capture their defeat."
- "Wind blows the character's hair as they gaze at the horizon, the sun setting behind them, with a gentle handheld camera movement."
- "The character furiously types on the keyboard, screens flickering with data, the camera circling them to build tension."
"""

                # 모델에 따른 클라이언트 선택
                target_client = self.deepseek_client if "deepseek" in model.lower() and self.deepseek_client else self.client

                if not target_client:
                    print(f"  ⚠️ Scene {scene_id}: AI 클라이언트 없음, 스킵")
                    continue

                response = target_client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "You are a motion prompt expert."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=100
                )

                motion_prompt = response.choices[0].message.content.strip()
                motion_prompt = motion_prompt.replace('```', '').replace('"', '').strip()

                prompts.append({
                    "sceneId": scene_id,
                    "motionPrompt": motion_prompt
                })

                print(f"  ✓ Scene {scene_id}: {motion_prompt}")

            print(f"[OK] 배치 모션 프롬프트 생성 완료 ({len(prompts)}개)")

            return {
                "success": True,
                "prompts": prompts
            }

        except Exception as e:
            print(f"[X] Motion prompts generation failed: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    def _force_split_long_sentence(self, text: str, max_chars: int = 50) -> List[str]:
        """
        백엔드 안전장치: 50자가 넘는 단일 문장을 공백이나 콤마 단위로 강제 분절합니다.
        (이미 문장 단위로 들어온 것을 전제로 글자 수만 맞춤)
        """
        if len(text) <= max_chars:
            return [text]

        # 콤마(,) 기준으로 분절 시도
        parts = text.split(',')
        result = []
        current = ""
        
        for part in parts:
            part = part.strip()
            if not part: continue
            
            # 콤마 복원 (마지막 파트 제외)
            to_add = part + ("," if part != parts[-1].strip() else "")
            
            if len(current) + len(to_add) + 1 <= max_chars:
                current = f"{current} {to_add}".strip()
            else:
                if current: result.append(current)
                
                # 그래도 50자가 넘으면 공백 기준 강제 분할
                if len(to_add) > max_chars:
                    words = to_add.split(' ')
                    temp = ""
                    for word in words:
                        if len(temp) + len(word) + 1 <= max_chars:
                            temp = f"{temp} {word}".strip()
                        else:
                            if temp: result.append(temp)
                            temp = word
                    current = temp
                else:
                    current = to_add
                    
        if current: result.append(current)
        return result

    def segment_text(self, text: str, model: str = "deepseek-reasoner") -> Dict[str, Any]:
        """
        사용자가 입력한 대본을 의미 단위(장면 단위)로 분석하여 줄바꿈(\n)을 삽입합니다.
        Logic 3.1: 장면 안정성 강화 (한 문장 = 한 장면 원칙)
        """
        # 클라이언트 선택 로직 개선
        if "deepseek" in model.lower():
            if not self.deepseek_client:
                return {"success": False, "error": "DeepSeek API 키가 설정되지 않았습니다"}
            target_client = self.deepseek_client
        else:
            if not self.openai_client:
                return {"success": False, "error": "OpenAI API 키가 설정되지 않았습니다"}
            target_client = self.openai_client

        try:
            # AI에게 '한 문장 = 한 줄' 원칙을 더 강력하게 주입
            prompt = f"""너는 대한민국 최고의 유튜브 대본 편집 전문가야.
시니어 시청자들을 위해 대본을 **장면 단위(한 줄에 한 문장)**로 쪼개는 작업을 수행한다.

**[핵심 원칙 - 반드시 준수]**:
1. **한 문장 한 줄 (One Sentence Per Line)**:
   - 원칙적으로 **하나의 문장(마침표, 물음표 기준)은 하나의 장면(한 줄)**으로 구성한다.
   - 단, 문장이 너무 길어 **50자(공백 포함)**를 초과할 경우에만 문장 중간이라도 엔터를 쳐서 나눈다.
   - 짧은 문장 여러 개를 한 줄로 합치지 마라! (가독성 하락 원인)

2. **50자 절대 상한선 (Hard Limit: 50 Chars)**:
   - 어떤 경우에도 한 줄의 길이는 50자를 넘을 수 없다. 
   - 45자 내외에서 의미가 통하는 가장 적절한 지점에 줄바꿈을 넣어라.

3. **이중 줄바꿈 필수**:
   - 각 장면(한 줄) 사이에는 반드시 **빈 줄(Double Newline, \\n\\n)**을 넣어라.

4. **텍스트 무결성**: 단 한 글자도, 문장부호 하나도 수정하거나 삭제하지 마라. 오직 '엔터'만 추가한다.

대본:
{text}
"""

            print(f"[DEBUG] Segmenting text (One Sentence Per Line Mode)...")
            response = target_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a professional script editor. Rule: One sentence per line. Max 50 chars per line. Output raw text only with double newlines."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=4000
            )

            content = response.choices[0].message.content.strip()
            
            # [Logic 3.1] Robust Cleanup (Markdown + Thought Process)
            # DeepSeek Reasoner 등의 생각 과정(thought) 태그 제거
            if "<thought>" in content and "</thought>" in content:
                import re
                content = re.sub(r'<thought>.*?</thought>', '', content, flags=re.DOTALL).strip()

            if "```" in content:
                import re
                match = re.search(r'```(?:text|plain|markdown|json)?\s*(.*?)\s*```', content, re.DOTALL)
                if match:
                    content = match.group(1).strip()
                else:
                    content = content.replace("```text", "").replace("```json", "").replace("```", "").strip()

            # [Backend Safety Check]
            # 1. 일단 AI가 넘긴 모든 라인을 수집
            raw_lines = [l.strip() for l in content.split('\n') if l.strip()]
            final_lines = []
            
            print(f"[DEBUG] Validating line lengths...")
            for idx, line in enumerate(raw_lines):
                length = len(line)
                if length > 50:
                    print(f"  ⚠️ Line {idx+1} EXCEEDS 50 ({length} chars): '{line[:20]}...' -> Forcing split")
                    splitted = self._force_split_long_sentence(line, 50)
                    final_lines.extend(splitted)
                else:
                    # AI가 합친 문장이 있는지 체크 (마침표가 중간에 있는 경우 강제 분리 권장하지만, 
                    # 여기서는 글자 수 중심이므로 50자 이내면 일단 허용하거나 더 쪼갤 수 있음)
                    # 여기서는 사용자의 "50자 넘기고 있다"는 불만을 해결하기 위해 글자 수 체크에 집중
                    final_lines.append(line)
                    print(f"  ✓ Line {idx+1} OK ({length} chars)")
            
            segmented_script = "\n\n".join(final_lines)
            
            return {
                "success": True,
                "originalScript": segmented_script,
                "model": model
            }

        except Exception as e:
            print(f"[X] Text segmentation error: {e}")
            return {"success": False, "error": str(e)}

# 싱글톤 인스턴스
script_service = ScriptService()
