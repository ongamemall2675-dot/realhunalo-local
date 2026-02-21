# Vrew 파일 포맷 분석 및 생성 가이드

양도세 중과유예.vrew 파일 구조를 완벽히 분석하고, 프로그래밍 방식으로 .vrew 파일을 생성할 수 있는 도구들을 제공합니다.

## 📋 생성된 파일 목록

### 1. 📖 문서 (Documentation)
- **[vrew-format-analysis.md](vrew-format-analysis.md)**
  - Vrew 파일 포맷 완전 분석
  - TypeScript 인터페이스 정의
  - 모든 필드 설명
  - 핵심 개념 설명
  - 최소 프로젝트 구조 예시

### 2. 🐍 Python 구현
- **[vrew_builder.py](vrew_builder.py)**
  - Python으로 .vrew 파일 생성 클래스
  - 비디오, 오디오, 이미지 추가 기능
  - 자막 클립 추가 기능
  - 무음 구간 추가 기능
  - ZIP 아카이브 생성

- **[example_usage.py](example_usage.py)**
  - 8가지 실제 사용 예제
  - 간단한 비디오 + 자막
  - 오디오 + 자막
  - 이미지 슬라이드쇼
  - 유튜브 쇼츠 (세로 영상)
  - 프로그래밍 방식 자막 생성 등

### 3. 🟨 JavaScript/Node.js 구현
- **[vrew_integration_example.js](vrew_integration_example.js)**
  - Node.js용 VrewBuilder 클래스
  - archiver 패키지 사용
  - async/await 지원
  - 현재 프로젝트에 바로 통합 가능

### 4. 📊 샘플 데이터
- **[vrew-sample-full.json](vrew-sample-full.json)**
  - 실제 양도세 중과유예.vrew의 샘플 JSON
  - 첫 3개 클립 포함
  - 모든 구조 확인 가능

---

## 🚀 빠른 시작

### Python으로 시작하기

```python
from vrew_builder import VrewBuilder

# 1. Builder 생성
builder = VrewBuilder(width=1920, height=1080)

# 2. 비디오 추가
video_id = builder.add_video(
    video_path="my_video.mp4",
    duration=30.0,
    include_in_archive=True  # ✅ 중요: True로 설정!
)

# 3. 자막 추가
builder.add_clip("안녕하세요", start_time=0, duration=2.0)
builder.add_clip("반갑습니다", start_time=2.5, duration=2.0)

# 4. 저장
builder.save("output.vrew")
```

### Node.js로 시작하기

```javascript
const VrewBuilder = require('./vrew_integration_example.js');

async function createVrew() {
  const builder = new VrewBuilder(1920, 1080);

  // 비디오 추가
  const videoId = builder.addVideo("my_video.mp4", 30.0, true);

  // 자막 추가
  builder.addClip("안녕하세요", 0, 2.0, videoId);
  builder.addClip("반갑습니다", 2.5, 2.0, videoId);

  // 저장
  await builder.save("output.vrew");
}

createVrew();
```

---

## 💡 핵심 발견 사항

### ✅ 정상 작동하는 .vrew 파일 (양도세 중과유예.vrew)

```
양도세 중과유예.vrew (9.3MB)
├── project.json (1.2MB)
└── media/
    ├── ba938838-5d3a-452f-99fc-02619ab01837.png (1.7MB)
    ├── cc5ecc29-f628-436f-b927-353dba1dee44.png (1.5MB)
    ├── 2cceac1d-a39b-41ea-90f3-42ab6f32b135.png (1.3MB)
    ├── 5c2d0f86-478d-4680-99ef-144e73883822.png (1.9MB)
    └── 99ed1618-8fd4-4f4a-9f32-09206fea7bbc.png (1.5MB)
```

**특징:**
- ✅ `fileLocation: "IN_MEMORY"` - 미디어 파일이 아카이브 내부에 포함됨
- ✅ media 폴더에 실제 파일들이 존재
- ✅ Vrew에서 정상 작동

