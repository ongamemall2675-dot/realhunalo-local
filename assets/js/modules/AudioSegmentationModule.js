import { Module } from '../Module.js';
import { API_BASE_URL, CONFIG } from '../config.js';
import { AppState } from '../state.js';

/**
 * 타임스탬프를 SRT 형식으로 변환
 * @param {Array} timestamps - [{text, start, end}] 형식의 타임스탬프 배열
 * @returns {string} SRT 형식 문자열
 */
function timestampsToSRT(timestamps) {
    if (!timestamps || timestamps.length === 0) return '';

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    };

    return timestamps.map((ts, index) => {
        const start = formatTime(ts.start || 0);
        const end = formatTime(ts.end || (ts.start + 1));
        const text = ts.text || '';
        return `${index + 1}\n${start} --> ${end}\n${text}\n`;
    }).join('\n');
}

export class AudioSegmentationModule extends Module {
    constructor() {
        super('audio-segmentation', '3. 오디오 분석 & 프롬프트', 'scissors', '오디오 세분화 및 AI 프롬프트 생성');
        this.taskId = null;
        this.statusInterval = null;
        this.segments = [];
        this.sessionFolder = null;
        this.serverAudioPath = null;
    }

    async onMount() {
        this.setupGuideButton();
        this.attachEventListeners();

        // Check for server-side audio from previous step (TTS)
        const audioPath = AppState.getAudioPath();
        if (audioPath) {
            console.log('✅ TTS 오디오 자동 로드:', audioPath);
            this.handleServerFile(audioPath);
        } else {
            console.log('ℹ️ TTS 오디오 없음 - 수동 업로드 옵션 사용');
        }
    }

