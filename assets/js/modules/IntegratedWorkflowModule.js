// ================================================================
// INTEGRATED WORKFLOW MODULE - 통합 워크플로우
// 전체 제작 과정을 한 화면에서 관리
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { API_BASE_URL, CONFIG } from '../config.js';
import { DownloadHelper } from '../utils/download.js';

export class IntegratedWorkflowModule extends Module {
    constructor() {
        super('integrated-workflow', '통합 워크플로우', 'workflow', '전체 제작 과정을 한 화면에서 단계별로 관리합니다');

        // 현재 단계 (1-6)
        this.currentStep = 1;

        // 워크플로우 데이터
        this.workflowData = {
            // Step 1: 대본 → TTS
            script: '',
            scenes: [],

            // Step 2: 오디오 세분화
            audioFile: null,
            segments: [],
            sessionFolder: null,

            // Step 3: 이미지 프롬프트 & 생성
            imageStyle: 'stickman',
            generatedImages: [],

            // Step 4: 모션 프롬프트 & 생성
            motionPrompts: [],
            generatedVideos: [],

            // Step 5: 최종 합성
            finalOutput: null
        };

        // 작업 ID 추적
        this.taskIds = {
            segmentation: null,
            imageGeneration: null,
            motionGeneration: null,
            composition: null
        };

        // 폴링 인터벌
        this.intervals = {};
    }

    async onMount() {
        this.setupGuideButton();
        this.attachEventListeners();
        this.renderCurrentStep();
    }

    onUnmount() {
        // 모든 인터벌 정리
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
    }

    attachEventListeners() {
        // Step navigation
        const btnNext = document.getElementById('btn-next-step');
        const btnPrev = document.getElementById('btn-prev-step');

        if (btnNext) {
            btnNext.addEventListener('click', () => this.nextStep());
        }

        if (btnPrev) {
            btnPrev.addEventListener('click', () => this.previousStep());
        }

        // Step 1: Script → TTS
        this.setupStep1Listeners();

        // Step 2: Audio Segmentation
        this.setupStep2Listeners();

        // Step 3: Image Generation
        this.setupStep3Listeners();

        // Step 4: Motion Generation
        this.setupStep4Listeners();

        // Step 5: Final Composition
        this.setupStep5Listeners();
    }

    setupStep1Listeners() {
        const btnGenerateTTS = document.getElementById('btn-workflow-generate-tts');
        if (btnGenerateTTS) {
            btnGenerateTTS.addEventListener('click', () => this.generateTTSFromScript());
        }

        const btnDownloadTTS = document.getElementById('btn-workflow-download-tts');
        if (btnDownloadTTS) {
            btnDownloadTTS.addEventListener('click', () => this.downloadTTSResults());
        }
    }

    setupStep2Listeners() {
        const fileInput = document.getElementById('workflow-audio-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleAudioUpload(e));
        }

        const btnSegment = document.getElementById('btn-workflow-segment');
        if (btnSegment) {
            btnSegment.addEventListener('click', () => this.startSegmentation());
        }

        const btnDownloadSegments = document.getElementById('btn-workflow-download-segments');
        if (btnDownloadSegments) {
            btnDownloadSegments.addEventListener('click', () => this.downloadSegments());
        }
    }

    setupStep3Listeners() {
        const btnGenerateImagePrompts = document.getElementById('btn-workflow-image-prompts');
        if (btnGenerateImagePrompts) {
            btnGenerateImagePrompts.addEventListener('click', () => this.generateImagePrompts());
        }

        const btnGenerateImages = document.getElementById('btn-workflow-generate-images');
        if (btnGenerateImages) {
            btnGenerateImages.addEventListener('click', () => this.generateImages());
        }

        const btnDownloadImages = document.getElementById('btn-workflow-download-images');
        if (btnDownloadImages) {
            btnDownloadImages.addEventListener('click', () => this.downloadImages());
        }
    }

    setupStep4Listeners() {
        const btnGenerateMotionPrompts = document.getElementById('btn-workflow-motion-prompts');
        if (btnGenerateMotionPrompts) {
            btnGenerateMotionPrompts.addEventListener('click', () => this.generateMotionPrompts());
        }

        const btnGenerateMotion = document.getElementById('btn-workflow-generate-motion');
        if (btnGenerateMotion) {
            btnGenerateMotion.addEventListener('click', () => this.generateMotionVideos());
        }

        const btnDownloadMotion = document.getElementById('btn-workflow-download-motion');
        if (btnDownloadMotion) {
            btnDownloadMotion.addEventListener('click', () => this.downloadMotionResults());
        }
    }

