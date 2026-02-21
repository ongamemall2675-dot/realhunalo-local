# Vrew 프로젝트 파일 포맷 분석 (.vrew)

## 파일 구조

.vrew 파일은 **ZIP 아카이브** 형식입니다.

```
project.vrew (ZIP 파일)
├── project.json          # 프로젝트 메타데이터 및 구조
└── media/                # 포함된 미디어 파일들
    ├── [mediaId1].png
    ├── [mediaId2].png
    └── ...
```

## JSON 구조 (TypeScript 인터페이스)

```typescript
interface VrewProject {
  version: number;                    // 프로젝트 버전 (예: 15)
  projectId: string;                  // UUID 형식
  comment: string;                    // 버전 정보 (예: "3.5.4\t2026-02-07T08:39:48.396Z")
  files: MediaFile[];                 // 미디어 파일 목록
  transcript: Transcript;             // 자막/클립 데이터
  props: ProjectProps;                // 프로젝트 속성
  statistics: ProjectStatistics;      // 통계 정보
}

// ==================== 1. 미디어 파일 구조 ====================

interface MediaFile {
  version: number;
  mediaId: string;                    // UUID (파일 식별자)
  sourceOrigin: "USER" | string;
  fileSize: number;                   // 바이트 단위
  name: string;                       // 파일명
  type: "AVMedia" | "Image";          // 미디어 타입

  // AVMedia (비디오/오디오) 전용
  videoAudioMetaInfo?: {
    videoInfo?: {
      size: { width: number; height: number };
      frameRate: number;
      codec: string;
    };
    audioInfo?: {
      sampleRate: number;
      codec: string;
      channelCount: number;
    };
    duration: number;                 // 초 단위
    presumedDevice: string;
    mediaContainer: string;           // 예: "mp3", "mp4"
  };
  sourceFileType?: "VIDEO_AUDIO";

  // 이미지 전용
  isTransparent?: boolean;

  // 파일 위치 정보
  fileLocation: "LOCAL" | "IN_MEMORY";
  path?: string;                      // LOCAL인 경우 절대 경로
  relativePath?: string;              // 상대 경로
}

// ==================== 2. 자막/클립 구조 ====================

interface Transcript {
  scenes: Scene[];
}

interface Scene {
  id: string;
  clips: Clip[];
  name: string;
  dirty: {
    video: boolean;
  };
}

interface Clip {
  id: string;
  words: Word[];                      // 단어/시간 정보
  captionMode: "TRANSCRIPT" | string;
  captions: Caption[];                // 자막 텍스트
  assetIds: string[];                 // 연결된 에셋 ID
  audioIds: string[];                 // 연결된 오디오 ID
  dirty: {
    blankDeleted: boolean;
    caption: boolean;
    video: boolean;
  };
  translationModified: {
    result: boolean;
    source: boolean;
  };
}

interface Word {
  id: string;
  text: string;                       // 단어 텍스트 (빈 문자열이면 무음)
  startTime: number;                  // 초 단위
  duration: number;                   // 초 단위
  aligned: boolean;
  type: number;                       // 0: 단어, 1: 무음, 2: 종료 마커
  originalDuration: number;
  originalStartTime: number;
  truncatedWords: any[];
  autoControl: boolean;
  mediaId: string;                    // 연결된 미디어 ID
  audioIds: string[];
  assetIds: string[];
  playbackRate: number;               // 재생 속도 (1 = 정상)
}

interface Caption {
  text: Array<{ insert: string }>;    // Quill 델타 형식
}

// ==================== 3. 프로젝트 속성 ====================

interface ProjectProps {
  // 빈 객체들
  assets: Record<string, any>;
  audios: Record<string, any>;
  overdubInfos: Record<string, any>;
  backgroundMap: Record<string, any>;
  flipSetting: Record<string, any>;
  ttsClipInfosMap: Record<string, any>;

  // 분석 정보
  analyzeDate: string;                // "2026-1-8 22:51:47"

  // 비디오 설정
  videoRatio: number;                 // 1.7777... (16:9)
  videoSize: {
    width: number;                    // 1920
    height: number;                   // 1080
  };
  initProjectVideoSize: {
    width: number;
    height: number;
  };
  globalVideoTransform: {
    zoom: number;                     // 1
    xPos: number;                     // 0
    yPos: number;                     // 0
    rotation: number;                 // 0
  };

  // 자막 설정
  captionDisplayMode: Record<string, boolean>;
  globalCaptionStyle: {
    captionStyleSetting: {
      mediaId: string;                // "uc-0010-simple-textbox"
      yAlign: "top" | "center" | "bottom";
      yOffset: number;
      xOffset: number;
      rotation: number;
      width: number;                  // 0.96 (화면 대비 비율)
      customAttributes: Array<{
        attributeName: string;
        type: string;
        value: string;
      }>;
      scaleFactor: number;
    };
    quillStyle: {
      font: string;                   // "Pretendard-Vrew_700"
      size: string;                   // "100"
      color: string;                  // "#ffffff"
      "outline-on": string;           // "true"
      "outline-color": string;        // "#000000"
      "outline-width": string;        // "6"
    };
  };

  // 효과 및 필터
  mediaEffectMap: Record<string, {
    filter: {
      effectType: "filter";
      filterMediaId: string;
      filterAlphas: Record<string, number>;
    };
  }>;

  // 마커
  markerNames: Record<string, string>;

  // TTS 설정
  lastTTSSettings: {
    pitch: number;                    // 0
    speed: number;                    // 1
    volume: number;                   // 0
    speaker: {
      age: "young" | "middle" | "old";
      gender: "male" | "female";
      lang: string;                   // "ko-KR"
      name: string;                   // "va19"
      speakerId: string;
      provider: "vrew" | string;
      badge?: string;
      versions: string[];
      tags: string[];
    };
    version: string;                  // "v2"
  };

  // 언어 및 발음
  pronunciationDisplay: boolean;
  projectAudioLanguage: string;       // "ko"
  audioLanguagesMap: Record<string, string>;

  // 원본 클립 맵
  originalClipsMap: Record<string, Clip[]>;
}

// ==================== 4. 통계 정보 ====================

interface ProjectStatistics {
  wordCursorCount: Record<string, number>;
  wordSelectionCount: Record<string, number>;
  wordCorrectionCount: Record<string, number>;
  projectStartMode: "video_audio" | "transcript" | string;

  saveInfo: {
    created: {
      version: string;                // "3.5.4"
      date: string;                   // "2026-02-08T22:52:54+09:00"
      stage: "release" | string;
    };
    updated: {
      version: string;
      date: string;
      stage: "release" | string;
    };
    loadCount: number;
    saveCount: number;
  };

  savedStyleApplyCount: number;
  cumulativeTemplateApplyCount: number;
  ratioChangedByTemplate: boolean;
  videoRemixInfos: Record<string, any>;
  isAIWritingUsed: boolean;

  sttLinebreakOptions: {
    mode: number;
    maxLineLength: number;
  };
  clientLinebreakExecuteCount: number;

  agentStats: {
    isEdited: boolean;
    requestCount: number;
    responseCount: number;
    toolCallCount: number;
    toolErrorCount: number;
  };
}
```