    onUnmount() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
    }

    attachEventListeners() {
        // 파일 입력 이벤트
        const fileInput = document.getElementById('audio-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // 드래그 앤 드롭
        const dropZone = document.getElementById('audio-drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-blue-500', 'bg-blue-500/10');
            });

            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-blue-500', 'bg-blue-500/10');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-blue-500', 'bg-blue-500/10');

                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileUpload(files[0]);
                }
            });

            dropZone.addEventListener('click', () => {
                fileInput.click();
            });
        }

        // 세분화 버튼 (Server File)
        const btnServerSegment = document.getElementById('btn-segment-server-audio');
        if (btnServerSegment) {
            btnServerSegment.addEventListener('click', () => this.startSegmentationFromPath());
        }

        // 세분화 버튼 (Upload File)
        const segmentBtn = document.getElementById('btn-segment-audio');
        if (segmentBtn) {
            segmentBtn.addEventListener('click', () => this.startSegmentation());
        }


        // 이미지 프롬프트 생성 버튼
        const generatePromptsBtn = document.getElementById('btn-generate-prompts');
        if (generatePromptsBtn) {
            generatePromptsBtn.addEventListener('click', () => this.generateImagePrompts());
        }

        // 프롬프트 다운로드 버튼 (TXT)
        const downloadPromptsBtn = document.getElementById('btn-download-prompts');
        if (downloadPromptsBtn) {
            downloadPromptsBtn.addEventListener('click', () => this.downloadPromptsTxt());
        }

        // Vrew 생성 버튼
        const createVrewBtn = document.getElementById('btn-create-vrew');
        if (createVrewBtn) {
            createVrewBtn.addEventListener('click', () => this.createVrewProject());
        }
    }

    handleServerFile(path) {
        this.serverAudioPath = path;

        // UI Switch
        const uploadSection = document.getElementById('upload-section');
        const serverFileSection = document.getElementById('server-file-section');
        const serverFilePathEl = document.getElementById('server-file-path');
        const serverAudioPlayer = document.getElementById('server-audio-player');

        if (uploadSection) uploadSection.classList.add('hidden');
        if (serverFileSection) serverFileSection.classList.remove('hidden');

        if (serverFilePathEl) serverFilePathEl.textContent = path.split(/[/\\]/).pop(); // Show filename only

        // Set audio player source
        if (serverAudioPlayer && path) {
            const filename = path.split(/[/\\]/).pop();
            const baseUrl = API_BASE_URL || 'http://localhost:8000';
            const normalizedPath = String(path).replace(/\\/g, '/');
            const outputMarker = '/output/';
            const outputIdx = normalizedPath.indexOf(outputMarker);
            const audioUrl = outputIdx !== -1
                ? `${baseUrl}/output/${normalizedPath.substring(outputIdx + outputMarker.length)}`
                : `${baseUrl}/output/${filename}`;

            console.log('🎵 Audio player setting up:');
            console.log('  - Path:', path);
            console.log('  - Filename:', filename);
            console.log('  - URL:', audioUrl);

            serverAudioPlayer.src = audioUrl;
            serverAudioPlayer.load(); // 명시적으로 로드

            // 로드 확인
            serverAudioPlayer.addEventListener('loadedmetadata', () => {
                console.log('✅ Audio loaded successfully');
                console.log('  - Duration:', serverAudioPlayer.duration, 'seconds');
            }, { once: true });

            serverAudioPlayer.addEventListener('error', (e) => {
                console.error('❌ Audio load failed:');
                console.error('  - URL:', audioUrl);
                console.error('  - Error:', serverAudioPlayer.error);
                alert(`오디오 로드 실패!\n\n파일: ${filename}\n경로: ${audioUrl}\n\n백엔드 서버(port 8000)가 실행 중인지 확인하세요.`);
            }, { once: true });
        }

        lucide.createIcons();
    }

    async startSegmentationFromPath() {
        if (!this.serverAudioPath) {
            alert('오디오 파일 경로가 없습니다.');
            return;
        }

        this.hideAllStatus();
        this.showStatus('서버 파일 처리 중...', 0);

        try {
            console.log('[SEGMENT] Starting from path:', this.serverAudioPath);

            const res = await fetch(`${API_BASE_URL}/api/segment-audio-from-path`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioPath: this.serverAudioPath,
                    maxChars: 50,
                    originalScript: AppState.getScript() || ''
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`서버 오류 (${res.status}): ${errorText}`);
            }

            const data = await res.json();
            if (data.success && data.taskId) {
                this.taskId = data.taskId;
                console.log('[SEGMENT] Task ID:', this.taskId);
                this.startStatusPolling();
            } else {
                throw new Error(data.error || '세분화 작업 생성 실패');
            }

        } catch (error) {
            console.error('[SEGMENT] Failed:', error);
            this.showError(`세분화 실패: ${error.message}`);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFileUpload(file);
        }
    }

    handleFileUpload(file) {
        // 파일 형식 검증
        const validExtensions = ['.mp3', '.wav', '.m4a'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            alert('오디오 파일(.mp3, .wav, .m4a)만 업로드 가능합니다.');
            return;
        }

        // 파일 크기 검증 (25MB)
        const maxSize = 25 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('파일 크기는 25MB 이하여야 합니다.');
            return;
        }

        this.selectedFile = file;

        // UI 업데이트
        const fileNameDisplay = document.getElementById('selected-file-name');
        const fileSizeDisplay = document.getElementById('selected-file-size');
        const uploadSection = document.getElementById('upload-section');
        const fileInfoSection = document.getElementById('file-info-section');

        if (fileNameDisplay) fileNameDisplay.textContent = file.name;
        if (fileSizeDisplay) fileSizeDisplay.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

        if (uploadSection) uploadSection.classList.add('hidden');
        if (fileInfoSection) fileInfoSection.classList.remove('hidden');

        lucide.createIcons();
    }

    async startSegmentation() {
        if (!this.selectedFile) {
            alert('파일을 먼저 업로드하세요.');
            return;
        }

        this.hideAllStatus();
        this.showStatus('파일 업로드 중...', 0);

        try {
            console.log('[UPLOAD] Starting file upload:', this.selectedFile.name);

            const formData = new FormData();
            formData.append('file', this.selectedFile);
            formData.append('originalScript', document.getElementById('script-input-area').value);

            console.log('[UPLOAD] Sending to API...');

            // API 호출
            const res = await fetch(`${CONFIG.endpoints.segmentAudio}`, {
                method: 'POST',
                body: formData
            });

            console.log('[UPLOAD] Response status:', res.status);

            if (!res.ok) {
                const errorText = await res.text();
                console.error('[UPLOAD] Error response:', errorText);
                throw new Error(`서버 오류 (${res.status}): ${errorText}`);
            }

            const data = await res.json();
            console.log('[UPLOAD] Response data:', data);

            if (data.success && data.taskId) {
                this.taskId = data.taskId;
                console.log('[UPLOAD] Task ID:', this.taskId);
                this.startStatusPolling();
            } else {
                throw new Error(data.error || '세분화 작업 생성 실패');
            }

        } catch (error) {
            console.error('[UPLOAD] Upload failed:', error);
            this.showError(`업로드 실패: ${error.message}`);
        }
    }

    startStatusPolling() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }

        this.statusInterval = setInterval(async () => {
            try {
                const res = await fetch(`${CONFIG.endpoints.tasks}/${this.taskId}`);
                const data = await res.json();

                if (data.status === 'completed') {
                    clearInterval(this.statusInterval);
                    this.handleSegmentationComplete(data.result);
                } else if (data.status === 'failed') {
                    clearInterval(this.statusInterval);
                    this.showError(data.error || '알 수 없는 오류');
                } else {
                    this.showStatus(data.message || '처리 중...', data.progress || 0);
                }
            } catch (error) {
                clearInterval(this.statusInterval);
                this.showError('상태 확인 실패');
            }
        }, 1000);
    }

    handleSegmentationComplete(result) {
        this.hideAllStatus();

        this.segments = result.segments || [];
        this.sessionFolder = result.sessionFolder;

        // Save to AppState for ImageModule and VideoModule
        const currentScenes = this.segments.map(seg => {
            // 🔧 sessionFolder를 상대 경로로 변환
            // 절대 경로(C:\...\output\segments\session_xxx)를 상대 경로(segments/session_xxx)로 변환
            let relativeSessionFolder = result.sessionFolder;
            if (relativeSessionFolder.includes('output')) {
                // "output" 이후의 경로만 추출
                const parts = relativeSessionFolder.split(/[/\\]output[/\\]/);
                relativeSessionFolder = parts.length > 1 ? parts[1].replace(/\\/g, '/') : relativeSessionFolder;
            }

            // 오디오 파일 URL 생성 (서버 경로를 URL로 변환)
            const audioFileName = seg.audioPath.split(/[/\\]/).pop();
            const baseUrl = API_BASE_URL || 'http://localhost:8000';
            // Logic 2.0: Use media fragments for playback
            const fragment = `#t=${seg.startTime},${seg.endTime}`;
            const audioUrl = `${baseUrl}/output/${relativeSessionFolder}/${audioFileName}${fragment}`;

            // 타임스탬프 파일 경로
            const timestampFileName = seg.timestampPath ? seg.timestampPath.split(/[/\\]/).pop() : null;
            const timestampUrl = timestampFileName ? `${baseUrl}/output/${relativeSessionFolder}/${timestampFileName}` : null;

            console.log(`🎵 Scene ${seg.index} Audio URL:`, audioUrl);

            // SRT 데이터 생성 (VideoModule이 기대하는 형식)
            const srtData = seg.timestamps && seg.timestamps.length > 0
                ? timestampsToSRT(seg.timestamps.map(ts => ({
                    text: ts.text,
                    start: ts.start_ms ? ts.start_ms / 1000 : 0,
                    end: ts.end_ms ? ts.end_ms / 1000 : 0
                })))
                : timestampsToSRT([{
                    text: seg.text,
                    start: seg.startTime,
                    end: seg.endTime
                }]);

            return {
                sceneId: seg.index,
                originalScript: seg.text,
                scriptForTTS: seg.text,
                imagePrompt: '',  // Will be generated in ImageModule manually
                motionPrompt: '',  // Will be generated in ImageModule manually

                // 타임스탬프 정보 (VideoModule에서 사용)
                timestamp: { start: seg.startTime, end: seg.endTime },
                whisperStart: seg.startTime,
                whisperEnd: seg.endTime,
                whisperDuration: seg.endTime - seg.startTime,

                // 오디오 정보 (VideoModule에서 사용)
                audioUrl: audioUrl,
                audioPath: seg.audioPath,
                audioDuration: seg.endTime - seg.startTime,

                // SRT 형식 타임스탬프 (VideoModule/Vrew 호환)
                srtData: srtData,

                // Whisper 단어별 타임스탬프 (있는 경우)
                timestamps: seg.timestamps || [],
                timestampPath: timestampUrl
            };
        });

        AppState.setScenes(currentScenes);
        // Store session folder (no separate updateState needed)
        this.sessionFolder = result.sessionFolder;

        console.log('✅ Segmentation complete:', result);
        console.log(`📊 ${this.segments.length} scenes created with timestamps and audio`);

        // 첫 번째 씬의 데이터 구조 확인 (디버깅용)
        if (currentScenes.length > 0) {
            console.log('📋 Scene #1 데이터 샘플:', {
                sceneId: currentScenes[0].sceneId,
                audioUrl: currentScenes[0].audioUrl,
                whisperDuration: currentScenes[0].whisperDuration,
                srtDataLength: currentScenes[0].srtData?.length || 0,
                timestampsCount: currentScenes[0].timestamps?.length || 0
            });
        }

        // UI에 마스터 캐릭터 프롬프트 렌더링
        const promptView = document.getElementById('master-character-prompt-view');
        const resultSection = document.getElementById('result-section');

        if (resultSection) {
            resultSection.classList.remove('hidden');
        }

        if (result.masterCharacterPrompt) {
            AppState.setMasterCharacterPrompt(result.masterCharacterPrompt);
        }

        if (promptView) {
            if (result.masterCharacterPrompt && Array.isArray(result.masterCharacterPrompt) && result.masterCharacterPrompt.length > 0) {
                const formattedPrompt = result.masterCharacterPrompt.map(char =>
                    `[${char.type}] ${char.name}:\n${char.description}`
                ).join('\n\n');
                promptView.value = formattedPrompt;
                promptView.classList.remove('text-emerald-100', 'placeholder-emerald-800/50');
                promptView.classList.add('text-white', 'font-medium');
            } else {
                promptView.value = "대본에서 캐릭터 특징을 추출할 수 없거나, 서버에서 프롬프트 추출에 실패했습니다.";
                promptView.classList.add('text-slate-400');
            }
        }

        // Show completion message
        this.showCompletionMessage(this.segments.length);

        // Auto-route to ImageModule after 4 seconds (increased to allow reading prompt)
        setTimeout(() => {
            console.log('🎨 Auto-routing to Image & Motion Module...');
            window.app.route('image');
        }, 4000);
    }

    showCompletionMessage(sceneCount) {
        this.hideAllStatus();

        const container = document.getElementById('segmentation-container');
        if (!container) return;

        container.innerHTML = `
            <div class="max-w-2xl mx-auto text-center space-y-6 slide-up">
                <div class="p-8 bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-500/30 rounded-2xl">
                    <div class="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
                        <i data-lucide="check-circle" class="w-12 h-12 text-green-400"></i>
                    </div>
                    
                    <h2 class="text-2xl font-bold text-white mb-3">
                        오디오 세분화 완료!
                    </h2>
                    
                    <p class="text-slate-300 text-lg mb-2">
                        총 <span class="text-green-400 font-bold">${sceneCount}개</span>의 장면으로 나누었습니다
                    </p>
                    
                    <p class="text-sm text-slate-400">
                        이제 이미지 & 모션 생성 모듈로 이동합니다...
                    </p>
                    
                    <div class="mt-6">
                        <div class="inline-block px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg">
                            <div class="flex items-center gap-2 text-blue-300">
                                <i data-lucide="loader" class="w-4 h-4 animate-spin"></i>
                                <span class="text-sm">자동 전환 중...</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <button 
                    onclick="window.app.route('image')" 
                    class="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2 mx-auto"
                >
                    <i data-lucide="image" class="w-5 h-5"></i>
                    <span>지금 바로 이동하기</span>
                </button>
            </div>
        `;

        lucide.createIcons();
    }

    renderSegmentsTable() {
        const tbody = document.getElementById('segments-table-body');
        if (!tbody) return;

        tbody.innerHTML = this.segments.map(segment => `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/30 transition">
                <td class="px-4 py-3 text-center">
                    <span class="inline-block w-12 h-12 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                        <span class="text-purple-400 font-bold">${String(segment.index).padStart(3, '0')}</span>
                    </span>
                </td>
                <td class="px-4 py-3">
                    <textarea 
                        class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none resize-none"
                        rows="2"
                        data-segment-index="${segment.index}"
                        data-field="text"
                    >${segment.text}</textarea>
                </td>
                <td class="px-4 py-3 text-center text-sm text-slate-400">
                    ${segment.startTime.toFixed(2)}s ~ ${segment.endTime.toFixed(2)}s
                </td>
                <td class="px-4 py-3">
                    <textarea 
                        class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-blue-500 outline-none resize-none font-mono"
                        rows="3"
                        placeholder="이미지 프롬프트 (자동 생성 또는 수동 입력)"
                        data-segment-index="${segment.index}"
                        data-field="imagePrompt"
                    >${segment.imagePrompt || ''}</textarea>
                </td>
            </tr>
        `).join('');

        // 텍스트 변경 이벤트
        tbody.querySelectorAll('textarea').forEach(textarea => {
            textarea.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.segmentIndex);
                const field = e.target.dataset.field;
                const segment = this.segments.find(s => s.index === index);
                if (segment) {
                    segment[field] = e.target.value;
                }
            });
        });
    }

    async generateImagePrompts() {
        if (!this.segments || this.segments.length === 0) {
            alert('먼저 오디오를 세분화하세요.');
            return;
        }

        this.hideAllStatus();
        this.showStatus('이미지 프롬프트 생성 중...', 0);

        const pollTask = (taskId, onProgress) => new Promise((resolve, reject) => {
            const iv = setInterval(async () => {
                try {
                    const res = await fetch(`${CONFIG.endpoints.tasks}/${taskId}`);
                    const data = await res.json();
                    if (data.status === 'completed') {
                        clearInterval(iv);
                        resolve(data.result);
                    } else if (data.status === 'failed') {
                        clearInterval(iv);
                        reject(new Error(data.error || '알 수 없는 오류'));
                    } else {
                        onProgress(data.progress || 0);
                    }
                } catch (e) {
                    clearInterval(iv);
                    reject(e);
                }
            }, 1000);
        });

        try {
            // 화풍 선택 (ImageModule과 호환성 유지)
            const styleSelect = document.getElementById('image-style-select');
            const imageStyle = styleSelect ? styleSelect.value : 'none';
            // Note: In real app, STYLE_CATEGORIES would be imported, but for simplicity we pass the raw value
            const stylePrompt = imageStyle !== 'none' ? imageStyle : '';

            // API 호출 (ImageModule 통합 백엔드 API 호환용 페이로드 구성)
            const scenes = this.segments.map(s => ({
                sceneId: s.index,
                script: s.text
            }));

            const res = await fetch(`${CONFIG.endpoints.imagePromptsBatch}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scenes: scenes,
                    settings: { stylePrompt: stylePrompt }
                })
            });

            if (!res.ok) throw new Error('프롬프트 생성 요청 실패');

            const { taskId } = await res.json();
            if (!taskId) throw new Error('Task ID를 받지 못했습니다');

            const result = await pollTask(taskId, (pct) => {
                this.showStatus(`이미지 프롬프트 생성 중... ${pct}%`, pct);
            });

            if (result && result.prompts) {
                // 프롬프트를 segments에 반영
                result.prompts.forEach(p => {
                    const segment = this.segments.find(s => s.index === p.sceneId);
                    if (segment) {
                        segment.imagePrompt = p.imagePrompt;
                    }
                });

                // 테이블 다시 렌더링
                this.renderSegmentsTable();

                this.hideAllStatus();
                this.showSuccess(`${result.prompts.length}개 프롬프트 생성 완료!`);
            } else {
                throw new Error('프롬프트 생성 결과가 비어있습니다.');
            }

        } catch (error) {
            this.showError(error.message);
        }
    }

    downloadPromptsTxt() {
        if (!this.segments || this.segments.length === 0) {
            alert('다운로드할 세분화 데이터가 없습니다.');
            return;
        }

        let txtContent = `=================================================\n`;
        txtContent += `🎬 Scene Prompt List\n`;
        txtContent += `=================================================\n\n`;

        this.segments.forEach(seg => {
            const indexStr = String(seg.index).padStart(3, '0');
            const timeStr = `${seg.startTime.toFixed(2)}s ~ ${seg.endTime.toFixed(2)}s`;

            txtContent += `[${indexStr}] (${timeStr})\n`;
            txtContent += `📝 Script: ${seg.text}\n`;
            txtContent += `🎨 Image Prompt: ${seg.imagePrompt || '(None)'}\n`;
            txtContent += `🎥 Video Prompt: ${seg.videoPrompt || '(None)'}\n`;
            txtContent += `-------------------------------------------------\n\n`;
        });

        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prompts_list_${Date.now()}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    }

    async createVrewProject() {
        if (!this.segments || this.segments.length === 0) {
            alert('먼저 오디오를 세분화하세요.');
            return;
        }

        if (!this.sessionFolder) {
            alert('세션 폴더 정보가 없습니다.');
            return;
        }

        this.hideAllStatus();
        this.showStatus('Vrew 프로젝트 생성 중...', 0);

        try {
            // API 호출
            const res = await fetch(`${CONFIG.endpoints.batchVrew}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioFolder: this.sessionFolder,
                    timestampFolder: this.sessionFolder,  // 같은 폴더에 타임스탬프 있음
                    autoGenerateTimestamps: false,        // 이미 생성됨
                    outputFilename: `vrew_${Date.now()}.vrew`
                })
            });

            const data = await res.json();

            if (data.success && data.taskId) {
                // TaskManager 폴링
                this.vrewTaskId = data.taskId;
                this.startVrewStatusPolling();
            } else {
                throw new Error(data.error || 'Vrew 생성 작업 시작 실패');
            }

        } catch (error) {
            this.showError(error.message);
        }
    }

    startVrewStatusPolling() {
        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`${CONFIG.endpoints.tasks}/${this.vrewTaskId}`);
                const data = await res.json();

                if (data.status === 'completed') {
                    clearInterval(pollInterval);
                    this.handleVrewComplete(data.result);
                } else if (data.status === 'failed') {
                    clearInterval(pollInterval);
                    this.showError(data.error || 'Vrew 생성 실패');
                } else {
                    this.showStatus(data.message || 'Vrew 생성 중...', data.progress || 50);
                }
            } catch (error) {
                clearInterval(pollInterval);
                this.showError('Vrew 상태 확인 실패');
            }
        }, 1000);
    }

    handleVrewComplete(result) {
        this.hideAllStatus();

        const vrewUrl = result.vrewUrl || result.url;
        const projectName = result.projectName || 'Vrew 프로젝트';

        // 성공 메시지 + 다운로드 링크
        const successDiv = document.getElementById('segmentation-success');
        const messageEl = document.getElementById('segmentation-success-message');

        if (successDiv && messageEl) {
            successDiv.classList.remove('hidden');
            messageEl.innerHTML = `
                <span class="block font-bold mb-2">${projectName} 생성 완료!</span>
                <a href="${vrewUrl}" download class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-all">
                    <i data-lucide="download" class="w-4 h-4"></i>
                    <span>Vrew 파일 다운로드</span>
                </a>
            `;
            lucide.createIcons();
        }

        console.log('Vrew project created:', result);
    }


    hideAllStatus() {
        document.getElementById('segmentation-status')?.classList.add('hidden');
        document.getElementById('segmentation-error')?.classList.add('hidden');
        document.getElementById('segmentation-success')?.classList.add('hidden');
    }

    showStatus(message, progress) {
        const statusDiv = document.getElementById('segmentation-status');
        const messageEl = document.getElementById('segmentation-status-message');
        const progressBar = document.getElementById('segmentation-progress-bar');

        if (statusDiv) statusDiv.classList.remove('hidden');
        if (messageEl) messageEl.textContent = message;
        if (progressBar) progressBar.style.width = `${progress}%`;

        lucide.createIcons();
    }

    showError(message) {
        this.hideAllStatus();
        const errorDiv = document.getElementById('segmentation-error');
        const messageEl = document.getElementById('segmentation-error-message');

        if (errorDiv) errorDiv.classList.remove('hidden');
        if (messageEl) messageEl.textContent = message;

        lucide.createIcons();
    }

    showSuccess(message) {
        this.hideAllStatus();
        const successDiv = document.getElementById('segmentation-success');
        const messageEl = document.getElementById('segmentation-success-message');

        if (successDiv) successDiv.classList.remove('hidden');
        if (messageEl) messageEl.textContent = message;

        lucide.createIcons();
    }

    render() {
        return `
            <div class="max-w-7xl mx-auto space-y-8 animate-fade-in">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-3xl font-black text-white tracking-tight mb-2">3. 오디오 분석 & 프롬프트 (Whisper)</h2>
                        <p class="text-slate-400">오디오를 30자 단위로 자동 세분화하여 영상 씬을 생성합니다.</p>
                    </div>
                    <div>
                         <button id="btn-download-prompts" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="download" class="w-4 h-4"></i> 프롬프트 다운로드 (TXT)
                        </button>
                    </div>
                </div>

                <!-- Status Display -->
                <div id="segmentation-status" class="hidden bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <i data-lucide="loader-2" class="w-6 h-6 text-blue-400 animate-spin"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-white font-bold mb-1">처리 중...</h3>
                            <p id="segmentation-status-message" class="text-sm text-slate-400">오디오 세분화 중...</p>
                            <div class="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div id="segmentation-progress-bar" class="h-full bg-blue-500 transition-all duration-300" style="width: 0%"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Success Display -->
                <div id="segmentation-success" class="hidden bg-green-500/10 border border-green-500/30 rounded-2xl p-6">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <i data-lucide="check-circle" class="w-6 h-6 text-green-400"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-white font-bold mb-1">완료!</h3>
                            <p id="segmentation-success-message" class="text-sm text-slate-400"></p>
                        </div>
                    </div>
                </div>

                <!-- Error Display -->
                <div id="segmentation-error" class="hidden bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                            <i data-lucide="alert-circle" class="w-6 h-6 text-red-400"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-white font-bold mb-1">오류 발생</h3>
                            <p id="segmentation-error-message" class="text-sm text-slate-400"></p>
                        </div>
                    </div>
                </div>

                <!-- 1. Server File Section (Auto-detected) -->
                <div id="server-file-section" class="hidden bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-500/30 rounded-2xl p-8 mb-8">
                     <div class="flex items-center justify-between">
                        <div class="flex items-center gap-6">
                            <div class="p-4 bg-indigo-500/20 rounded-2xl text-indigo-400">
                                <i data-lucide="file-audio" class="w-8 h-8"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-white mb-2">생성된 오디오 파일 감지됨</h3>
                                <p id="server-file-path" class="text-sm text-slate-400 font-mono bg-slate-900/50 px-3 py-1 rounded-lg inline-block border border-slate-700/50">filename.mp3</p>
                                <div class="mt-4">
                                     <audio id="server-audio-player" controls class="h-8 w-64"></audio>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col gap-2">
                            <button id="btn-segment-server-audio" class="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-3">
                                <i data-lucide="scissors" class="w-5 h-5"></i>
                                <span>이 파일로 세분화 시작</span>
                            </button>
                            <button onclick="document.getElementById('server-file-section').classList.add('hidden'); document.getElementById('upload-section').classList.remove('hidden');" class="text-xs text-slate-500 hover:text-slate-300 underline text-center">
                                다른 파일 업로드하기
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 2. Upload Section (Fallback) -->
                <div id="upload-section" class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8">
                     <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <i data-lucide="upload" class="w-5 h-5 text-blue-400"></i>
                        MP3 파일 직접 업로드
                    </h3>
                    
                    <div id="audio-drop-zone" class="relative w-full px-8 py-16 bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl text-white transition-all hover:border-blue-500 hover:bg-slate-800/50 cursor-pointer">
                        <div class="text-center">
                            <i data-lucide="music" class="w-16 h-16 text-slate-600 mx-auto mb-4"></i>
                            <p class="text-lg font-bold mb-2">파일을 드래그하거나 클릭하여 업로드</p>
                            <p class="text-sm text-slate-500">MP3, WAV, M4A 지원 (최대 25MB)</p>
                        </div>
                        <input type="file" id="audio-file-input" class="hidden" accept=".mp3,.wav,.m4a">
                    </div>
                </div>

                <!-- 3. Script Input Section (Optional) -->
                <div class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 mb-8">
                     <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <i data-lucide="file-text" class="w-5 h-5 text-green-400"></i>
                        원본 대본 입력 (선택)
                    </h3>
                    <p class="text-sm text-slate-400 mb-4">
                        대본을 입력하면 문장 부호를 기준으로 오디오를 더 정확하게 나눕니다.
                    </p>
                    <textarea 
                        id="script-input-area" 
                        class="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 focus:border-green-500 outline-none resize-none"
                        placeholder="여기에 원본 대본을 붙여넣으세요..."
                    ></textarea>
                </div>

                <!-- File Info Section -->
                <div id="file-info-section" class="hidden bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center">
                                <i data-lucide="file-audio" class="w-6 h-6 text-blue-400"></i>
                            </div>
                            <div>
                                <p id="selected-file-name" class="text-white font-bold"></p>
                                <p id="selected-file-size" class="text-sm text-slate-400"></p>
                            </div>
                        </div>
                        <button id="btn-segment-audio" class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                            <i data-lucide="scissors" class="w-5 h-5"></i>
                            <span>세분화 시작</span>
                        </button>
                    </div>
                </div>

                <!-- Result Section -->
                <div id="result-section" class="hidden space-y-6">
                    <!-- Master Character Prompt Section (NEW) -->
                    <div class="bg-gradient-to-r from-emerald-900/40 to-teal-900/20 border border-emerald-500/30 rounded-2xl p-6 shadow-lg shadow-emerald-500/5 relative overflow-hidden">
                        <!-- Decorative background element -->
                        <div class="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                        
                        <div class="flex items-start gap-4 relative z-10">
                            <div class="p-3 bg-emerald-500/20 rounded-xl">
                                <i data-lucide="user-check" class="w-6 h-6 text-emerald-400"></i>
                            </div>
                            <div class="flex-1">
                                <h3 class="text-lg font-bold text-emerald-300 flex items-center gap-2 mb-2">
                                    마스터 캐릭터 프롬프트 (Master Character Prompt)
                                </h3>
                                <p class="text-xs text-emerald-400/80 mb-3">
                                    AI가 대본 전체 문맥을 분석해 추출한 일관된 주인공 외형 묘사입니다. 
                                </p>
                                <textarea
                                    id="master-character-prompt-view"
                                    class="w-full bg-slate-900/80 border border-emerald-500/20 rounded-lg p-4 text-emerald-100 placeholder-emerald-800/50 text-sm focus:border-emerald-400 outline-none resize-none transition-colors"
                                    rows="3"
                                    readonly
                                    placeholder="오디오 분석이 완료되면 여기에 표시됩니다..."
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- Image Style Selection -->
                    <div class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="text-lg font-bold text-white mb-1">이미지 프롬프트 생성</h3>
                                <p class="text-sm text-slate-400">화풍을 선택하고 프롬프트를 자동 생성하세요</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <select id="image-style-select" class="px-4 py-2 bg-slate-900 border border-slate-700 text-white rounded-lg focus:border-blue-500 outline-none">
                                    <option value="none">기본 스타일</option>
                                    <option value="watercolor">수채화</option>
                                    <option value="animation">애니메이션</option>
                                    <option value="stickman">스틱맨</option>
                                    <option value="webtoon">웹툰</option>
                                </select>
                                <button id="btn-generate-prompts" class="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                                    <i data-lucide="wand-2" class="w-4 h-4"></i>
                                    <span>프롬프트 생성</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Segments Table -->
                    <div class="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
                        <div class="p-6 border-b border-slate-700/50">
                            <h3 class="text-lg font-bold text-white">세분화 결과</h3>
                            <p class="text-sm text-slate-400 mt-1">각 씬의 텍스트와 이미지 프롬프트를 확인하고 수정할 수 있습니다</p>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead class="bg-slate-700/30">
                                    <tr>
                                        <th class="px-4 py-3 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">씬</th>
                                        <th class="px-4 py-3 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">텍스트</th>
                                        <th class="px-4 py-3 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">타임스탬프</th>
                                        <th class="px-4 py-3 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">이미지 프롬프트</th>
                                    </tr>
                                </thead>
                                <tbody id="segments-table-body">
                                    <!-- Segments will be inserted here -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex justify-end gap-3">
                        <button id="btn-create-vrew" class="px-8 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 flex items-center gap-2">
                            <i data-lucide="film" class="w-5 h-5"></i>
                            <span>Vrew 프로젝트 생성</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}
