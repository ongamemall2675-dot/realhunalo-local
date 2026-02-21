# 배치 Vrew 생성 가이드

외부 TTS 파일과 대량의 미디어 파일을 자동으로 매칭하여 Vrew 프로젝트를 생성하는 기능입니다.

## 🎯 주요 기능

1. **자동 파일 매칭**: 넘버링 규칙으로 파일들을 자동 매칭
2. **타임스탬프 싱크**: 외부 타임스탬프로 자동 동기화
3. **대량 처리**: 수십~수백 개의 파일을 한 번에 처리

---

## 📁 폴더 구조 예시

### 방법 1: 폴더 기반 (자동 매칭)

```
my_project/
├── audio/
│   ├── 001_scene.mp3
│   ├── 002_scene.mp3
│   ├── 003_scene.mp3
│   └── 004_scene.mp3
│
├── timestamps/
│   ├── 001_timestamps.json
│   ├── 002_timestamps.json
│   ├── 003_timestamps.json
│   └── 004_timestamps.json
│
└── visuals/
    ├── 001_image.png
    ├── 002_video.mp4
    ├── 003_image.jpg
    └── 004_video.mp4
```

**넘버링 규칙:**
- `001`, `002`, `003` ... (3자리 숫자)
- `01`, `02`, `03` ... (2자리 숫자)
- `1`, `2`, `3` ... (1자리 숫자)
- 파일명 어디든 숫자가 있으면 자동 인식
  - `scene_001.mp3` ✅
  - `audio-001.mp3` ✅
  - `001_final.mp3` ✅
  - `clip_1_audio.mp3` ✅

---

## 📝 타임스탬프 파일 형식

타임스탬프 JSON 파일은 3가지 형식을 지원합니다:

### 형식 1: 밀리초 (추천)
```json
[
  {
    "text": "안녕하세요",
    "start_ms": 0,
    "end_ms": 2000
  },
  {
    "text": "반갑습니다",
    "start_ms": 2000,
    "end_ms": 4500
  }
]
```

### 형식 2: 초 단위
```json
[
  {
    "text": "안녕하세요",
    "start": 0.0,
    "end": 2.0
  },
  {
    "text": "반갑습니다",
    "start": 2.0,
    "end": 4.5
  }
]
```

### 형식 3: Vrew 형식
```json
[
  {
    "text": "안녕하세요",
    "startTime": 0.0,
    "duration": 2.0
  },
  {
    "text": "반갑습니다",
    "startTime": 2.0,
    "duration": 2.5
  }
]
```

---

## 🚀 사용 방법

### Python API

```python
from services.vrew_batch_service import vrew_batch_service

# 방법 1: 폴더에서 자동 매칭
vrew_url = vrew_batch_service.create_from_folder(
    audio_folder="./my_project/audio",
    timestamp_folder="./my_project/timestamps",
    visual_folder="./my_project/visuals",  # 선택사항
    output_filename="my_project.vrew"      # 선택사항
)

print(f"생성 완료: {vrew_url}")
```

```python
# 방법 2: 파일 리스트로 수동 매칭
vrew_url = vrew_batch_service.create_from_file_lists(
    audio_files=[
        "./audio/scene1.mp3",
        "./audio/scene2.mp3",
        "./audio/scene3.mp3"
    ],
    timestamp_files=[
        "./timestamps/scene1.json",
        "./timestamps/scene2.json",
        "./timestamps/scene3.json"
    ],
    visual_files=[
        "./visuals/scene1.png",
        "./visuals/scene2.mp4",
        "./visuals/scene3.jpg"
    ],
    output_filename="manual_project.vrew"
)
```

### REST API

#### 엔드포인트 1: 폴더 기반 배치 생성

```http
POST /api/batch-vrew-from-folder
Content-Type: application/json

{
  "audioFolder": "C:/Users/username/project/audio",
  "timestampFolder": "C:/Users/username/project/timestamps",
  "visualFolder": "C:/Users/username/project/visuals",
  "outputFilename": "my_project.vrew"
}
```

**응답:**
```json
{
  "success": true,
  "taskId": "batch_vrew_123456"
}
```