## 주요 개념 설명

### 1. **파일 위치 (fileLocation)**
- `"LOCAL"`: 외부 파일 시스템의 경로를 참조 (path 필드 사용)
- `"IN_MEMORY"`: .vrew 아카이브 내부의 media/ 폴더에 포함됨

### 2. **Word 타입 (type)**
- `0`: 실제 단어/텍스트
- `1`: 무음 구간
- `2`: 클립 종료 마커

### 3. **Scene과 Clip**
- Scene: 전체 비디오의 큰 구간
- Clip: Scene 내의 작은 자막 단위
- 각 Clip은 여러 Word를 포함

### 4. **시간 정보**
- 모든 시간은 **초(second) 단위의 소수**
- startTime: 시작 시간
- duration: 지속 시간
- endTime = startTime + duration

## 코드 구현 예시

### .vrew 파일 생성

```javascript
const archiver = require('archiver');
const fs = require('fs');

async function createVrewFile(projectData, mediaFiles, outputPath) {
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.pipe(output);

  // 1. project.json 추가
  archive.append(
    JSON.stringify(projectData, null, 2),
    { name: 'project.json' }
  );

  // 2. 미디어 파일들 추가
  for (const mediaFile of mediaFiles) {
    if (mediaFile.fileLocation === 'IN_MEMORY') {
      archive.file(mediaFile.sourcePath, {
        name: `media/${mediaFile.mediaId}.${mediaFile.extension}`
      });
    }
  }

  await archive.finalize();
}
```

### 최소 프로젝트 구조

