"""
Audio Segmentation Service
긴 MP3 파일을 Whisper로 30자 이하 구간으로 세분화
"""

import os
import json
import uuid
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from dataclasses import dataclass, asdict

from .whisper_service import whisper_service
from .tts_base import WordTimestamp
from .utils import OUTPUT_DIR

import difflib
import re


@dataclass
class SegmentedScene:
    """세분화된 하나의 씬"""
    index: int                      # 씬 번호 (1부터 시작)
    text: str                       # 전체 텍스트
    start_time: float               # 시작 시간 (초)
    end_time: float                 # 종료 시간 (초)
    audio_path: str                 # 분할된 오디오 파일 경로
    timestamp_path: str             # 타임스탬프 JSON 파일 경로
    timestamps: List[WordTimestamp] # 단어별 타임스탬프


class AudioSegmentationService:
    """
    긴 MP3 파일을 Whisper로 분석하고 30자 이하 구간으로 세분화
    """
    
    def __init__(self):
        self.output_dir = OUTPUT_DIR
        print("[OK] Audio Segmentation Service 초기화 완료")
    
    def segment_audio(
        self,
        audio_path: str,
        max_chars: int = 50,
        original_script: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Tuple[str, List[SegmentedScene], str]:
        """
        긴 MP3 파일을 50자 이하 구간으로 세분화 (Logic 3.1 Refinement)
        """
        print("\n" + "="*60)
        print(f"오디오 세분화 시작: {Path(audio_path).name}")
        print(f"최대 문자 수: {max_chars}자")
        print("="*60)
        
        # 1. Whisper로 전사
        print("\n[Step 1/3] Whisper 음성 인식 중...")
        word_timestamps, full_text = whisper_service.transcribe_audio(audio_path)
        
        print(f"[OK] 전체 텍스트: {len(full_text)}자")
        print(f"[OK] 단어 수: {len(word_timestamps)}개")
        
        # 2. 그룹화 (Logic 3.1: Alignment-Driven)
        groups = []
        if original_script:
            print(f"\n[Step 2/3] Logic 3.1: 텍스트 정렬 기반 그룹화...")
            groups = self.align_script_with_audio(original_script, word_timestamps, max_chars)
        else:
            print(f"\n[Step 2/3] 대본 없음 - {max_chars}자 이하 단순 그룹화 (Legacy)...")
            # 대본이 없는 경우 단어들을 순차적으로 max_chars 단위로 묶음
            current_group = []
            current_len = 0
            for ts in word_timestamps:
                word_len = len(ts.text.strip())
                if current_len + word_len > max_chars and current_group:
                    groups.append(self._create_group(current_group))
                    current_group = []
                    current_len = 0
                current_group.append(ts)
                current_len += word_len
            if current_group:
                groups.append(self._create_group(current_group))
        
        print(f"[OK] {len(groups)}개 구간으로 분할됨")
        for i, group in enumerate(groups, 1):
            text_len = sum(len(ts.text) for ts in group['timestamps'])
            print(f"  #{i:03d}: {text_len}자 ({group['start_time']:.2f}s ~ {group['end_time']:.2f}s)")
            
        # 2.5 캐릭터 마스터 프롬프트 추출
        master_character_prompt = ""
        # 원본 대본이 있으면 원본 대본 기준, 없으면 Whisper 인식 텍스트 전체 사용
        source_text = original_script if original_script else full_text
        if source_text:
            print(f"\n[Step 2.5/3] 마스터 캐릭터 프롬프트 추출 중...")
            master_character_prompt = self.extract_character_prompt(source_text)
            if master_character_prompt:
                print(f"[OK] 마스터 캐릭터 프롬프트 추출 완료: {master_character_prompt[:50]}...")
            else:
                print(f"[WARN] 마스터 캐릭터 프롬프트를 추출하지 못했습니다.")
        
        # 3. 세션 폴더 생성
        if not session_id:
            session_id = str(uuid.uuid4())[:8]
        
        session_folder = os.path.join(self.output_dir, "segments", session_id)
        os.makedirs(session_folder, exist_ok=True)
        
        print(f"\n[Step 3/3] Master Audio 복사 및 메타데이터 생성...")
        print(f"저장 위치: {session_folder}")
        
        # 3.1 Master Audio 복사
        import shutil
        merged_audio_name = "merged_audio.mp3"
        merged_audio_path = os.path.join(session_folder, merged_audio_name)
        shutil.copy2(audio_path, merged_audio_path)
        
        # 4. 각 구간 메타데이터 생성
        segmented_scenes = []
        
        for i, group in enumerate(groups, 1):
            
            timestamp_filename = f"{i:03d}_timestamps.json"
            timestamp_file_path = os.path.join(session_folder, timestamp_filename)
            
            self._save_timestamps_json(
                timestamps=group['timestamps'],
                output_path=timestamp_file_path,
                offset=group['start_time']
            )
            
            scene = SegmentedScene(
                index=i,
                text=group['text'],
                start_time=group['start_time'],
                end_time=group['end_time'],
                audio_path=merged_audio_path,
                timestamp_path=timestamp_file_path,
                timestamps=group['timestamps']
            )
            
            segmented_scenes.append(scene)
            
        # 5. manifest.json 저장
        manifest_path = os.path.join(session_folder, "manifest.json")
        self._save_manifest(
            manifest_path=manifest_path,
            session_id=session_id,
            original_file=audio_path,
            scenes=segmented_scenes,
            master_character_prompt=master_character_prompt
        )
        
        print(f"\n[OK] 오디오 세분화 완료!")
        print(f"  - 총 {len(segmented_scenes)}개 씬 생성")
        print(f"  - 저장 위치: {session_folder}")
        print("="*60 + "\n")
        
        return session_folder, segmented_scenes, master_character_prompt
    
    def _group_by_llm_script(self, script: str, word_ts: List[WordTimestamp]) -> List[Dict[str, Any]]:
        """
        [Logic 3.1] 대본의 원문과 줄바꿈(\n\n)을 100% 기준으로 Whisper 단어들을 정밀 매칭
        """
        # 1. 대본 문단 분리 (이중 줄바꿈 기준)
        # 50자 규칙이 적용된 대본의 각 문단을 하나의 '씬(Scene)'으로 확정
        paragraphs = [p.strip() for p in script.split('\n\n') if p.strip()]
        
        # 만약 이중 줄바꿈이 없다면 단일 줄바꿈으로 시도
        if len(paragraphs) <= 1 and '\n' in script:
            paragraphs = [p.strip() for p in script.split('\n') if p.strip()]

        print(f"[Logic 3.1] 분석된 문단 수: {len(paragraphs)} / Whisper 단어 수: {len(word_ts)}")
        
        groups = []
        w_ptr = 0
        total_w = len(word_ts)
        
        # Whisper 전체 텍스트와 각 문단의 텍스트를 비교하여 최적의 단어 구간 탐색
        for p_idx, p_text in enumerate(paragraphs):
            # 현재 문단의 단어 수 추정
            p_words = p_text.split()
            p_word_count = len(p_words)
            
            # Whisper 타임스탬프에서 해당 문단에 해당하는 단어들 추출
            # 한글 특성상 1:1 매칭이 완벽하지 않으므로 '글자 수 비율'과 '순차 매칭' 혼합
            current_group_ts = []
            
            # 현재 문단의 글자 수
            p_char_len = len(p_text.replace(" ", ""))
            
            # 남은 전체 Whisper 글자 수
            remaining_whisper_chars = sum(len(ts.text.strip()) for ts in word_ts[w_ptr:])
            
            if remaining_whisper_chars > 0:
                # 예상되는 단어 점유율 (글자 수 기반)
                # 마지막 문단은 남은 모든 단어를 가져감
                if p_idx == len(paragraphs) - 1:
                    current_group_ts = word_ts[w_ptr:]
                    w_ptr = total_w
                else:
                    # 현재 문단의 비중 계산
                    ratio = p_char_len / (sum(len(para.replace(" ", "")) for para in paragraphs[p_idx:]))
                    take_count = int((total_w - w_ptr) * ratio)
                    
                    # 최소 1개는 가져가도록
                    take_count = max(1, take_count)
                    
                    # 실제 추출
                    current_group_ts = word_ts[w_ptr : w_ptr + take_count]
                    w_ptr += take_count
            
            if current_group_ts:
                groups.append({
                    'text': p_text, # 텍스트 성역화: Whisper 결과가 아닌 원문 대본 사용
                    'start_time': current_group_ts[0].start_ms / 1000.0,
                    'end_time': current_group_ts[-1].end_ms / 1000.0,
                    'timestamps': current_group_ts
                })

        # 잔여 단어 보정 (마지막 그룹에 밀어넣기)
        if w_ptr < total_w and groups:
            groups[-1]['timestamps'].extend(word_ts[w_ptr:])
            groups[-1]['end_time'] = word_ts[-1].end_ms / 1000.0
            
        return groups
    
    def _create_group(self, word_timestamps: List[WordTimestamp]) -> Dict[str, Any]:
        """단어 타임스탬프 리스트로부터 그룹 생성"""
        text = ' '.join(ts.text.strip() for ts in word_timestamps)
        start_time = word_timestamps[0].start_ms / 1000.0
        end_time = word_timestamps[-1].end_ms / 1000.0
        
        return {
            'text': text,
            'start_time': start_time,
            'end_time': end_time,
            'timestamps': word_timestamps
        }
    
    def _extract_audio_segment(
        self,
        source_path: str,
        output_path: str,
        start_time: float,
        end_time: float
    ):
        """
        ffmpeg를 사용하여 오디오 구간 추출
        
        Args:
            source_path: 원본 오디오 파일
            output_path: 출력 파일 경로
            start_time: 시작 시간 (초)
            end_time: 종료 시간 (초)
        """
        try:
            from pydub import AudioSegment
            
            # 원본 오디오 로드
            audio = AudioSegment.from_file(source_path)
            
            # 밀리초로 변환
            start_ms = int(start_time * 1000)
            end_ms = int(end_time * 1000)
            
            # 구간 추출
            segment = audio[start_ms:end_ms]
            
            # 저장
            segment.export(output_path, format="mp3")
            
        except ImportError:
            raise ImportError(
                "pydub 라이브러리가 필요합니다. pip install pydub 후 ffmpeg를 설치하세요."
            )
        except Exception as e:
            raise Exception(f"오디오 분할 실패: {e}")
    
    def _save_timestamps_json(
        self,
        timestamps: List[WordTimestamp],
        output_path: str,
        offset: float
    ):
        """
        타임스탬프를 JSON 파일로 저장 (상대 시간으로 변환)
        
        Args:
            timestamps: WordTimestamp 리스트
            output_path: 출력 JSON 파일 경로
            offset: 시작 시간 오프셋 (초)
        """
        offset_ms = int(offset * 1000)
        
        data = [
            {
                "text": ts.text.strip(),
                "start": (ts.start_ms - offset_ms) / 1000.0,
                "end": (ts.end_ms - offset_ms) / 1000.0
            }
            for ts in timestamps
        ]
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _save_manifest(
        self,
        manifest_path: str,
        session_id: str,
        original_file: str,
        scenes: List[SegmentedScene],
        master_character_prompt: str = ""
    ):
        """manifest.json 파일 저장"""
        from datetime import datetime
        
        manifest = {
            "sessionId": session_id,
            "originalFile": Path(original_file).name,
            "totalSegments": len(scenes),
            "createdAt": datetime.now().isoformat(),
            "masterCharacterPrompt": master_character_prompt,
            "segments": [
                {
                    "index": scene.index,
                    "audioPath": Path(scene.audio_path).name,
                    "timestampPath": Path(scene.timestamp_path).name,
                    "text": scene.text,
                    "startTime": scene.start_time,
                    "endTime": scene.end_time,
                    "imagePrompt": None
                }
                for scene in scenes
            ]
        }
        
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        print(f"[OK] manifest.json 저장 완료")

    def extract_character_prompt(self, script_text: str) -> List[Dict[str, str]]:
        """
        주어진 대본에서 등장인물의 시각적 외형(연령, 복장, 표정 등)을 분석하여
        일관성을 유지할 수 있는 마스터 캐릭터 프롬프트를 AI로 추출합니다.
        """
        # 로컬 임포트로 순환 참조 방지
        from .script_service import script_service
        
        # script_service의 클라이언트 찾기 (우선 순위: DeepSeek → OpenAI)
        target_client = None
        model = None
        
        if hasattr(script_service, 'deepseek_client') and script_service.deepseek_client:
            target_client = script_service.deepseek_client
            model = "deepseek-chat"
            print("[Step 2.5] AI Client: DeepSeek")
        elif hasattr(script_service, 'openai_client') and script_service.openai_client:
            target_client = script_service.openai_client
            model = "gpt-4o-mini"
            print("[Step 2.5] AI Client: OpenAI (fallback)")
        elif hasattr(script_service, 'primary_client') and script_service.primary_client:
            target_client = script_service.primary_client
            model = "gpt-4o-mini"
            print("[Step 2.5] AI Client: primary_client (fallback)")
            
        if not target_client:
            print("[WARN] extract_character_prompt: 사용 가능한 AI 클라이언트가 없습니다.")
            return []
            
        try:
            prompt = f"""ROLE & OBJECTIVE
You are JsonPromptMaker, a deterministic Prompt-to-JSON Engine.
Your task is to convert the characters extracted from the user's text script into precise, production-ready JSON prompts.

CORE RULES
1. Determinism: You must behave deterministically.
2. No Inference: You never invent, hallucinate, infer, guess, optimize, or assume any attribute.
3. Image Source Priority: If an attribute allows "image" as a source AND the user does NOT explicitly provide a value, THEN the attribute MUST be resolved from the reference image.
4. Defaults: Allowed ONLY when the attribute does NOT allow "image" as a source AND the user did not specify a value in text.
5. Value Declaration Requirement: Every field must explicitly declare how its value is resolved ("value", "source", or "default_source").
6. Image Locking: For explicitly requested reference image attributes, mark as image_locked.
7. Output Discipline: ONLY output valid, pretty-printed JSON.

Target Audience: Senior citizens (realistic, relatable, clear).

Script:
{script_text}

OUTPUT FORMAT:
Return a JSON array of objects, one for each distinct character.
Each object MUST have:
  - "type": "Protagonist", "Supporting", or "Extra"
  - "name": Character's name
  - "description": A short 1-sentence English description.
  - "json_profile": The exact JSON schema below populated with the character's extracted details.

JSON_PROFILE SCHEMA TO FOLLOW:
{{
  "task": "build_image_prompt_json",
  "reference_image_policy": {{
    "used": true,
    "represents": "full character identity unless explicitly overridden by text",
    "instructions": [
      "If an attribute allows image as a source and no text value is provided, the attribute must be copied exactly from the reference image",
      "Inference or stylistic guessing is forbidden when image source is available",
      "Never infer or optimize identity attributes"
    ]
  }},
  "subject": {{
    "type": "human",
    "identity_lock": {{
      "face": "image", "age": "image", "skin_tone": "image", "facial_features": "image",
      "body_proportions": "image", "hair_style": "image", "hair_color": "image", "eye_color": "image"
    }},
    "pose": {{ "value": "facing the camera", "allowed_sources": ["text", "image"] }},
    "expression": {{ "value": "neutral relaxed expression", "allowed_sources": ["text", "image"] }},
    "gaze": {{ "value": "forward-facing gaze", "allowed_sources": ["text", "image"] }}
  }},
  "appearance": {{
    "clothing": {{ "allowed_sources": ["text", "image"] }},
    "colors": {{ "primary_palette": {{ "value": "neutral balanced palette", "allowed_sources": ["text", "image"] }} }}
  }},
  "environment": {{
    "location": {{ "allowed_sources": ["text", "image"] }},
    "details": {{ "allowed_sources": ["text", "image"] }},
    "time_of_day": {{ "value": "controlled studio setup", "allowed_sources": ["text"] }},
    "weather": {{ "value": "indoor", "allowed_sources": ["text"] }}
  }},
  "camera": {{
    "framing": {{ "value": "medium shot", "allowed_sources": ["text"] }},
    "angle": {{ "value": "eye-level", "allowed_sources": ["text"] }},
    "lens_feel": {{ "value": "natural perspective", "allowed_sources": ["text", "image"] }}
  }},
  "lighting": {{
    "type": {{ "value": "soft studio lighting", "allowed_sources": ["text", "image"] }},
    "direction": {{ "value": "front-facing light", "allowed_sources": ["text"] }},
    "intensity": {{ "value": "medium intensity", "allowed_sources": ["text"] }}
  }},
  "style": {{
    "render_type": {{
      "source_policy": "text_overrides_image",
      "allowed_sources": ["text", "image"],
      "forbid_value_generation": true
    }}
  }},
  "quality_controls": {{
    "forbidden_changes": [
      "modifying identity attributes sourced from image", "implicit face or hair alteration",
      "beautification or aging", "conflicting multiple values for a single attribute"
    ]
  }}
}}
ONLY RETURN THE RAW JSON ARRAY. NO MARKDOWN.
"""

            response = target_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are JsonPromptMaker. You output ONLY valid JSON arrays as requested."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2, # Lower temperature for more deterministic JSON
                max_tokens=2500 # Ensure enough tokens for complex JSON
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
            
            characters = json.loads(content)
            if isinstance(characters, list):
                return characters
            else:
                print(f"[ERROR] extract_character_prompt: 예상하지 못한 JSON 형식: {type(characters)}")
                return []
        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON parsing failed: {e}\nContent: {content}")
            return []
        except Exception as e:
            print(f"[ERROR] extract_character_prompt failed: {str(e)}")
            return []

    def align_script_with_audio(self, original_script: str, word_timestamps: List[WordTimestamp], max_chars: int = 50) -> List[Dict[str, Any]]:
        """
        [Logic 3.1 Refinement] 
        1. 이중 줄바꿈(\n\n) 또는 줄바꿈(\n)을 절대적인 장면 경계(Paragraph)로 인식
        2. 각 문단 내에서 텍스트 매칭을 통해 Whisper 타임스탬프를 정밀 할당
        3. 문단이 50자를 초과할 경우에만 추가 분할
        """
        if not word_timestamps:
            return []

        # 1. 대본 문단 분리 (사용자/AI의 의도된 장면 경계)
        # \r\n 대응 및 연속된 공백 제거
        normalized_script = original_script.replace('\r\n', '\n').strip()
        paragraphs = [p.strip() for p in re.split(r'\n+', normalized_script) if p.strip()]
        
        print(f"[Align] 문단 수: {len(paragraphs)} / Whisper 단어 수: {len(word_timestamps)}")

        # 2. Whisper 전체 텍스트 구성 및 정규화
        whisper_texts_norm = [w.text.strip().lower() for w in word_timestamps]
        
        groups = []
        w_ptr = 0
        total_w = len(word_timestamps)

        for p_idx, p_text in enumerate(paragraphs):
            # 현재 문단의 단어들 (정규화)
            p_words = re.findall(r'\w+', p_text.lower())
            if not p_words: continue

            # Sequence Matching을 위한 구간 탐색
            # 현재 포인터(w_ptr)부터 일정 범위 내에서 가장 잘 매칭되는 지점 찾기
            search_range = min(total_w - w_ptr, len(p_words) * 3) # 문단 단어수의 3배수까지 탐색
            lookahead = whisper_texts_norm[w_ptr : w_ptr + search_range]
            
            matcher = difflib.SequenceMatcher(None, p_words, lookahead)
            matches = matcher.get_matching_blocks()
            
            if len(matches) > 1:
                # 가장 마지막 매칭 지점 찾기
                last_match = matches[-2] # 마지막은 (len, len, 0) dummy
                # 문단에 해당하는 Whisper 단어들의 끝 지점 계산
                end_in_lookahead = last_match.b + last_match.size
                take_count = end_in_lookahead
            else:
                # 매칭 실패 시 글자 수 비율로 추정 (Fallback)
                p_char_len = len(p_text.replace(" ", ""))
                remaining_script_chars = sum(len(para.replace(" ", "")) for para in paragraphs[p_idx:])
                ratio = p_char_len / remaining_script_chars if remaining_script_chars > 0 else 1.0
                take_count = int((total_w - w_ptr) * ratio)

            # 최소 1개, 최대 잔여분
            take_count = max(1, min(take_count, total_w - w_ptr))
            
            # 마지막 문단은 남은 모든 단어 흡수
            if p_idx == len(paragraphs) - 1:
                take_count = total_w - w_ptr

            current_p_timestamps = word_timestamps[w_ptr : w_ptr + take_count]
            w_ptr += take_count

            # 3. 문단 내 50자 초과 체크 및 분할
            # 문단이 이미 AI에 의해 50자 이하로 잘려왔을 것이나, 안전장치로 작동
            if len(p_text) > max_chars + 10: # 여유치 10자
                p_groups = self._split_long_paragraph(p_text, current_p_timestamps, max_chars)
                groups.extend(p_groups)
            else:
                if current_p_timestamps:
                    groups.append({
                        'text': p_text, # 원문 보존
                        'start_time': current_p_timestamps[0].start_ms / 1000.0,
                        'end_time': current_p_timestamps[-1].end_ms / 1000.0,
                        'timestamps': current_p_timestamps
                    })

        return groups

    def _split_long_paragraph(self, text: str, timestamps: List[WordTimestamp], max_chars: int) -> List[Dict[str, Any]]:
        """긴 문단을 글자 수 기준으로 물리적으로 나눔"""
        sub_groups = []
        current_ts = []
        current_len = 0
        
        for ts in timestamps:
            word_len = len(ts.text.strip())
            if current_len + word_len > max_chars and current_ts:
                sub_groups.append(self._create_group(current_ts))
                current_ts = []
                current_len = 0
            
            current_ts.append(ts)
            current_len += word_len
            
        if current_ts:
            sub_groups.append(self._create_group(current_ts))
            
        return sub_groups


# 싱글톤 인스턴스
audio_segmentation_service = AudioSegmentationService()
