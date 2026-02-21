/**
 * Node.js에서 Vrew 파일 생성하기
 *
 * 필요한 패키지:
 *   npm install archiver uuid
 */

const fs = require('fs');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class VrewBuilder {
  constructor(width = 1920, height = 1080) {
    this.width = width;
    this.height = height;
    this.ratio = width / height;
    this.projectId = uuidv4();
    this.files = [];
    this.clips = [];
    this.mediaFilesToInclude = [];
  }

  /**
   * 비디오 파일 추가
   */
  addVideo(videoPath, duration, includeInArchive = true) {
    const mediaId = uuidv4();
    const videoName = path.basename(videoPath);
    const ext = path.extname(videoPath).slice(1);

    const fileData = {
      version: 1,
      mediaId,
      sourceOrigin: "USER",
      fileSize: fs.existsSync(videoPath) ? fs.statSync(videoPath).size : 0,
      name: videoName,
      type: "AVMedia",
      videoAudioMetaInfo: {
        videoInfo: {
          size: { width: this.width, height: this.height },
          frameRate: 30.0,
          codec: "h264"
        },
        audioInfo: {
          sampleRate: 44100,
          codec: "aac",
          channelCount: 2
        },
        duration,
        presumedDevice: "unknown",
        mediaContainer: ext
      },
      sourceFileType: "VIDEO_AUDIO"
    };

    if (includeInArchive) {
      fileData.fileLocation = "IN_MEMORY";
      fileData.relativePath = `./${videoName}`;
      this.mediaFilesToInclude.push({ path: videoPath, mediaId, ext });
    } else {
      fileData.fileLocation = "LOCAL";
      fileData.path = path.resolve(videoPath);
      fileData.relativePath = `./${videoName}`;
    }

    this.files.push(fileData);
    return mediaId;
  }

  /**
   * 오디오 파일 추가
   */
  addAudio(audioPath, duration, includeInArchive = true) {
    const mediaId = uuidv4();
    const audioName = path.basename(audioPath);
    const ext = path.extname(audioPath).slice(1);

    const fileData = {
      version: 1,
      mediaId,
      sourceOrigin: "USER",
      fileSize: fs.existsSync(audioPath) ? fs.statSync(audioPath).size : 0,
      name: audioName,
      type: "AVMedia",
      videoAudioMetaInfo: {
        audioInfo: {
          sampleRate: 44100,
          codec: ext,
          channelCount: 1
        },
        duration,
        presumedDevice: "unknown",
        mediaContainer: ext
      },
      sourceFileType: "VIDEO_AUDIO"
    };

    if (includeInArchive) {
      fileData.fileLocation = "IN_MEMORY";
      fileData.relativePath = `./${audioName}`;
      this.mediaFilesToInclude.push({ path: audioPath, mediaId, ext });
    } else {
      fileData.fileLocation = "LOCAL";
      fileData.path = path.resolve(audioPath);
      fileData.relativePath = `./${audioName}`;
    }

    this.files.push(fileData);
    return mediaId;
  }

  /**
   * 이미지 파일 추가
   */
  addImage(imagePath, includeInArchive = true) {
    const mediaId = uuidv4();
    const ext = path.extname(imagePath).slice(1);

    const fileData = {
      version: 1,
      mediaId,
      sourceOrigin: "USER",
      fileSize: fs.existsSync(imagePath) ? fs.statSync(imagePath).size : 0,
      name: `${mediaId}.${ext}`,
      type: "Image",
      isTransparent: false
    };

    if (includeInArchive) {
      fileData.fileLocation = "IN_MEMORY";
      this.mediaFilesToInclude.push({ path: imagePath, mediaId, ext });
    } else {
      fileData.fileLocation = "LOCAL";
      fileData.path = path.resolve(imagePath);
    }

    this.files.push(fileData);
    return mediaId;
  }

  /**
   * 자막 클립 추가
   */
  addClip(text, startTime, duration, mediaId = null) {
    if (!mediaId && this.files.length > 0) {
      mediaId = this.files[0].mediaId;
    }

    const clipId = uuidv4();

    const word = {
      id: uuidv4(),
      text,
      startTime,
      duration,
      aligned: true,
      type: 0,  // 0 = 단어
      originalDuration: duration,
      originalStartTime: startTime,
      truncatedWords: [],
      autoControl: false,
      mediaId: mediaId || "",
      audioIds: [],
      assetIds: [],
      playbackRate: 1
    };

    const endMarker = {
      id: uuidv4(),
      text: "",
      startTime: startTime + duration,
      duration: 0,
      aligned: false,
      type: 2,  // 종료 마커
      originalDuration: 0,
      originalStartTime: startTime + duration,
      truncatedWords: [],
      autoControl: false,
      mediaId: mediaId || "",
      audioIds: [],
      assetIds: [],
      playbackRate: 1
    };

    const clip = {
      id: clipId,
      words: [word, endMarker],
      captionMode: "TRANSCRIPT",
      captions: [
        { text: [{ insert: `${text}\n` }] },
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
    };

    this.clips.push(clip);
    return clipId;
  }

  /**
   * 무음 구간 추가
   */
  addSilence(startTime, duration, mediaId = null) {
    if (!mediaId && this.files.length > 0) {
      mediaId = this.files[0].mediaId;
    }

    const clipId = uuidv4();

    const silenceWord = {
      id: uuidv4(),
      text: "",
      startTime,
      duration,
      aligned: true,
      type: 1,  // 무음
      originalDuration: duration,
      originalStartTime: startTime,
      truncatedWords: [],
      autoControl: false,
      mediaId: mediaId || "",
      audioIds: [],
      assetIds: [],
      playbackRate: 1
    };

    const endMarker = {
      id: uuidv4(),
      text: "",
      startTime: startTime + duration,
      duration: 0,
      aligned: false,
      type: 2,
      originalDuration: 0,
      originalStartTime: startTime + duration,
      truncatedWords: [],
      autoControl: false,
      mediaId: mediaId || "",
      audioIds: [],
      assetIds: [],
      playbackRate: 1
    };

    const clip = {
      id: clipId,
      words: [silenceWord, endMarker],
      captionMode: "TRANSCRIPT",
      captions: [
        { text: [{ insert: "\n" }] },
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
    };

    this.clips.push(clip);
    return clipId;
  }

  /**
   * 프로젝트 JSON 데이터 생성
   */
  build() {
    const now = new Date();
    const isoDate = now.toISOString();

    return {
      version: 15,
      projectId: this.projectId,
      comment: `3.5.4\t${isoDate}`,

      files: this.files,

      transcript: {
        scenes: [
          {
            id: uuidv4(),
            clips: this.clips,
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

        analyzeDate: now.toLocaleString('ko-KR'),
        videoRatio: this.ratio,
        videoSize: { width: this.width, height: this.height },
        initProjectVideoSize: { width: this.width, height: this.height },

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
            scaleFactor: this.ratio
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
            date: isoDate,
            stage: "release"
          },
          updated: {
            version: "3.5.4",
            date: isoDate,
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
  }

  /**
   * .vrew 파일 저장
   */
  async save(outputPath) {
    const projectData = this.build();

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        console.log(`✅ Vrew 파일 생성 완료: ${outputPath}`);
        console.log(`   파일 크기: ${archive.pointer()} bytes`);
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // project.json 추가
      archive.append(
        JSON.stringify(projectData, null, 2),
        { name: 'project.json' }
      );

      // 미디어 파일들 추가
      for (const media of this.mediaFilesToInclude) {
        if (fs.existsSync(media.path)) {
          archive.file(media.path, { name: `media/${media.mediaId}.${media.ext}` });
        } else {
          console.warn(`⚠️  파일을 찾을 수 없음: ${media.path}`);
        }
      }

      archive.finalize();
    });
  }
}

// ==================== 사용 예시 ====================

async function example() {
  console.log("Vrew 파일 생성 시작...\n");

  const builder = new VrewBuilder(1920, 1080);

  // 비디오 추가 (실제 파일 경로로 변경 필요)
  const videoId = builder.addVideo(
    "./sample_video.mp4",
    30.0,  // 30초
    true   // 아카이브에 포함
  );

  // 자막 추가
  builder.addClip("안녕하세요", 0, 2.0, videoId);
  builder.addSilence(2.0, 0.5, videoId);
  builder.addClip("반갑습니다", 2.5, 2.0, videoId);

  // 저장
  await builder.save("output.vrew");
}

// 실행
if (require.main === module) {
  example().catch(console.error);
}

module.exports = VrewBuilder;