### ❌ 오류 파일 (final_video_1770557216727.vrew)

```
final_video_1770557216727.vrew (28KB)
└── project.json (28KB)
    └── media/ ❌ 없음!
```

**문제점:**
- ❌ `fileLocation: "LOCAL"` - 외부 경로만 참조
- ❌ 미디어 파일이 아카이브에 포함되지 않음
- ❌ `C:\Users\ongam\Downloads\final_video_1770557216727.mp4` 경로만 참조
- ❌ Vrew가 파일을 찾을 수 없어서 열리지 않음

### 🎯 해결 방법

**올바른 구현:**
```python
# ✅ 이렇게 하세요!
builder.add_video("video.mp4", duration=30.0, include_in_archive=True)
```

**잘못된 구현:**
```python
# ❌ 이렇게 하면 안 됩니다!
builder.add_video("video.mp4", duration=30.0, include_in_archive=False)
```

---

## 📐 .vrew 파일 구조

### 파일 포맷
- **확장자**: `.vrew`
- **실제 형식**: **ZIP 아카이브**
- **압축**: DEFLATE (일반 ZIP 압축)

### 내부 구조
```
project.vrew (ZIP 파일)
├── project.json          # 프로젝트 메타데이터
│   ├── version          # 프로젝트 버전 (15)
│   ├── projectId        # UUID
│   ├── files[]          # 미디어 파일 목록
│   ├── transcript       # 자막/클립 데이터
│   ├── props            # 프로젝트 속성
│   └── statistics       # 통계 정보
│
└── media/               # 포함된 미디어 파일들
    ├── [uuid].png
    ├── [uuid].mp4
    └── [uuid].mp3
```

### JSON 주요 섹션

#### 1. **files[]** - 미디어 파일 목록
```typescript
{
  mediaId: string;              // UUID
  type: "AVMedia" | "Image";    // 타입
  fileLocation: "IN_MEMORY" | "LOCAL";  // ⭐ 중요!
  name: string;
  fileSize: number;
  duration?: number;            // 비디오/오디오만
}
```

#### 2. **transcript** - 자막/클립
```typescript
{
  scenes: [
    {
      id: string;
      clips: [
        {
          id: string;
          words: [            // 단어별 타이밍
            {
              text: string;   // 텍스트
              startTime: number;  // 초 단위
              duration: number;   // 초 단위
              type: 0 | 1 | 2;   // 0=단어, 1=무음, 2=종료
            }
          ]
        }
      ]
    }
  ]
}
```

#### 3. **props** - 프로젝트 설정
```typescript
{
  videoSize: { width, height };
  videoRatio: number;           // 16:9 = 1.777...
  globalCaptionStyle: {         // 자막 스타일
    quillStyle: {
      font: string;
      size: string;
      color: string;            // "#ffffff"
      "outline-color": string;  // "#000000"
      "outline-width": string;  // "6"
    }
  }
}
```

---

## 🔧 기술 스택

### Python 버전
- **Python 3.6+**
- 필수 패키지: 없음 (내장 모듈만 사용)
  - `zipfile` - ZIP 생성
  - `json` - JSON 처리
  - `uuid` - UUID 생성
  - `pathlib` - 파일 경로

### Node.js 버전
- **Node.js 12+**
- 필수 패키지:
  ```bash
  npm install archiver uuid
  ```

---

## 📝 주요 데이터 타입

### Word 타입 (type)
- `0` - 실제 단어/텍스트
- `1` - 무음 구간
- `2` - 클립 종료 마커

### 파일 위치 (fileLocation)
- `"IN_MEMORY"` - 아카이브 내부 포함 ✅ **추천**
- `"LOCAL"` - 외부 경로 참조 ⚠️ **주의**

### 시간 단위
- 모든 시간: **초(second) 단위의 소수**
- `startTime: 0.13` = 0.13초
- `duration: 2.5` = 2.5초

---