    setupStep5Listeners() {
        const btnComposeVrew = document.getElementById('btn-workflow-compose-vrew');
        if (btnComposeVrew) {
            btnComposeVrew.addEventListener('click', () => this.createVrewProject());
        }
    }

    // ================================================================
    // STEP NAVIGATION
    // ================================================================

    nextStep() {
        if (this.currentStep < 5) {
            this.currentStep++;
            this.renderCurrentStep();
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.renderCurrentStep();
        }
    }

    renderCurrentStep() {
        const container = document.getElementById('workflow-steps-container');
        if (!container) return;

        container.innerHTML = this.renderStepContent(this.currentStep);

        // Re-attach listeners for the new step
        this.attachEventListeners();

        // Update progress indicator
        this.updateProgressIndicator();

        lucide.createIcons();
    }

    updateProgressIndicator() {
        for (let i = 1; i <= 5; i++) {
            const indicator = document.getElementById(`step-indicator-${i}`);
            if (indicator) {
                if (i < this.currentStep) {
                    indicator.className = 'w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold';
                } else if (i === this.currentStep) {
                    indicator.className = 'w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold animate-pulse';
                } else {
                    indicator.className = 'w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold';
                }
            }
        }
    }

    // ================================================================
    // STEP 1: SCRIPT → TTS
    // ================================================================

    async generateTTSFromScript() {
        const scriptInput = document.getElementById('workflow-script-input');
        const script = scriptInput?.value.trim();

        if (!script) {
            alert('대본을 입력하세요.');
            return;
        }

        this.showStepStatus(1, 'TTS 생성 중...', 0);

        try {
            // Use ScriptModule logic to split scenes and generate TTS
            // For now, simple implementation
            alert('TTS 생성 기능은 기존 TTS 모듈을 사용하세요.\n통합 워크플로우에서는 기존 모듈의 결과를 가져와 사용합니다.');

        } catch (error) {
            this.showStepError(1, error.message);
        }
    }

    async downloadTTSResults() {
        const scenes = AppState.getScenes().filter(s => s.audioUrl);

        if (scenes.length === 0) {
            alert('다운로드할 TTS 파일이 없습니다.');
            return;
        }

        try {
            const files = [];

            for (const scene of scenes) {
                files.push({
                    filename: `scene_${String(scene.sceneId).padStart(3, '0')}.mp3`,
                    url: scene.audioUrl
                });
            }

            await DownloadHelper.downloadAsZip(files, `workflow_tts_${Date.now()}.zip`);
            alert(`✅ ${scenes.length}개 TTS 파일 다운로드 완료`);

        } catch (error) {
            alert(`다운로드 실패: ${error.message}`);
        }
    }

    // ================================================================
    // STEP 2: AUDIO SEGMENTATION
    // ================================================================

    handleAudioUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.workflowData.audioFile = file;

