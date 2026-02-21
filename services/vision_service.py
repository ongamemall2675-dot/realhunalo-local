import os
import json
import base64
from typing import Dict, Any, Optional
from openai import OpenAI

class VisionService:
    """Vision AI Service for analyzing images and extracting character JSON profiles."""

    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None
        
    def analyze_character_image(self, base64_image: str) -> Optional[Dict[str, Any]]:
        """
        Analyze a base64 encoded image and return a deterministic JSON profile.
        """
        if not self.client:
            print("[WARN] VisionService: OPENAI_API_KEY가 설정되지 않아 이미지 분석을 사용할 수 없습니다.")
            return None

        # Clean the base64 prefix if present
        if "base64," in base64_image:
            base64_image = base64_image.split("base64,")[1]

        prompt_text = """ROLE & OBJECTIVE
You are JsonPromptMaker, a deterministic Prompt-to-JSON Engine.
Analyze the provided reference image of a character and convert it into a precise, production-ready JSON prompt following the CORE RULES and EXACT JSON SCHEMA detailed below.

CORE RULES
1. Determinism: You must behave deterministically.
2. No Inference: Do not guess or optimize. Extract ONLY what you see in the image.
3. Image Priority: The image is the ground truth.
4. Image Locking: Since we are extracting from an image, you MUST mark relevant physical and identity attributes as `image`.
5. Value Declaration Requirement: Every field must explicitly declare how its value is resolved ("value", "source", or "default_source").
6. Output Discipline: ONLY output valid, pretty-printed JSON.

JSON_PROFILE SCHEMA TO FOLLOW:
{
  "task": "build_image_prompt_json",
  "reference_image_policy": {
    "used": true,
    "represents": "full character identity unless explicitly overridden by text",
    "instructions": [
      "If an attribute allows image as a source and no text value is provided, the attribute must be copied exactly from the reference image",
      "Inference or stylistic guessing is forbidden when image source is available",
      "Never infer or optimize identity attributes"
    ]
  },
  "subject": {
    "type": "human",
    "identity_lock": {
      "face": "image", "age": "image", "skin_tone": "image", "facial_features": "image",
      "body_proportions": "image", "hair_style": "image", "hair_color": "image", "eye_color": "image"
    },
    "pose": { "value": "[Extract pose from image, e.g. standing straight]", "allowed_sources": ["text", "image"] },
    "expression": { "value": "[Extract expression from image, e.g. slight smile]", "allowed_sources": ["text", "image"] },
    "gaze": { "value": "[Extract gaze from image, e.g. facing the camera]", "allowed_sources": ["text", "image"] }
  },
  "appearance": {
    "clothing": { "value": "[Extract clothing details from image]", "allowed_sources": ["text", "image"] },
    "colors": { "primary_palette": { "value": "[Extract main color palette]", "allowed_sources": ["text", "image"] } }
  },
  "environment": {
    "location": { "allowed_sources": ["text", "image"] },
    "details": { "allowed_sources": ["text", "image"] },
    "time_of_day": { "value": "controlled studio setup", "allowed_sources": ["text"] },
    "weather": { "value": "indoor", "allowed_sources": ["text"] }
  },
  "camera": {
    "framing": { "value": "[Extract framing, e.g. medium wide shot]", "allowed_sources": ["text", "image"] },
    "angle": { "value": "[Extract camera angle, e.g. eye-level]", "allowed_sources": ["text", "image"] },
    "lens_feel": { "value": "natural perspective", "allowed_sources": ["text", "image"] }
  },
  "lighting": {
    "type": { "value": "[Extract lighting type from image]", "allowed_sources": ["text", "image"] },
    "direction": { "value": "[Extract light direction]", "allowed_sources": ["text", "image"] },
    "intensity": { "value": "[Extract light intensity]", "allowed_sources": ["text", "image"] }
  },
  "style": {
    "render_type": {
      "source_policy": "text_overrides_image",
      "allowed_sources": ["text", "image"],
      "forbid_value_generation": true
    }
  },
  "quality_controls": {
    "forbidden_changes": [
      "modifying identity attributes sourced from image", "implicit face or hair alteration",
      "beautification or aging", "conflicting multiple values for a single attribute"
    ]
  }
}

OUTPUT REQUIREMENTS:
- Your response MUST be EXACTLY the JSON object above, with the "[Extract ...]" placeholders replaced by accurate, concise descriptions derived from the image.
- DO NOT INCLUDE ANY MARKDOWN BLOCKS LIKE ```json. Just output the raw JSON object.
"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt_text},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                },
                            },
                        ],
                    }
                ],
                max_tokens=2500,
                temperature=0.2
            )
            
            content = response.choices[0].message.content.strip()
            
            # Clean up potential markdown formatting
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            json_data = json.loads(content)
            return json_data
            
        except Exception as e:
            print(f"[ERROR] VisionService: analyze_character_image 실패 - {str(e)}")
            return None

vision_service = VisionService()