#### 엔드포인트 2: 파일 리스트 배치 생성

```http
POST /api/batch-vrew-from-lists
Content-Type: application/json

{
  "audioFiles": [
    "C:/Users/username/audio/001.mp3",
    "C:/Users/username/audio/002.mp3",
    "C:/Users/username/audio/003.mp3"
  ],
  "timestampFiles": [
    "C:/Users/username/timestamps/001.json",
    "C:/Users/username/timestamps/002.json",
    "C:/Users/username/timestamps/003.json"
  ],
  "visualFiles": [
    "C:/Users/username/visuals/001.png",
    "C:/Users/username/visuals/002.mp4",
    "C:/Users/username/visuals/003.jpg"
  ],
  "outputFilename": "batch_project.vrew"
}
```

#### 작업 상태 확인

```http
GET /api/tasks/{taskId}
```

**응답:**
```json
{
  "taskId": "batch_vrew_123456",
  "status": "completed",
  "progress": 100,
  "message": "배치 Vrew 파일 생성 완료!",
  "result": {
    "vrewUrl": "http://localhost:8000/output/batch_project_1234567890.vrew"
  }
}
```

---

## 💡 사용 예시

### 예시 1: YouTube 쇼츠 대량 제작

```
shorts_batch/
├── audio/
│   ├── 001_shorts_audio.mp3  (5초)
│   ├── 002_shorts_audio.mp3  (7초)
│   ├── 003_shorts_audio.mp3  (6초)
│   └── ... (30개)
│
├── timestamps/
│   ├── 001_timestamps.json
│   ├── 002_timestamps.json
│   ├── 003_timestamps.json
│   └── ... (30개)
│
└── visuals/
    ├── 001_background.mp4
    ├── 002_background.mp4
    ├── 003_background.mp4
    └── ... (30개)
```

**결과:** 30개의 쇼츠를 하나의 vrew 파일로 생성 → Vrew에서 개별 편집 가능

---

### 예시 2: 강의 영상 시리즈

```
lecture_series/
├── audio/
│   ├── lecture_01_intro.mp3
│   ├── lecture_02_chapter1.mp3
│   ├── lecture_03_chapter2.mp3
│   └── ...
│
├── timestamps/
│   ├── lecture_01_timestamps.json
│   ├── lecture_02_timestamps.json
│   └── ...
│
└── visuals/
    ├── lecture_01_slide.png
    ├── lecture_02_slide.png
    └── ...
```

---

### 예시 3: 광고 배리에이션

```
ad_variations/
├── audio/
│   ├── ad_v1_male.mp3
│   ├── ad_v2_female.mp3
│   ├── ad_v3_child.mp3
│   └── ...
│
├── timestamps/
│   ├── ad_v1_timestamps.json
│   ├── ad_v2_timestamps.json
│   └── ...
│
└── visuals/
    ├── ad_v1_product_A.mp4
    ├── ad_v2_product_B.mp4
    └── ...
```

---

## 🔧 고급 기능

### 1. 비주얼 없이 오디오만

```python
# 비주얼 없이 오디오 + 타임스탬프만으로 생성
vrew_url = vrew_batch_service.create_from_folder(
    audio_folder="./audio",
    timestamp_folder="./timestamps",
    visual_folder=None,  # 비주얼 없음
    output_filename="audio_only.vrew"
)
```

### 2. 부분 매칭

```
# 일부 파일만 비주얼이 있어도 OK
audio/
├── 001.mp3  ✓
├── 002.mp3  ✓
└── 003.mp3  ✓

timestamps/
├── 001.json  ✓
├── 002.json  ✓
└── 003.json  ✓

visuals/
├── 001.png  ✓ (있음)
└── 003.mp4  ✓ (있음)
# 002는 비주얼 없음 → OK, 자동으로 처리됨
```

### 3. 혼합 포맷

```
visuals/
├── 001_scene.png     (이미지)
├── 002_scene.mp4     (비디오)
├── 003_scene.jpg     (이미지)
└── 004_scene.avi     (비디오)
→ 자동으로 인식하여 처리
```

