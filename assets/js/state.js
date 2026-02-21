// ================================================================
// STATE - Global Application State Management
// ================================================================

export const AppState = {
    currentModule: 'script',
    scenes: [],
    script: '',
    style: '2D infographic',
    ratio: '16:9',
    resolution: '2K',
    masterCharacterPrompt: '', // 주인공 마스터 이미지 프롬프트

    // ProjectService Reference
    projectService: null,
    setProjectService(service) {
        this.projectService = service;
    },

    _notifyChange() {
        if (this.projectService) {
            this.projectService.notifyChange();
        }
    },

    // 워크플로우 단계별 결과 저장
    audioPath: null,           // TTS 생성된 전체 음성 파일 경로
    youtubeMetadata: null,     // YouTube 메타데이터 (제목, 설명, 태그 등)
    segmentationData: null,    // 오디오 세분화 결과

    currentProjectId: null, // 현재 작업 중인 프로젝트 ID
    generatedShorts: [],   // 생성된 Shorts 목록

    // 자동화 모드 설정
    automation: {
        script: false,      // 스크립트 생성 후 자동 씬 분할
        image: false,       // 씬 분할 후 자동 이미지 생성
        motion: false,      // 이미지 생성 후 자동 모션 프롬프트 & 비디오 변환
        tts: false,         // 스크립트 생성 후 자동 TTS 생성
        video: false        // 모든 에셋 준비 후 자동 영상 생성
    },

    // localStorage 자동 저장 기능
    saveToLocalStorage() {
        try {
            const stateToSave = {
                scenes: this.scenes,
                script: this.script,
                style: this.style,
                ratio: this.ratio,
                resolution: this.resolution,
                masterCharacterPrompt: this.masterCharacterPrompt,
                audioPath: this.audioPath,
                youtubeMetadata: this.youtubeMetadata,
                segmentationData: this.segmentationData,
                currentProjectId: this.currentProjectId,
                generatedShorts: this.generatedShorts,
                automation: this.automation,
                finalVideoUrl: this.finalVideoUrl, // 최종 영상 URL 저장
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('appState', JSON.stringify(stateToSave));
            console.log('💾 AppState 자동 저장 완료');
        } catch (e) {
            console.error('❌ AppState 저장 실패:', e);
        }
    },

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('appState');
            if (saved) {
                const state = JSON.parse(saved);
                this.scenes = state.scenes || [];
                this.script = state.script || '';
                this.style = state.style || '2D infographic';
                this.ratio = state.ratio || '16:9';
                this.resolution = state.resolution || '2K';
                this.masterCharacterPrompt = state.masterCharacterPrompt || '';
                this.audioPath = state.audioPath || null;
                this.youtubeMetadata = state.youtubeMetadata || null;
                this.segmentationData = state.segmentationData || null;
                this.currentProjectId = state.currentProjectId || null;
                this.generatedShorts = state.generatedShorts || [];
                this.automation = { ...this.automation, ...state.automation };
                this.finalVideoUrl = state.finalVideoUrl || null; // 최종 영상 URL 복원

                console.log('📂 AppState 복원 완료:', {
                    scenes: this.scenes.length,
                    hasScript: !!this.script,
                    hasAudioPath: !!this.audioPath,
                    hasMetadata: !!this.youtubeMetadata,
                    generatedShorts: this.generatedShorts.length,
                    savedAt: state.savedAt
                });
                return true;
            }
        } catch (e) {
            console.error('❌ AppState 복원 실패:', e);
        }
        return false;
    },

    clearLocalStorage() {
        localStorage.removeItem('appState');
        console.log('🗑️ AppState localStorage 삭제됨');
    },

    setProjectId(id) {
        this.currentProjectId = id;
        console.log("🆔 Project ID Set:", id);
        this.saveToLocalStorage(); // 자동 저장
    },

    // 새 프로젝트 시작 (모든 데이터 초기화)
    startNewProject() {
        this.scenes = [];
        this.script = '';
        this.style = '2D infographic';
        this.ratio = '16:9';
        this.resolution = '2K';
        this.masterCharacterPrompt = '';
        this.audioPath = null;
        this.youtubeMetadata = null;
        this.segmentationData = null;
        this.currentProjectId = null;
        this.generatedShorts = [];
        this.clearLocalStorage();
        console.log('🆕 새 프로젝트 시작 - 모든 데이터 초기화됨');
    },

    setScenes(scenes) {
        // Data Normalization (Migration from old keys)
        const normalizedScenes = scenes.map(s => {
            const newScene = { ...s };
            // Ensure numeric ID
            if (newScene.sceneId) newScene.sceneId = parseInt(newScene.sceneId);

            // Migrate visualPrompt -> imagePrompt
            if (newScene.visualPrompt && !newScene.imagePrompt) {
                newScene.imagePrompt = newScene.visualPrompt;
            }
            // Migrate script -> originalScript
            if (newScene.script && !newScene.originalScript) {
                newScene.originalScript = newScene.script;
            }
            return newScene;
        });

        this.scenes = normalizedScenes;
        console.log("📦 AppState: Scenes updated (Normalized)", this.scenes.length);
        this.saveToLocalStorage(); // 자동 저장
        this._notifyChange();
    },
    getScenes() { return this.scenes; },

    setScript(text) {
        this.script = text;
        this.saveToLocalStorage(); // 자동 저장
        this._notifyChange();
    },
    getScript() { return this.script; },

    setMasterCharacterPrompt(prompt) {
        this.masterCharacterPrompt = prompt;
        console.log("👤 Master Character Prompt Set");
        this.saveToLocalStorage(); // 자동 저장
        this._notifyChange();
    },
    getMasterCharacterPrompt() { return this.masterCharacterPrompt; },

    setStyle(style) {
        this.style = style;
        this.saveToLocalStorage(); // 자동 저장
        this._notifyChange();
    },
    setRatio(ratio) {
        this.ratio = ratio;
        this.saveToLocalStorage(); // 자동 저장
        this._notifyChange();
    },
    setResolution(res) {
        this.resolution = res;
        this.saveToLocalStorage(); // 자동 저장
        this._notifyChange();
    },

    // 자동화 모드 설정
    setAutomation(module, enabled) {
        this.automation[module] = enabled;
        localStorage.setItem('automation', JSON.stringify(this.automation));
        console.log(`🤖 Automation [${module}]: ${enabled ? 'ON' : 'OFF'}`);
    },
    getAutomation(module) {
        return this.automation[module] || false;
    },
    loadAutomation() {
        const saved = localStorage.getItem('automation');
        if (saved) {
            this.automation = { ...this.automation, ...JSON.parse(saved) };
        }
    },

    // 워크플로우 단계별 결과 관리
    setAudioPath(path) {
        this.audioPath = path;
        console.log('🎵 Audio Path Set:', path);
        this.saveToLocalStorage();
    },
    getAudioPath() {
        return this.audioPath;
    },

    setYoutubeMetadata(metadata) {
        this.youtubeMetadata = metadata;
        console.log('📺 YouTube Metadata Set');
        this.saveToLocalStorage();
    },
    getYoutubeMetadata() {
        return this.youtubeMetadata;
    },

    setSegmentationData(data) {
        this.segmentationData = data;
        console.log('✂️ Segmentation Data Set:', data?.segments?.length || 0, 'segments');
        this.saveToLocalStorage();
    },
    getSegmentationData() {
        return this.segmentationData;
    },

    // 최종 영상 URL 관리
    finalVideoUrl: null,
    setFinalVideoUrl(url) {
        this.finalVideoUrl = url;
        console.log('🎥 Final Video URL Set:', url);
        this.saveToLocalStorage();
    },
    getFinalVideoUrl() {
        return this.finalVideoUrl;
    }
};
