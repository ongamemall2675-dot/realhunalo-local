import os
import json
import logging
import asyncio
import difflib
from typing import List, Dict, Optional
from services.script_analyzer import ScriptAnalyzer
from services.highlight_extractor import HighlightExtractor
from services.image_service import image_service
from services.tts_service import tts_service
from services.video_service import video_service
from services.project_service import project_service

logger = logging.getLogger(__name__)

class ShortsService:
    """
    쇼츠 영상 생성 워크플로우를 총괄하는 서비스입니다.
    Mode A(단독 생성)와 Mode B(리퍼퍼징)를 모두 지원하며,
    대본 분석 -> 자산 생성 -> 렌더링 과정을 조율합니다.
    """

    def __init__(self):
        self.script_analyzer = ScriptAnalyzer()
        self.highlight_extractor = HighlightExtractor()
        
        # 임시 저장 경로
        self.output_dir = os.path.join(os.getcwd(), "output", "shorts")
        os.makedirs(self.output_dir, exist_ok=True)

    async def create_shorts_from_script(self, script_text: str, style_context: Dict = None, progress_callback=None) -> Dict:
        """
        [Mode A] 사용자가 입력한 대본으로 쇼츠 프로젝트를 생성하고 최종 영상까지 제작합니다.
        
        Args:
            script_text: 대본 텍스트
            style_context: 스타일 설정 (name, style_prompt 등)
            progress_callback: 진행률 콜백 함수
        """
        try:
            logger.info(f"Mode A: 쇼츠 생성 시작 (대본 길이: {len(script_text)})")
            
            if progress_callback:
                progress_callback(5, "대본 분석 중...")

            # 1. 대본 분석 (장면 분할 & 프롬프트 생성)
            scenes = self.script_analyzer.analyze_script(script_text, style_context)
            
            # 프로젝트 ID 생성
            project_id = f"shorts_{int(asyncio.get_event_loop().time())}"
            project_path = os.path.join(self.output_dir, project_id)
            os.makedirs(project_path, exist_ok=True)
            
            # 중간 저장
            self._save_scenes(project_path, scenes)

            if progress_callback:
                progress_callback(15, "자산 생성 시작 (이미지/음성)...")

            # 2. 자산 생성 (병렬 처리 권장, 현재는 순차 처리)
            generated_scenes = await self._generate_assets_for_scenes(scenes, project_path, style_context, progress_callback)

            # 중간 저장 (자산 포함)
            self._save_scenes(project_path, generated_scenes)

            if progress_callback:
                progress_callback(50, "영상 렌더링 중...")

            # 3. 최종 영상 렌더링
            video_url = await self._render_video(generated_scenes, progress_callback)

            if progress_callback:
                progress_callback(100, "완료!")

            return {
                "success": True,
                "project_id": project_id,
                "video_url": video_url,
                "scenes": generated_scenes,
                "message": "쇼츠 영상 생성이 완료되었습니다."
            }

        except Exception as e:
            logger.error(f"쇼츠 생성 중 오류: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {"success": False, "error": str(e)}

    def _save_scenes(self, path: str, scenes: List[Dict]):
        try:
            with open(os.path.join(path, "scenes.json"), "w", encoding="utf-8") as f:
                json.dump(scenes, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"장면 저장 실패: {e}")

    async def analyze_project(self, project_path: str) -> Dict:
        """
        [Mode B] 기존 프로젝트 폴더를 분석하여 추천 쇼츠 대본(하이라이트)을 반환합니다.
        project_path는 실제로는 project_id가 전달될 수 있으므로 처리가 필요합니다.
        """
        try:
            # project_path가 ID인 경우 로드 시도
            project_data = project_service.load_project(project_path)
            if not project_data:
                # 경로로 간주하고 시도 (혹시 모를 하위 호환성)
                if os.path.exists(os.path.join(project_path, "script.json")):
                     return self.highlight_extractor.analyze_project_script(project_path)
                return {"success": False, "error": "Project not found"}

            # 전체 스크립트 추출
            full_script = project_data.get("script", "")
            if not full_script and project_data.get("scenes"):
                full_script = " ".join([s.get("originalScript", "") for s in project_data["scenes"]])

            if not full_script:
                 return {"success": False, "error": "No script found in project"}

            logger.info(f"프로젝트 분석 시작: {project_data.get('name')} (길이: {len(full_script)})")
            
            # 하이라이트 추출
            highlights = self.highlight_extractor.extract_highlights(full_script)
            
            return {
                "success": True,
                "highlights": highlights,
                "original_project_id": project_path
            }

        except Exception as e:
            logger.error(f"프로젝트 분석 실패: {e}")
            return {"success": False, "error": str(e)}

    async def create_shorts_from_highlight(self, highlight_type: str, scenes: List[Dict], original_project_path: str) -> Dict:
        """
        [Mode B] 선택된 하이라이트 대본으로 쇼츠 프로젝트를 생성합니다.
        기존 자산(이미지/음성)이 있다면 재활용합니다.
        """
        try:
            logger.info(f"Mode B: 하이라이트 쇼츠 생성 ({highlight_type})")
            
            # 1. 원본 프로젝트 로드 (자산 재사용을 위해)
            original_project = project_service.load_project(original_project_path)
            original_scenes = original_project.get("scenes", []) if original_project else []
            
            logger.info(f"원본 프로젝트 로드 완료: {len(original_scenes)} scenes found.")

            # 2. 자산 재사용 로직 적용
            reused_count = 0
            for scene in scenes:
                # 텍스트 유사도 기반 매칭
                best_match = None
                highest_ratio = 0.0
                target_text = scene.get("text", "")

                for org_scene in original_scenes:
                    org_text = org_scene.get("originalScript", "")
                    
                    # 1. 완전 일치 (오디오까지 재사용 가능)
                    if target_text == org_text:
                        best_match = org_scene
                        highest_ratio = 1.0
                        break
                    
                    # 2. 부분 일치 (이미지만 재사용 가능)
                    ratio = difflib.SequenceMatcher(None, target_text, org_text).ratio()
                    if ratio > highest_ratio:
                        highest_ratio = ratio
                        best_match = org_scene
                
                # 매칭된 자산 적용 (임계값 0.7 이상)
                if best_match and highest_ratio > 0.7:
                    logger.info(f"자산 재사용 매칭 성공 (유사도: {highest_ratio:.2f}): '{target_text[:10]}...' <- '{best_match.get('originalScript', '')[:10]}...'")
                    
                    # 이미지 재사용
                    if best_match.get("generatedUrl"):
                         scene['visualUrl'] = best_match['generatedUrl']
                         scene['reused_visual'] = True
                    elif best_match.get("visualUrl"): # 다른 필드명 대응
                         scene['visualUrl'] = best_match['visualUrl']
                         scene['reused_visual'] = True

                    # 100% 일치 시 오디오도 재사용
                    if highest_ratio == 1.0 and best_match.get("audioPath") and os.path.exists(best_match["audioPath"]):
                        scene['audioUrl'] = best_match.get('audioUrl')
                        scene['audioPath'] = best_match.get('audioPath')
                        scene['srtData'] = best_match.get('srtData')
                        # duration은 원본 그대로 사용
                        if best_match.get("audioDuration"):
                            scene['duration'] = best_match['audioDuration']
                        scene['reused_audio'] = True
                        reused_count += 1
            
            logger.info(f"총 {len(scenes)}개 장면 중 {reused_count}개 장면에서 오디오/이미지 완전 재사용 예정.")

            # 3. 부족한 자산 생성 및 영상 렌더링
            return await self._process_scenes_to_video(scenes)

        except Exception as e:
            logger.error(f"하이라이트 쇼츠 생성 실패: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {"success": False, "error": str(e)}

    async def _generate_assets_for_scenes(self, scenes: List[Dict], project_path: str, style_context: Dict = None, progress_callback=None) -> List[Dict]:
        """
        장면 리스트에 대해 부족한 자산(이미지, 오디오)을 생성합니다.
        """
        generated_scenes = []
        total_scenes = len(scenes)
        
        for idx, scene in enumerate(scenes):
            logger.info(f"Processing Scene {idx+1}/{total_scenes}")
            if progress_callback:
                progress_callback(15 + int((idx/total_scenes)*30), f"장면 {idx+1} 자산 생성 중...")

            # A. 이미지 생성 (이미 존재하면 스킵)
            if not scene.get('visualUrl'):
                visual_keyword = scene.get('visual_keyword', '')
                # 스타일 프롬프트 결합 (이미 analyzer에서 처리되었을 수 있음)
                
                image_res = image_service.generate(
                    prompt=visual_keyword,
                    aspect_ratio="9:16",
                    model="black-forest-labs/flux-schnell" # 빠른 모델 사용
                )
                
                if image_res.get('success'):
                    scene['visualUrl'] = image_res.get('imageUrl')
                else:
                    logger.error(f"이미지 생성 실패: {image_res.get('error')}")
                    scene['visualUrl'] = None 

            # B. TTS 생성 (이미 존재하면 스킵)
            if not scene.get('audioUrl'):
                tts_res = tts_service.generate(
                    text=scene.get('text', ''),
                    scene_id=str(scene.get('sceneId', idx)),
                    speed=1.1 # 쇼츠는 약간 빠르게
                )
                
                if tts_res.get('success'):
                    scene['audioUrl'] = tts_res.get('audioUrl')
                    scene['audioPath'] = tts_res.get('audioPath')
                    scene['srtData'] = tts_res.get('srtData')
                    scene['duration'] = tts_res.get('duration_ms', 3000) / 1000 
                else:
                    logger.error(f"TTS 생성 실패: {tts_res.get('error')}")
                    scene['audioUrl'] = None

            generated_scenes.append(scene)
            
        return generated_scenes

    async def _render_video(self, scenes: List[Dict], progress_callback=None) -> str:
        """
        장면 리스트를 기반으로 최종 영상을 렌더링합니다.
        """
        video_url = video_service.generate_final_video(
            merged_groups=[],
            standalone=scenes,
            resolution="shorts", # 9:16 강제
            subtitle_style={ 
                "enabled": True, 
                "fontFamily": "Malgun Gothic", 
                "fontSize": 70,  # 모바일 화면 고려
                "position": "center",
                "fontColor": "#FFFF00", # 노란색 자막
                "outlineColor": "#000000"
            },
            progress_callback=lambda p, m: progress_callback(50 + int(p * 0.5), m) if progress_callback else None
        )
        return video_url

    async def _process_scenes_to_video(self, scenes: List[Dict], progress_callback=None) -> Dict:
        """
        (내부 helper) 장면 리스트를 받아 부족한 자산을 생성하고 영상 합성을 수행합니다.
        (create_shorts_from_highlight 전용, 프로젝트 ID 생성 포함)
        """
        project_id = f"shorts_repurpose_{int(asyncio.get_event_loop().time())}"
        project_path = os.path.join(self.output_dir, project_id)
        os.makedirs(project_path, exist_ok=True)
        
        # 자산 생성 (재사용된 것은 건너뜀)
        generated_scenes = await self._generate_assets_for_scenes(scenes, project_path, progress_callback=progress_callback)
        
        # 중간 저장
        self._save_scenes(project_path, generated_scenes)

        # 렌더링
        video_url = await self._render_video(generated_scenes, progress_callback)
        
        return {
            "success": True, 
            "project_id": project_id,
            "video_url": video_url,
            "scenes": generated_scenes
        }

# 싱글톤 인스턴스
shorts_service = ShortsService()