## 🎯 실전 예제

### 1. 유튜브 영상 자막 추가
```python
builder = VrewBuilder(1920, 1080)
video_id = builder.add_video("youtube_video.mp4", 300.0)  # 5분

# STT 결과를 바탕으로 자막 추가
subtitles = [
    ("안녕하세요 여러분", 0.0, 2.5),
    ("오늘은 특별한 내용을", 2.5, 2.8),
    ("준비했습니다", 5.3, 2.0),
]

for text, start, duration in subtitles:
    builder.add_clip(text, start, duration, video_id)

builder.save("youtube_with_subs.vrew")
```

### 2. 쇼츠 영상 (세로)
```python
builder = VrewBuilder(1080, 1920)  # 9:16 세로
video_id = builder.add_video("shorts.mp4", 30.0)

builder.add_clip("충격적인", 0, 1.0)
builder.add_clip("이 사실!", 1.5, 1.5)
builder.add_clip("구독 좋아요", 27, 3.0)

builder.save("shorts.vrew")
```

### 3. 팟캐스트 자막
```python
builder = VrewBuilder()
audio_id = builder.add_audio("podcast.mp3", 3600.0)  # 1시간

# 긴 대화 내용
dialogue = [
    ("오늘 게스트는", 0, 2),
    ("김철수 씨입니다", 2, 2),
    # ... 3600개의 자막
]

for text, start, dur in dialogue:
    builder.add_clip(text, start, dur, audio_id)

builder.save("podcast.vrew")
```

---

## ⚠️ 주의사항

1. **파일 포함 필수**
   - `include_in_archive=True` 로 설정
   - 그렇지 않으면 Vrew에서 열리지 않음

2. **시간 정보 정확성**
   - words의 startTime과 duration이 정확해야 함
   - 겹치지 않도록 주의

3. **UUID 사용**
   - 모든 ID는 UUID 형식 필수
   - 중복되면 안 됨

4. **파일 크기**
   - 미디어 파일 포함 시 .vrew 파일이 커짐
   - 압축률: 보통 90% 정도

5. **인코딩**
   - project.json: UTF-8 인코딩
   - 한글 자막 사용 가능

---

## 🔍 디버깅

### .vrew 파일 구조 확인
```python
import zipfile

with zipfile.ZipFile('your_file.vrew', 'r') as zf:
    print(zf.namelist())
    # ['project.json', 'media/uuid.mp4', ...]
```

### project.json 읽기
```python
import zipfile
import json

with zipfile.ZipFile('your_file.vrew', 'r') as zf:
    with zf.open('project.json') as f:
        data = json.load(f)
        print(json.dumps(data, indent=2, ensure_ascii=False))
```

---

## 📚 추가 자료

- [vrew-format-analysis.md](vrew-format-analysis.md) - 완전한 포맷 분석
- [example_usage.py](example_usage.py) - 8가지 실전 예제
- [vrew-sample-full.json](vrew-sample-full.json) - 실제 데이터 샘플

---

## 🎓 결론

### 성공적인 .vrew 파일 생성의 핵심

1. ✅ **미디어 파일 포함** (`fileLocation: "IN_MEMORY"`)
2. ✅ **정확한 타이밍** (startTime + duration)
3. ✅ **UUID 사용** (모든 ID)
4. ✅ **올바른 ZIP 구조** (project.json + media/)
5. ✅ **완전한 메타데이터** (모든 필수 필드)

### 이제 할 수 있는 것들

- 🎬 비디오에 프로그래밍 방식으로 자막 추가
- 🎙️ 팟캐스트/오디오에 자막 생성
- 📊 AI STT 결과를 Vrew 프로젝트로 변환
- 🤖 대량의 영상을 자동으로 자막 처리
- 📝 스크립트를 기반으로 자동 편집

---

**제작일**: 2026-02-11
**분석 대상**: 양도세 중과유예.vrew (9.3MB)
**Vrew 버전**: 3.5.4