```javascript
const minimalProject = {
  version: 15,
  projectId: generateUUID(),
  comment: `3.5.4\t${new Date().toISOString()}`,

  files: [
    {
      version: 1,
      mediaId: "video-uuid",
      sourceOrigin: "USER",
      fileSize: 1444760,
      name: "video.mp4",
      type: "AVMedia",
      videoAudioMetaInfo: {
        videoInfo: {
          size: { width: 1920, height: 1080 },
          frameRate: 30,
          codec: "h264"
        },
        audioInfo: {
          sampleRate: 44100,
          codec: "aac",
          channelCount: 2
        },
        duration: 60.0,
        presumedDevice: "unknown",
        mediaContainer: "mp4"
      },
      sourceFileType: "VIDEO_AUDIO",
      fileLocation: "IN_MEMORY",
      relativePath: "./video.mp4"
    }
  ],

  transcript: {
    scenes: [
      {
        id: generateUUID(),
        clips: [
          {
            id: generateUUID(),
            words: [
              {
                id: generateUUID(),
                text: "안녕하세요",
                startTime: 0,
                duration: 1.0,
                aligned: true,
                type: 0,
                originalDuration: 1.0,
                originalStartTime: 0,
                truncatedWords: [],
                autoControl: false,
                mediaId: "video-uuid",
                audioIds: [],
                assetIds: [],
                playbackRate: 1
              }
            ],
            captionMode: "TRANSCRIPT",
            captions: [
              { text: [{ insert: "안녕하세요\n" }] },
              { text: [{ insert: "\n" }] }
            ],
            assetIds: [],
            audioIds: [],
            dirty: {
              blankDeleted: false,
              caption: false,
              video: false
            },
            translationModified: {
              result: false,
              source: false
            }
          }
        ],
        name: "",
        dirty: { video: false }
      }
    ]
  },

  props: {
    assets: {},
    audios: {},
    overdubInfos: {},
    backgroundMap: {},
    flipSetting: {},
    ttsClipInfosMap: {},

    analyzeDate: new Date().toLocaleString(),
    videoRatio: 16/9,
    videoSize: { width: 1920, height: 1080 },
    initProjectVideoSize: { width: 1920, height: 1080 },

    globalVideoTransform: {
      zoom: 1,
      xPos: 0,
      yPos: 0,
      rotation: 0
    },

    captionDisplayMode: { "0": true, "1": false },

    globalCaptionStyle: {
      captionStyleSetting: {
        mediaId: "uc-0010-simple-textbox",
        yAlign: "bottom",
        yOffset: 0,
        xOffset: 0,
        rotation: 0,
        width: 0.96,
        customAttributes: [
          {
            attributeName: "--textbox-color",
            type: "color-hex",
            value: "rgba(0, 0, 0, 0)"
          },
          {
            attributeName: "--textbox-align",
            type: "textbox-align",
            value: "center"
          }
        ],
        scaleFactor: 16/9
      },
      quillStyle: {
        font: "Pretendard-Vrew_700",
        size: "100",
        color: "#ffffff",
        "outline-on": "true",
        "outline-color": "#000000",
        "outline-width": "6"
      }
    },

    mediaEffectMap: {},
    markerNames: {},

    lastTTSSettings: {
      pitch: 0,
      speed: 1,
      volume: 0,
      speaker: {
        age: "middle",
        gender: "female",
        lang: "ko-KR",
        name: "va19",
        speakerId: "va19",
        provider: "vrew",
        versions: ["v2"],
        tags: ["voice_actor"]
      },
      version: "v2"
    },

    pronunciationDisplay: true,
    projectAudioLanguage: "ko",
    audioLanguagesMap: {},
    originalClipsMap: {}
  },

  statistics: {
    wordCursorCount: {},
    wordSelectionCount: {},
    wordCorrectionCount: {},
    projectStartMode: "video_audio",

    saveInfo: {
      created: {
        version: "3.5.4",
        date: new Date().toISOString(),
        stage: "release"
      },
      updated: {
        version: "3.5.4",
        date: new Date().toISOString(),
        stage: "release"
      },
      loadCount: 0,
      saveCount: 1
    },

    savedStyleApplyCount: 0,
    cumulativeTemplateApplyCount: 0,
    ratioChangedByTemplate: false,
    videoRemixInfos: {},
    isAIWritingUsed: false,

    sttLinebreakOptions: {
      mode: 0,
      maxLineLength: 30
    },
    clientLinebreakExecuteCount: 0,

    agentStats: {
      isEdited: false,
      requestCount: 0,
      responseCount: 0,
      toolCallCount: 0,
      toolErrorCount: 0
    }
  }
};
```

## 핵심 포인트

### ✅ 올바른 구현 (정상 작동)
1. **미디어 파일 포함**: `fileLocation: "IN_MEMORY"`로 설정
2. **ZIP 아카이브**: project.json + media 폴더
3. **UUID 사용**: 모든 ID는 UUID 형식
4. **시간 동기화**: words의 startTime과 duration이 정확해야 함

### ❌ 잘못된 구현 (작동 안 함)
1. **외부 경로 참조**: `fileLocation: "LOCAL"` 사용 시 파일 미포함
2. **미디어 파일 누락**: project.json만 있고 media/ 폴더 없음
3. **잘못된 시간 정보**: words의 타임라인이 맞지 않음
4. **필수 필드 누락**: mediaId, duration 등

## 실제 데이터 예시

양도세 중과유예.vrew 파일 분석 결과:
- **파일 개수**: 6개 (1개 mp3 + 5개 png)
- **총 씬**: 1개
- **총 클립**: 45개
- **비디오 크기**: 1920x1080 (16:9)
- **자막 위치**: 하단 중앙
- **자막 스타일**: 흰색 텍스트, 검은색 외곽선 (6px)