---

## 📊 출력 결과

생성된 .vrew 파일은:

1. **Vrew에서 바로 열림** ✅
2. **모든 씬이 자동 정렬됨** ✅
3. **타임스탬프 자동 싱크** ✅
4. **개별 편집 가능** ✅

### Vrew에서 확인할 수 있는 것:

- Scene 1: audio_001.mp3 + visual_001.png (00:00 ~ 00:05)
- Scene 2: audio_002.mp3 + visual_002.mp4 (00:05 ~ 00:12)
- Scene 3: audio_003.mp3 + visual_003.jpg (00:12 ~ 00:18)
- ...

각 씬의 자막은 타임스탬프에 맞춰 자동으로 배치됩니다.

---

## ⚠️ 주의사항

1. **파일명 넘버링**
   - 같은 숫자를 가진 파일들이 매칭됨
   - 중복된 숫자가 있으면 경고 발생

2. **타임스탬프 필수**
   - 오디오 파일에는 반드시 타임스탬프 파일이 있어야 함
   - 타임스탬프가 없으면 해당 씬은 스킵됨

3. **파일 경로**
   - Windows: `C:\\Users\\...` 또는 `C:/Users/...`
   - 상대 경로도 가능: `./audio`, `../project/audio`

4. **파일 크기**
   - 대량 파일 처리 시 시간이 걸릴 수 있음
   - 백그라운드 작업으로 처리됨 (taskId로 상태 확인)

---

## 🎬 워크플로우 예시

### 전체 워크플로우

```
1. 외부 TTS 도구로 음성 생성
   → audio_001.mp3, audio_002.mp3, ...

2. 타임스탬프 추출 (Whisper, Google STT 등)
   → timestamps_001.json, timestamps_002.json, ...

3. 영상/이미지 준비
   → visual_001.mp4, visual_002.png, ...

4. 배치 Vrew 생성 API 호출
   → project.vrew 생성

5. Vrew에서 열어서 추가 편집
   → 최종 비디오 내보내기
```

### Python 스크립트 예시

```python
import os
from services.vrew_batch_service import vrew_batch_service

def create_batch_vrew():
    """대량 파일을 처리하여 Vrew 프로젝트 생성"""

    project_dir = "./my_shorts_project"

    print("배치 Vrew 생성 시작...")

    vrew_url = vrew_batch_service.create_from_folder(
        audio_folder=f"{project_dir}/audio",
        timestamp_folder=f"{project_dir}/timestamps",
        visual_folder=f"{project_dir}/visuals",
        output_filename="shorts_batch_v1.vrew"
    )

    print(f"✅ 생성 완료: {vrew_url}")
    return vrew_url

if __name__ == "__main__":
    create_batch_vrew()
```

---

## 🐛 문제 해결

### Q: 파일이 매칭되지 않아요

**A:** 파일명에 숫자가 있는지 확인하세요.
```
✅ 001_audio.mp3
✅ scene_01.mp3
✅ audio-1.mp3
❌ audio_intro.mp3  (숫자 없음)
```

### Q: 일부 씬만 생성돼요

**A:** 로그를 확인하세요. 타임스탬프나 오디오 파일이 누락된 경우 해당 씬은 스킵됩니다.

```python
[Batch] 매칭 결과:
  #001: ✓ 오디오 ✓ 타임스탬프 ✓ 비주얼
  #002: ✓ 오디오 ✓ 타임스탬프 ✗ 비주얼
  #003: ✓ 오디오 ✗ 타임스탬프 ✗ 비주얼  ← 스킵됨
```

### Q: Vrew에서 파일이 열리지 않아요

**A:**
1. 파일 크기 확인 (너무 크지 않은지)
2. 타임스탬프 JSON 형식 확인
3. 오디오 파일이 실제로 존재하는지 확인

---

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. 콘솔 로그 확인
2. 파일명 넘버링 규칙 확인
3. 타임스탬프 JSON 형식 확인
4. 파일 경로가 정확한지 확인

---

**제작:** RealHunalo Studio
**버전:** 1.0.0
**업데이트:** 2026-02-11
