"""
Shorts Service
AI 기반 Shorts 후보 분석 및 추천
"""
import os
import openai
import json
from typing import Dict, List, Any

class ShortsService:
    """YouTube Shorts 추천 서비스"""

    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            print("[WARN] OPENAI_API_KEY가 설정되지 않았습니다.")
        else:
            openai.api_key = self.api_key
            # OpenAI 클라이언트에 타임아웃 설정 (Cloudflare 100초 제한 고려)
            self.client = openai.OpenAI(api_key=self.api_key, timeout=60.0)
            print("[OK] Shorts Service 초기화 완료 (timeout: 60s)")

    def analyze_script_for_shorts(self, full_script: str, scenes: List[Dict]) -> Dict[str, Any]:
        """
        전체 스크립트를 분석하여 Shorts 후보 5개 추천

        Args:
            full_script: 전체 대본 텍스트
            scenes: 씬 리스트 (각 씬은 sceneId, originalScript, imagePrompt 등 포함)

        Returns:
            성공 여부 및 추천 목록
        """
        if not self.api_key:
            return {"success": False, "error": "OpenAI API 키가 설정되지 않았습니다"}

        try:
            print("[OK] Shorts 후보 분석 시작...")
            print(f"[OK] 전체 스크립트 길이: {len(full_script)} 글자, {len(scenes)}개 씬")

            # 씬 정보를 간략하게 정리
            scenes_summary = []
            for scene in scenes:
                scenes_summary.append({
                    "sceneId": scene.get("sceneId"),
                    "script": scene.get("originalScript", ""),
                    "duration_estimate": len(scene.get("originalScript", "")) / 10  # 대략적인 초 단위 추정
                })

            prompt = f"""당신은 YouTube Shorts 콘텐츠 전문가입니다.

다음 영상 스크립트를 분석하여 가장 효과적인 Shorts 후보 5개를 추천해주세요.

**선정 기준:**
1. **후킹 포인트**: 놀라운 사실, 감정적 순간, 호기심 유발
2. **독립성**: 전체 맥락 없이도 이해 가능
3. **최적 길이**: 30-60초 (너무 짧거나 길지 않게)
4. **바이럴 가능성**: 공유하고 싶은 요소
5. **완결성**: 명확한 시작-중간-끝 구조

**전체 스크립트:**
{full_script}

**씬 정보:**
{json.dumps(scenes_summary, ensure_ascii=False, indent=2)}

**출력 형식 (JSON만):**
{{
  "recommendations": [
    {{
      "rank": 1,
      "title": "Shorts 제목 (10자 이내)",
      "startSceneId": 2,
      "endSceneId": 4,
      "estimatedDuration": 45,
      "hookReason": "이 구간이 효과적인 이유 (간결하게)",
      "extractedScript": "해당 구간의 실제 스크립트",
      "viralPotential": "high/medium/low"
    }}
  ]
}}

반드시 5개의 추천을 제공하세요. 가장 좋은 것부터 순위를 매기세요.
"""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a YouTube Shorts content strategy expert."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000
            )

            content = response.choices[0].message.content.strip()

            # JSON 파싱
            if "```json" in content:
                content = content.replace("```json", "").replace("```", "")
            elif "```" in content:
                content = content.replace("```", "")

            content = content.strip()

            try:
                result_data = json.loads(content)
            except json.JSONDecodeError:
                # JSON 패턴 찾기 시도
                import re
                match = re.search(r'\{.*\}', content, re.DOTALL)
                if match:
                    result_data = json.loads(match.group())
                else:
                    raise ValueError("AI 응답을 JSON으로 파싱할 수 없습니다")

            recommendations = result_data.get("recommendations", [])

            # 유효성 검증
            for rec in recommendations:
                if "startSceneId" not in rec or "endSceneId" not in rec:
                    continue

                # sceneId 범위 검증
                start_id = rec["startSceneId"]
                end_id = rec["endSceneId"]

                if start_id < 1 or end_id > len(scenes):
                    print(f"[WARN] 잘못된 씬 범위: {start_id}-{end_id}")
                    continue

            print(f"[OK] Shorts 추천 완료: {len(recommendations)}개 후보 발견")

            return {
                "success": True,
                "recommendations": recommendations,
                "totalScenes": len(scenes)
            }

        except Exception as e:
            print(f"[X] Shorts 분석 오류: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }

    def extract_short_scenes(self, scenes: List[Dict], start_scene_id: int, end_scene_id: int) -> List[Dict]:
        """
        특정 씬 범위를 추출하여 Shorts용 씬 리스트 생성

        Args:
            scenes: 전체 씬 리스트
            start_scene_id: 시작 씬 ID
            end_scene_id: 종료 씬 ID

        Returns:
            추출된 씬 리스트
        """
        extracted = []

        for scene in scenes:
            scene_id = scene.get("sceneId")
            if start_scene_id <= scene_id <= end_scene_id:
                extracted.append(scene)

        print(f"[OK] Shorts 씬 추출: {start_scene_id}-{end_scene_id} → {len(extracted)}개 씬")

        return extracted


# 싱글톤 인스턴스
shorts_service = ShortsService()
