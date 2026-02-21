# RealHunalo Studio (Modular Video Automation)

**RealHunalo Studio**는 부동산 및 시니어 타겟 콘텐츠 제작을 위한 **차세대 올인원 영상 자동화 플랫폼**입니다.
대본 작성, AI 음성 합성(TTS), 이미지/영상 생성, 그리고 정교한 편집 프로젝트(Vrew) 내보내기까지의 모든 과정을 모듈화된 아키텍처 내에서 원스톱으로 처리합니다.

---

## 1. 프로젝트 개요 (Project Overview)
본 프로젝트는 기존의 복잡한 자동화 워크플로우를 **FastAPI 기반의 마이크로 서비스 아키텍처**로 재설계하여 최상의 속도와 유지보수 편의성을 제공합니다. 시니어 사용자를 배려한 직관적인 UX와 데이터 기반의 신뢰도 높은 콘텐츠 생성을 목표로 합니다.

### ✨ 주요 기능 (Key Features)
*   **AI 대본 엔진**: DeepSeek/GPT-4o 기반의 흡입력 있는 시나리오 및 의미 단위 세그멘테이션.
*   **지능형 프롬프트 조립**: `PromptAssembler`를 통한 캐릭터/화풍/장면 데이터의 결정론적 결합.
*   **고품질 멀티미디어 생성**:
    *   **이미지 (Flux/Replicate)**: 16:9 고해상도 시네마틱 이미지 생성.
    *   **모션 (Stable Video Diffusion)**: 정지 영상을 생동감 넘치는 카메라 무빙 영상으로 변환.
*   **맞춤형 TTS 및 배치 처리**: ElevenLabs, Azure, Google TTS를 지원하며 수백 개의 문장을 동시에 처리.
*   **자동 편집 솔루션**:
    *   **FFmpeg 엔진**: 오디오 병합 및 자막 오버레이 자동화.
    *   **Vrew Integration**: 즉시 편집 가능한 `.vrew` 프로젝트 파일 패키징 및 다운로드.
*   **중중앙 집중식 태스크 관리**: 모든 비동기 작업의 진행률을 `TaskManager`가 실시간으로 트래킹.

---

## 2. 기술 스택 및 환경 (Tech Stack)

### Backend
*   **Core**: Python 3.10+, FastAPI (Asynchronous API Framework)
*   **Modularization**: FastAPI APIRouter (도메인별 로직 분리)
*   **AI/ML**: OpenAI (GPT-4o), DeepSeek (Reasoner/Chat), Replicate (Flux/SVD)
*   **Media**: FFmpeg, MoviePy, Pydub, PIL (Pillow)

### Frontend
*   **Core**: HTML5, Vanilla JavaScript (ES6 Modular Architecture)
*   **Architecture**: View-API-Controller 패턴 도입 (ImageUI, ImageApi 등 분리)
*   **Styling**: TailwindCSS, Lucide Icons

---

## 3. 프로젝트 구조 (Project Structure)

### 📂 Directory Mapping
```
realhunalo_local/
├── backend.py              # 서버 진입점 및 라우터 등록
├── routers/                # [NEW] 도메인별 API 라우터
│   ├── image_router.py     # 이미지/캐릭터 분석
│   ├── script_router.py    # 대본 생성/세그멘테이션
│   ├── video_router.py     # 영상/Vrew/오디오 분석
│   └── ... (TTS, Shorts, Youtube)
├── services/               # 핵심 비즈니스 로직 (Logic Layer)
│   ├── task_service.py     # [NEW] 중앙 태스크 관리 (TaskManager)
│   ├── prompt_assembler.py # 프롬프트 자동 조립 엔진
│   ├── video_service.py    # FFmpeg 렌더링 엔진
│   └── ... (30+ 서비스 모듈)
├── assets/                 # 프론트엔드 자원
│   └── js/modules/         # [REFACTOR] 하위 컴포넌트로 분리된 JS 모듈
├── output/                 # 최종 렌더링 결과물 (Video/Audio/Image)
├── data/                   # 영구 저장 데이터 (Characters/Projects)
└── projects/               # 저장된 편집 프로젝트 파일
```

---

## 4. 설치 및 실행 가이드 (Setup & Run)

### 1) 사전 준비
- Python 3.10 이상 설치 필요
- FFmpeg 설치 및 환경 변수 등록 필요

### 2) 설치 명령어
```bash
# 가상환경 생성 (권장)
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt
```

### 3) 환경 변수 설정
`.env` 파일을 루트 디렉토리에 생성하고 필요한 API 키를 설정합니다.
```ini
OPENAI_API_KEY=your_key
DEEPSEEK_API_KEY=your_key
REPLICATE_API_TOKEN=your_token
ELEVENLABS_API_KEY=your_key
```

### 4) 실행 명령어
두 대의 서버(백엔드/프론트엔드)를 동시에 실행해야 합니다.
```bash
# 한 번에 실행하기 (Windows용)
.\start_servers.bat

# 개별 실행
# Backend: http://localhost:8000
python backend.py 

# Frontend: http://localhost:5500
python simple_http_server.py
```

---

## 5. 트러블슈팅 및 유지보수 (Maintenance Note)

### 🛠 주요 해결 과제
*   **이미지 프롬프트 리스트 에러**: 배경 데이터(`cultural_elements`)가 리스트로 반환될 때 발생하는 조인 에러를 `image_router.py`에서 안전하게 처리하도록 개선했습니다.
*   **대규모 백엔드 코드 모듈화**: 1,400줄 이상의 `backend.py`를 라우터로 분리하여 코드 가독성과 확장성을 확보했습니다.
*   **Windows 인코딩 대응**: 콘솔 출력 시 한글 깨짐 방지를 위해 `utf-8` 스트림 재설정 로직을 포함하고 있습니다.

### 📝 개발자 참고 사항
- 새로운 API 추가 시 `routers/` 내에 파일을 생성하고 `backend.py`에서 `app.include_router()`를 통해 등록하세요.
- 비동기 작업 통계가 필요한 경우 `services.task_service.task_manager`를 임포트하여 태스크를 생성/업데이트하세요.

---
💡 **ADAM Project 수석 전략가 Note**: "이 시스템은 단순한 도구가 아니라 시니어 친화적 부동산 비즈니스의 디지털 자산입니다. 모든 코드는 방어적으로 작성되었으며 인수인계가 용이하도록 모듈화되었습니다."