        const fileInfo = document.getElementById('workflow-audio-file-info');
        if (fileInfo) {
            fileInfo.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        }
    }

    async startSegmentation() {
        if (!this.workflowData.audioFile) {
            alert('오디오 파일을 먼저 업로드하세요.');
            return;
        }

        this.showStepStatus(2, '세분화 중...', 0);

        try {
            const formData = new FormData();
            formData.append('file', this.workflowData.audioFile);

            const res = await fetch(`${CONFIG.endpoints.segmentAudio}`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (data.success && data.taskId) {
                this.taskIds.segmentation = data.taskId;
                this.startSegmentationPolling();
            } else {
                throw new Error(data.error || '세분화 작업 생성 실패');
            }

        } catch (error) {
            this.showStepError(2, error.message);
        }
    }

    startSegmentationPolling() {
        if (this.intervals.segmentation) {
            clearInterval(this.intervals.segmentation);
        }

        this.intervals.segmentation = setInterval(async () => {
            try {
                const res = await fetch(`${CONFIG.endpoints.tasks}/${this.taskIds.segmentation}`);
                const data = await res.json();

                if (data.status === 'completed') {
                    clearInterval(this.intervals.segmentation);
                    this.handleSegmentationComplete(data.result);
                } else if (data.status === 'failed') {
                    clearInterval(this.intervals.segmentation);
                    this.showStepError(2, data.error || '세분화 실패');
                } else {
                    this.showStepStatus(2, data.message || '처리 중...', data.progress || 50);
                }
            } catch (error) {
                clearInterval(this.intervals.segmentation);
                this.showStepError(2, '상태 확인 실패');
            }
        }, 1000);
    }

    handleSegmentationComplete(result) {
        this.workflowData.segments = result.segments || [];
        this.workflowData.sessionFolder = result.sessionFolder;

        this.showStepSuccess(2, `${this.workflowData.segments.length}개 구간으로 세분화 완료`);

        // Update UI
        this.renderSegmentsPreview();
    }

    renderSegmentsPreview() {
        const container = document.getElementById('workflow-segments-preview');
        if (!container) return;

        container.innerHTML = `
            <div class="space-y-2">
                <h4 class="text-sm font-bold text-white">세분화 결과 (${this.workflowData.segments.length}개)</h4>
                ${this.workflowData.segments.slice(0, 3).map(seg => `
                    <div class="text-xs text-slate-400">
                        ${seg.index}. ${seg.text} (${seg.startTime.toFixed(1)}s ~ ${seg.endTime.toFixed(1)}s)
                    </div>
                `).join('')}
                ${this.workflowData.segments.length > 3 ? `<div class="text-xs text-slate-500">... 외 ${this.workflowData.segments.length - 3}개</div>` : ''}
            </div>
        `;
    }

    async downloadSegments() {
        if (this.workflowData.segments.length === 0) {
            alert('세분화된 데이터가 없습니다.');
            return;
        }

        const data = this.workflowData.segments.map(seg => ({
            index: seg.index,
            text: seg.text,
            startTime: seg.startTime,
            endTime: seg.endTime
        }));

        DownloadHelper.downloadJSON(data, `workflow_segments_${Date.now()}.json`);
        alert('✅ 세분화 데이터 다운로드 완료');
    }

    // ================================================================
    // STEP 3: IMAGE GENERATION
    // ================================================================

    async generateImagePrompts() {
        if (this.workflowData.segments.length === 0) {
            alert('먼저 오디오를 세분화하세요.');
            return;
        }

        this.showStepStatus(3, '이미지 프롬프트 생성 중...', 0);

        try {
            const styleSelect = document.getElementById('workflow-image-style');
            const imageStyle = styleSelect?.value || 'stickman';

            const scenes = this.workflowData.segments.map(s => ({
                sceneId: s.index,
                script: s.text
            }));
            const imgSettings = {
                stylePrompt: imageStyle
            };

            const res = await fetch(`${CONFIG.endpoints.imagePromptsBatch}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenes, imgSettings })
            });

            const data = await res.json();

            if (data.success && data.prompts) {
                // Update segments with image prompts
                data.prompts.forEach(p => {
                    const segment = this.workflowData.segments.find(s => s.index === p.sceneId);
                    if (segment) {
                        segment.imagePrompt = p.imagePrompt;
                    }
                });

                this.showStepSuccess(3, `${data.prompts.length}개 프롬프트 생성 완료`);
                this.renderImagePromptsPreview();
            } else {
                throw new Error(data.error || '프롬프트 생성 실패');
            }

        } catch (error) {
            this.showStepError(3, error.message);
        }
    }

    renderImagePromptsPreview() {
        const container = document.getElementById('workflow-image-prompts-preview');
        if (!container) return;

        const promptSegments = this.workflowData.segments.filter(s => s.imagePrompt);

        container.innerHTML = `
            <div class="space-y-2">
                <h4 class="text-sm font-bold text-white">이미지 프롬프트 (${promptSegments.length}개)</h4>
                ${promptSegments.slice(0, 2).map(seg => `
                    <div class="text-xs text-slate-400">
                        ${seg.index}. ${seg.imagePrompt.substring(0, 60)}...
                    </div>
                `).join('')}
                ${promptSegments.length > 2 ? `<div class="text-xs text-slate-500">... 외 ${promptSegments.length - 2}개</div>` : ''}
            </div>
        `;
    }

    async generateImages() {
        alert('이미지 생성은 기존 이미지 모듈을 사용하세요.\n생성된 이미지는 자동으로 워크플로우에 반영됩니다.');
    }

    async downloadImages() {
        const scenesWithImages = this.workflowData.segments.filter(s => s.generatedUrl);

        if (scenesWithImages.length === 0) {
            alert('생성된 이미지가 없습니다.');
            return;
        }

        try {
            const files = [];

            for (const scene of scenesWithImages) {
                files.push({
                    filename: `scene_${String(scene.index).padStart(3, '0')}.png`,
                    url: scene.generatedUrl
                });
            }

            await DownloadHelper.downloadAsZip(files, `workflow_images_${Date.now()}.zip`);
            alert(`✅ ${scenesWithImages.length}개 이미지 다운로드 완료`);

        } catch (error) {
            alert(`다운로드 실패: ${error.message}`);
        }
    }

    // ================================================================
    // STEP 4: MOTION GENERATION
    // ================================================================

    async generateMotionPrompts() {
        const scenesWithPrompts = this.workflowData.segments.filter(s => s.imagePrompt);

        if (scenesWithPrompts.length === 0) {
            alert('먼저 이미지 프롬프트를 생성하세요.');
            return;
        }

        this.showStepStatus(4, '모션 프롬프트 생성 중...', 0);

        try {
            const scenes = scenesWithPrompts.map(s => ({
                sceneId: s.index,
                originalScript: s.text,
                imagePrompt: s.imagePrompt
            }));

            const res = await fetch(`${API_BASE_URL}/api/generate-motion-prompts-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenes })
            });

            const data = await res.json();

            if (data.success && data.prompts) {
                data.prompts.forEach(p => {
                    const segment = this.workflowData.segments.find(s => s.index === p.sceneId);
                    if (segment) {
                        segment.motionPrompt = p.motionPrompt;
                    }
                });

                this.showStepSuccess(4, `${data.prompts.length}개 모션 프롬프트 생성 완료`);
                this.renderMotionPromptsPreview();
            } else {
                throw new Error(data.error || '모션 프롬프트 생성 실패');
            }

        } catch (error) {
            this.showStepError(4, error.message);
        }
    }

    renderMotionPromptsPreview() {
        const container = document.getElementById('workflow-motion-prompts-preview');
        if (!container) return;

        const motionSegments = this.workflowData.segments.filter(s => s.motionPrompt);

        container.innerHTML = `
            <div class="space-y-2">
                <h4 class="text-sm font-bold text-white">모션 프롬프트 (${motionSegments.length}개)</h4>
                ${motionSegments.slice(0, 3).map(seg => `
                    <div class="text-xs text-slate-400">
                        ${seg.index}. ${seg.motionPrompt}
                    </div>
                `).join('')}
                ${motionSegments.length > 3 ? `<div class="text-xs text-slate-500">... 외 ${motionSegments.length - 3}개</div>` : ''}
            </div>
        `;
    }

    async generateMotionVideos() {
        alert('모션 영상 생성은 기존 모션 모듈을 사용하세요.\n생성된 영상은 자동으로 워크플로우에 반영됩니다.');
    }

    async downloadMotionResults() {
        const prompts = this.workflowData.segments
            .filter(s => s.motionPrompt)
            .map(s => ({
                sceneId: s.index,
                motionPrompt: s.motionPrompt
            }));

        if (prompts.length === 0) {
            alert('모션 프롬프트가 없습니다.');
            return;
        }

        DownloadHelper.downloadJSON(prompts, `workflow_motion_prompts_${Date.now()}.json`);
        alert('✅ 모션 프롬프트 다운로드 완료');
    }

    // ================================================================
    // STEP 5: FINAL COMPOSITION
    // ================================================================

    async createVrewProject() {
        if (!this.workflowData.sessionFolder) {
            alert('세분화된 오디오 폴더가 없습니다.');
            return;
        }

        this.showStepStatus(5, 'Vrew 프로젝트 생성 중...', 0);

        try {
            const res = await fetch(`${CONFIG.endpoints.batchVrew}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioFolder: this.workflowData.sessionFolder,
                    timestampFolder: this.workflowData.sessionFolder,
                    autoGenerateTimestamps: false,
                    outputFilename: `workflow_vrew_${Date.now()}.vrew`
                })
            });

            const data = await res.json();

            if (data.success && data.taskId) {
                // 비동기 작업 - taskId를 받았으므로 폴링 시작
                this.taskIds.composition = data.taskId;
                await this.pollVrewComposition(data.taskId);
            } else {
                throw new Error(data.error || 'Vrew 생성 실패');
            }

        } catch (error) {
            this.showStepError(5, error.message);
        }
    }

    async pollVrewComposition(taskId) {
        const poll = async () => {
            try {
                const res = await fetch(`${CONFIG.endpoints.tasks}/${taskId}`);
                const task = await res.json();

                if (task.status === 'completed') {
                    if (task.result && task.result.vrewUrl) {
                        this.workflowData.finalOutput = task.result.vrewUrl;
                        this.showStepSuccess(5, 'Vrew 프로젝트 생성 완료!');
                        this.renderFinalOutput();
                    } else {
                        throw new Error('Vrew URL이 없습니다.');
                    }
                } else if (task.status === 'failed') {
                    throw new Error(task.error || 'Vrew 생성 실패');
                } else {
                    // 여전히 진행 중
                    const progress = task.progress || 0;
                    this.showStepStatus(5, task.message || 'Vrew 프로젝트 생성 중...', progress);
                    setTimeout(poll, 1000); // 1초 후 재확인
                }
            } catch (error) {
                this.showStepError(5, error.message);
            }
        };

        poll();
    }

    renderFinalOutput() {
        const container = document.getElementById('workflow-final-output');
        if (!container || !this.workflowData.finalOutput) return;

        container.innerHTML = `
            <div class="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
                <div class="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="check" class="w-8 h-8 text-white"></i>
                </div>
                <h3 class="text-xl font-bold text-white mb-2">🎉 워크플로우 완료!</h3>
                <p class="text-sm text-slate-400 mb-4">Vrew 프로젝트가 생성되었습니다.</p>
                <a href="${this.workflowData.finalOutput}" download
                   class="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-all">
                    <i data-lucide="download" class="w-5 h-5"></i>
                    <span>Vrew 파일 다운로드</span>
                </a>
            </div>
        `;

        lucide.createIcons();
    }

    // ================================================================
    // STATUS HELPERS
    // ================================================================

    showStepStatus(step, message, progress) {
        const statusDiv = document.getElementById(`step-${step}-status`);
        if (!statusDiv) return;

        statusDiv.innerHTML = `
            <div class="flex items-center gap-3 text-blue-400">
                <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
                <span class="text-sm">${message}</span>
            </div>
            <div class="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500 transition-all" style="width: ${progress}%"></div>
            </div>
        `;
        statusDiv.classList.remove('hidden');
        lucide.createIcons();
    }

    showStepSuccess(step, message) {
        const statusDiv = document.getElementById(`step-${step}-status`);
        if (!statusDiv) return;

        statusDiv.innerHTML = `
            <div class="flex items-center gap-3 text-green-400">
                <i data-lucide="check-circle" class="w-4 h-4"></i>
                <span class="text-sm">${message}</span>
            </div>
        `;
        statusDiv.classList.remove('hidden');
        lucide.createIcons();
    }

    showStepError(step, message) {
        const statusDiv = document.getElementById(`step-${step}-status`);
        if (!statusDiv) return;

        statusDiv.innerHTML = `
            <div class="flex items-center gap-3 text-red-400">
                <i data-lucide="alert-circle" class="w-4 h-4"></i>
                <span class="text-sm">${message}</span>
            </div>
        `;
        statusDiv.classList.remove('hidden');
        lucide.createIcons();
    }

    // ================================================================
    // RENDER
    // ================================================================

    render() {
        return `
            <div class="max-w-6xl mx-auto space-y-6 animate-fade-in">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-3xl font-black text-white tracking-tight mb-2">통합 워크플로우</h2>
                        <p class="text-slate-400">전체 제작 과정을 한 화면에서 단계별로 관리합니다</p>
                    </div>
                    ${this.renderGuideButton()}
                </div>

                <!-- Progress Steps -->
                ${this.renderProgressSteps()}

                <!-- Steps Container -->
                <div id="workflow-steps-container">
                    ${this.renderStepContent(this.currentStep)}
                </div>

                <!-- Navigation -->
                ${this.renderNavigation()}
            </div>
        `;
    }

    renderProgressSteps() {
        const steps = [
            { num: 1, name: 'TTS 생성', icon: 'mic-2' },
            { num: 2, name: '세분화', icon: 'scissors' },
            { num: 3, name: '이미지', icon: 'image' },
            { num: 4, name: '모션', icon: 'video' },
            { num: 5, name: '합성', icon: 'film' }
        ];

        return `
            <div class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
                <div class="flex items-center justify-between">
                    ${steps.map((step, idx) => `
                        <div class="flex items-center ${idx < steps.length - 1 ? 'flex-1' : ''}">
                            <div class="flex flex-col items-center">
                                <div id="step-indicator-${step.num}"
                                     class="w-10 h-10 rounded-full ${step.num === this.currentStep ? 'bg-blue-600 animate-pulse' : step.num < this.currentStep ? 'bg-green-600' : 'bg-slate-700'} flex items-center justify-center text-white font-bold">
                                    ${step.num}
                                </div>
                                <span class="mt-2 text-xs ${step.num === this.currentStep ? 'text-blue-400 font-bold' : 'text-slate-500'}">${step.name}</span>
                            </div>
                            ${idx < steps.length - 1 ? `<div class="flex-1 h-0.5 mx-2 ${step.num < this.currentStep ? 'bg-green-600' : 'bg-slate-700'}"></div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderStepContent(step) {
        switch (step) {
            case 1: return this.renderStep1();
            case 2: return this.renderStep2();
            case 3: return this.renderStep3();
            case 4: return this.renderStep4();
            case 5: return this.renderStep5();
            default: return '';
        }
    }

    renderStep1() {
        return `
            <div class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 space-y-6">
                <h3 class="text-xl font-bold text-white flex items-center gap-2">
                    <i data-lucide="mic-2" class="w-6 h-6 text-blue-400"></i>
                    Step 1: 대본 입력 및 TTS 생성
                </h3>

                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-300 mb-2">대본 입력</label>
                        <textarea id="workflow-script-input"
                                  class="w-full h-40 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:border-blue-500 outline-none"
                                  placeholder="제작할 영상의 대본을 입력하세요..."></textarea>
                    </div>

                    <div class="flex gap-3">
                        <button id="btn-workflow-generate-tts"
                                class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                            <i data-lucide="mic-2" class="w-4 h-4"></i>
                            TTS 생성
                        </button>
                        <button id="btn-workflow-download-tts"
                                class="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                            <i data-lucide="download" class="w-4 h-4"></i>
                            다운로드
                        </button>
                    </div>

                    <div id="step-1-status" class="hidden"></div>
                </div>

                <div class="border-t border-slate-700 pt-4">
                    <p class="text-xs text-slate-500">
                        💡 팁: 기존 TTS 모듈에서 생성한 결과를 자동으로 가져올 수 있습니다.
                    </p>
                </div>
            </div>
        `;
    }

    renderStep2() {
        return `
            <div class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 space-y-6">
                <h3 class="text-xl font-bold text-white flex items-center gap-2">
                    <i data-lucide="scissors" class="w-6 h-6 text-purple-400"></i>
                    Step 2: 오디오 세분화
                </h3>

                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-300 mb-2">MP3 파일 업로드</label>
                        <input type="file" id="workflow-audio-input" accept=".mp3,.wav,.m4a"
                               class="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer">
                        <p id="workflow-audio-file-info" class="text-xs text-slate-500 mt-2"></p>
                    </div>

                    <div class="flex gap-3">
                        <button id="btn-workflow-segment"
                                class="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                            <i data-lucide="scissors" class="w-4 h-4"></i>
                            세분화 시작
                        </button>
                        <button id="btn-workflow-download-segments"
                                class="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                            <i data-lucide="download" class="w-4 h-4"></i>
                            결과 다운로드
                        </button>
                    </div>

                    <div id="step-2-status" class="hidden"></div>
                    <div id="workflow-segments-preview"></div>
                </div>
            </div>
        `;
    }

    renderStep3() {
        return `
            <div class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 space-y-6">
                <h3 class="text-xl font-bold text-white flex items-center gap-2">
                    <i data-lucide="image" class="w-6 h-6 text-pink-400"></i>
                    Step 3: 이미지 프롬프트 및 생성
                </h3>

                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-300 mb-2">화풍 선택</label>
                        <select id="workflow-image-style"
                                class="w-full px-4 py-2 bg-slate-900 border border-slate-700 text-white rounded-lg focus:border-pink-500 outline-none">
                            <option value="stickman">스틱맨 (기본)</option>
                            <option value="animation">애니메이션</option>
                            <option value="watercolor">수채화</option>
                            <option value="webtoon">웹툰</option>
                        </select>
                    </div>

                    <div class="flex gap-3">
                        <button id="btn-workflow-image-prompts"
                                class="px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                            <i data-lucide="wand-2" class="w-4 h-4"></i>
                            프롬프트 생성
                        </button>
                        <button id="btn-workflow-generate-images"
                                class="px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                            <i data-lucide="image" class="w-4 h-4"></i>
                            이미지 생성
                        </button>
                        <button id="btn-workflow-download-images"
                                class="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                            <i data-lucide="download" class="w-4 h-4"></i>
                            다운로드
                        </button>
                    </div>

                    <div id="step-3-status" class="hidden"></div>
                    <div id="workflow-image-prompts-preview"></div>
                </div>
            </div>
        `;
    }

    renderStep4() {
        return `
            <div class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 space-y-6">
                <h3 class="text-xl font-bold text-white flex items-center gap-2">
                    <i data-lucide="video" class="w-6 h-6 text-orange-400"></i>
                    Step 4: 모션 프롬프트 및 생성
                </h3>

                <div class="space-y-4">
                    <div class="flex gap-3">
                        <button id="btn-workflow-motion-prompts"
                                class="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                            <i data-lucide="wand-2" class="w-4 h-4"></i>
                            모션 프롬프트 생성
                        </button>
                        <button id="btn-workflow-generate-motion"
                                class="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                            <i data-lucide="video" class="w-4 h-4"></i>
                            모션 영상 생성
                        </button>
                        <button id="btn-workflow-download-motion"
                                class="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                            <i data-lucide="download" class="w-4 h-4"></i>
                            다운로드
                        </button>
                    </div>

                    <div id="step-4-status" class="hidden"></div>
                    <div id="workflow-motion-prompts-preview"></div>
                </div>
            </div>
        `;
    }

    renderStep5() {
        return `
            <div class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 space-y-6">
                <h3 class="text-xl font-bold text-white flex items-center gap-2">
                    <i data-lucide="film" class="w-6 h-6 text-green-400"></i>
                    Step 5: 최종 합성
                </h3>

                <div class="space-y-4">
                    <div class="flex gap-3">
                        <button id="btn-workflow-compose-vrew"
                                class="px-8 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 flex items-center gap-2 text-lg">
                            <i data-lucide="film" class="w-6 h-6"></i>
                            Vrew 프로젝트 생성
                        </button>
                    </div>

                    <div id="step-5-status" class="hidden"></div>
                    <div id="workflow-final-output"></div>
                </div>

                <div class="border-t border-slate-700 pt-4">
                    <p class="text-xs text-slate-500">
                        🎉 마지막 단계입니다! Vrew 파일을 생성하여 편집을 시작하세요.
                    </p>
                </div>
            </div>
        `;
    }

    renderNavigation() {
        return `
            <div class="flex justify-between items-center">
                <button id="btn-prev-step"
                        ${this.currentStep === 1 ? 'disabled' : ''}
                        class="px-6 py-3 ${this.currentStep === 1 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-white'} rounded-lg font-bold transition-all flex items-center gap-2">
                    <i data-lucide="chevron-left" class="w-4 h-4"></i>
                    이전 단계
                </button>

                <div class="text-sm text-slate-500">
                    Step ${this.currentStep} / 5
                </div>

                <button id="btn-next-step"
                        ${this.currentStep === 5 ? 'disabled' : ''}
                        class="px-6 py-3 ${this.currentStep === 5 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'} rounded-lg font-bold transition-all flex items-center gap-2">
                    다음 단계
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>
        `;
    }
}
