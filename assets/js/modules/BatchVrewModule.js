import { Module } from '../Module.js';
import { API_BASE_URL, CONFIG } from '../config.js';

export class BatchVrewModule extends Module {
    constructor() {
        super('batch-vrew', '배치 Vrew 생성', 'layers', '외부 TTS와 대량 미디어 파일을 자동 매칭하여 Vrew 프로젝트 생성');
        this.taskId = null;
        this.statusInterval = null;
    }

    async onMount() {
        this.setupGuideButton();
        this.attachEventListeners();
    }

    onUnmount() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
    }

    attachEventListeners() {
        // 폴더 방식 생성 버튼
        const folderBtn = document.getElementById('btn-batch-folder');
        if (folderBtn) {
            folderBtn.addEventListener('click', () => this.createFromFolder());
        }

        // 파일 리스트 방식 생성 버튼
        const listBtn = document.getElementById('btn-batch-list');
        if (listBtn) {
            listBtn.addEventListener('click', () => this.createFromList());
        }

        // 파일 리스트 추가 버튼들
        const addAudioBtn = document.getElementById('btn-add-audio');
        const addTimestampBtn = document.getElementById('btn-add-timestamp');
        const addVisualBtn = document.getElementById('btn-add-visual');

        if (addAudioBtn) addAudioBtn.addEventListener('click', () => this.addFileInput('audio'));
        if (addTimestampBtn) addTimestampBtn.addEventListener('click', () => this.addFileInput('timestamp'));
        if (addVisualBtn) addVisualBtn.addEventListener('click', () => this.addFileInput('visual'));

        // 드래그앤드롭 설정
        this.setupDragAndDrop('audio-drop-zone', 'audio-folder');
        this.setupDragAndDrop('timestamp-drop-zone', 'timestamp-folder');
        this.setupDragAndDrop('visual-drop-zone', 'visual-folder');

        // 자동 생성 체크박스 이벤트
        const autoGenCheckbox = document.getElementById('auto-generate-timestamps');
        const timestampFolder = document.getElementById('timestamp-folder');
        const timestampDropZone = document.getElementById('timestamp-drop-zone');
        const timestampRequired = document.getElementById('timestamp-required');

        if (autoGenCheckbox) {
            autoGenCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    // 자동 생성 모드: 타임스탬프 폴더 비활성화
                    timestampFolder.disabled = true;
                    timestampFolder.value = '';
                    timestampFolder.placeholder = 'Whisper가 자동으로 생성합니다';
                    timestampDropZone.classList.add('opacity-50', 'pointer-events-none');
                    if (timestampRequired) timestampRequired.classList.add('hidden');
                } else {
                    // 수동 모드: 타임스탬프 폴더 활성화
                    timestampFolder.disabled = false;
                    timestampFolder.placeholder = '폴더를 드래그하거나 경로 입력';
                    timestampDropZone.classList.remove('opacity-50', 'pointer-events-none');
                    if (timestampRequired) timestampRequired.classList.remove('hidden');
                }
            });
        }
    }

    setupDragAndDrop(dropZoneId, inputId) {
        const dropZone = document.getElementById(dropZoneId);
        const input = document.getElementById(inputId);

        if (!dropZone || !input) return;

        // 드래그 오버 시 스타일
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('border-blue-500', 'bg-blue-500/10');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('border-blue-500', 'bg-blue-500/10');
        });

        // 드롭 처리
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('border-blue-500', 'bg-blue-500/10');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                // 첫 번째 파일의 경로 가져오기
                const file = files[0];
                // 브라우저에서는 보안상 전체 경로를 가져올 수 없으므로
                // 파일명만 표시하고 사용자가 수정하도록 안내
                const path = file.path || file.name; // Electron에서는 file.path 사용 가능
                input.value = path;
            }
        });
    }

    render() {
        return `
            <div class="max-w-7xl mx-auto space-y-8 animate-fade-in">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-3xl font-black text-white tracking-tight mb-2">배치 Vrew 생성</h2>
                        <p class="text-slate-400">외부 TTS와 대량 미디어 파일을 자동으로 매칭하여 Vrew 프로젝트를 생성합니다.</p>
                    </div>
                </div>

                <!-- Status Display -->
                <div id="batch-status" class="hidden bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <i data-lucide="loader-2" class="w-6 h-6 text-blue-400 animate-spin"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-white font-bold mb-1">처리 중...</h3>
                            <p id="batch-status-message" class="text-sm text-slate-400">배치 Vrew 파일 생성 중...</p>
                            <div class="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div id="batch-progress-bar" class="h-full bg-blue-500 transition-all duration-300" style="width: 0%"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Result Display -->
                <div id="batch-result" class="hidden bg-green-500/10 border border-green-500/30 rounded-2xl p-6">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <i data-lucide="check-circle" class="w-6 h-6 text-green-400"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-white font-bold mb-1">생성 완료!</h3>
                            <p class="text-sm text-slate-400 mb-3">Vrew 파일이 성공적으로 생성되었습니다.</p>
                            <a id="batch-download-link" href="#"
                               class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-sm transition-colors">
                                <i data-lucide="download" class="w-4 h-4"></i>
                                <span>다운로드</span>
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Transcript Display (Whisper) -->
                <div id="batch-transcripts" class="hidden bg-purple-500/10 border border-purple-500/30 rounded-2xl p-6">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="file-text" class="w-6 h-6 text-purple-400"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-white font-bold mb-2 flex items-center gap-2">
                                🤖 Whisper 자동 생성 결과
                                <span id="transcript-count" class="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded-full"></span>
                            </h3>
                            <p class="text-sm text-slate-400 mb-4">이미지 번호와 매칭하여 비주얼을 추가하세요.</p>
                            <div id="transcript-list" class="space-y-3 max-h-96 overflow-y-auto">
                                <!-- Transcripts will be inserted here -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Error Display -->
                <div id="batch-error" class="hidden bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                            <i data-lucide="alert-circle" class="w-6 h-6 text-red-400"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-white font-bold mb-1">오류 발생</h3>
                            <p id="batch-error-message" class="text-sm text-slate-400"></p>
                        </div>
                    </div>
                </div>

                <!-- Tab Navigation -->
                <div class="flex gap-2 bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
                    <button id="tab-folder" onclick="switchBatchTab('folder')"
                            class="flex-1 px-6 py-3 rounded-lg font-bold transition-all bg-blue-600/20 text-blue-400 border border-blue-500/30">
                        <i data-lucide="folder" class="w-5 h-5 inline-block mr-2"></i>
                        폴더 방식 (자동 매칭)
                    </button>
                    <button id="tab-list" onclick="switchBatchTab('list')"
                            class="flex-1 px-6 py-3 rounded-lg font-bold transition-all text-slate-400 hover:bg-slate-700/50">
                        <i data-lucide="list" class="w-5 h-5 inline-block mr-2"></i>
                        파일 리스트 방식
                    </button>
                </div>

                <!-- 폴더 방식 Content -->
                <div id="content-folder" class="space-y-6">
                    <div class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8">
                        <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <i data-lucide="folder" class="w-5 h-5 text-blue-400"></i>
                            폴더 경로 입력
                        </h3>
                        <p class="text-sm text-slate-400 mb-6">
                            각 폴더에 넘버링된 파일들(001, 002, 003...)을 넣으면 자동으로 매칭됩니다.
                        </p>

                        <div class="space-y-4">
                            <!-- Audio Folder -->
                            <div>
                                <label class="block text-sm font-bold text-slate-300 mb-2">
                                    오디오 폴더 <span class="text-red-400">*</span>
                                </label>
                                <div class="relative">
                                    <div id="audio-drop-zone"
                                         class="relative w-full px-4 py-8 bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl text-white transition-all hover:border-blue-500 hover:bg-slate-800/50">
                                        <input type="text" id="audio-folder" placeholder="폴더를 드래그하거나 경로 입력"
                                               class="w-full bg-transparent outline-none text-center">
                                        <p class="text-xs text-slate-500 mt-2 text-center">
                                            📁 폴더를 드래그하여 추가하거나 경로를 직접 입력하세요
                                        </p>
                                    </div>
                                    <button onclick="document.getElementById('audio-folder').value=''"
                                            class="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all">
                                        <i data-lucide="x" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Timestamp Folder -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="block text-sm font-bold text-slate-300">
                                        타임스탬프 폴더 <span class="text-red-400" id="timestamp-required">*</span>
                                    </label>
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" id="auto-generate-timestamps"
                                               class="rounded bg-slate-800 border-slate-600 text-purple-600 focus:ring-0">
                                        <span class="text-xs text-purple-400 font-bold">
                                            🤖 Whisper로 자동 생성
                                        </span>
                                    </label>
                                </div>
                                <div class="relative">
                                    <div id="timestamp-drop-zone"
                                         class="relative w-full px-4 py-8 bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl text-white transition-all hover:border-blue-500 hover:bg-slate-800/50">
                                        <input type="text" id="timestamp-folder" placeholder="폴더를 드래그하거나 경로 입력"
                                               class="w-full bg-transparent outline-none text-center">
                                        <p class="text-xs text-slate-500 mt-2 text-center">
                                            📁 폴더를 드래그하여 추가하거나 경로를 직접 입력하세요
                                        </p>
                                    </div>
                                    <button onclick="document.getElementById('timestamp-folder').value=''"
                                            class="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all">
                                        <i data-lucide="x" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Visual Folder (Optional) -->
                            <div>
                                <label class="block text-sm font-bold text-slate-300 mb-2">
                                    비주얼 폴더 <span class="text-slate-500">(선택)</span>
                                </label>
                                <div class="relative">
                                    <div id="visual-drop-zone"
                                         class="relative w-full px-4 py-8 bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl text-white transition-all hover:border-blue-500 hover:bg-slate-800/50">
                                        <input type="text" id="visual-folder" placeholder="폴더를 드래그하거나 경로 입력"
                                               class="w-full bg-transparent outline-none text-center">
                                        <p class="text-xs text-slate-500 mt-2 text-center">
                                            📁 폴더를 드래그하여 추가하거나 경로를 직접 입력하세요
                                        </p>
                                    </div>
                                    <button onclick="document.getElementById('visual-folder').value=''"
                                            class="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all">
                                        <i data-lucide="x" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Output Filename (Optional) -->
                            <div>
                                <label class="block text-sm font-bold text-slate-300 mb-2">
                                    출력 파일명 <span class="text-slate-500">(선택)</span>
                                </label>
                                <input type="text" id="output-filename-folder" placeholder="my_batch.vrew"
                                       class="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition">
                            </div>
                        </div>

                        <button id="btn-batch-folder"
                                class="mt-6 w-full flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20">
                            <i data-lucide="zap" class="w-5 h-5"></i>
                            <span>Vrew 파일 생성</span>
                        </button>
                    </div>

                    <!-- 사용 안내 -->
                    <div class="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6">
                        <h4 class="text-white font-bold mb-3 flex items-center gap-2">
                            <i data-lucide="info" class="w-5 h-5 text-blue-400"></i>
                            폴더 구조 예시
                        </h4>
                        <pre class="text-sm text-slate-300 font-mono bg-slate-900 p-4 rounded-lg overflow-x-auto">
project/
├── audio/
│   ├── 001_scene.mp3
│   ├── 002_scene.mp3
│   └── 003_scene.mp3
├── timestamps/
│   ├── 001_timestamps.json
│   ├── 002_timestamps.json
│   └── 003_timestamps.json
└── visuals/
    ├── 001_image.png
    ├── 002_video.mp4
    └── 003_image.jpg</pre>
                    </div>
                </div>

                <!-- 파일 리스트 방식 Content -->
                <div id="content-list" class="hidden space-y-6">
                    <div class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8">
                        <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <i data-lucide="list" class="w-5 h-5 text-blue-400"></i>
                            파일 리스트 입력
                        </h3>
                        <p class="text-sm text-slate-400 mb-6">
                            각 파일의 전체 경로를 순서대로 입력하세요. (순서가 중요합니다!)
                        </p>

                        <!-- Audio Files -->
                        <div class="mb-6">
                            <div class="flex justify-between items-center mb-3">
                                <label class="text-sm font-bold text-slate-300">
                                    오디오 파일 <span class="text-red-400">*</span>
                                </label>
                                <button id="btn-add-audio"
                                        class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-colors">
                                    + 추가
                                </button>
                            </div>
                            <div id="audio-files-list" class="space-y-2">
                                <input type="text" placeholder="C:/audio/001_audio.mp3"
                                       class="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 outline-none">
                            </div>
                        </div>

                        <!-- Timestamp Files -->
                        <div class="mb-6">
                            <div class="flex justify-between items-center mb-3">
                                <label class="text-sm font-bold text-slate-300">
                                    타임스탬프 파일 <span class="text-red-400">*</span>
                                </label>
                                <button id="btn-add-timestamp"
                                        class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-colors">
                                    + 추가
                                </button>
                            </div>
                            <div id="timestamp-files-list" class="space-y-2">
                                <input type="text" placeholder="C:/timestamps/001_timestamps.json"
                                       class="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 outline-none">
                            </div>
                        </div>

                        <!-- Visual Files (Optional) -->
                        <div class="mb-6">
                            <div class="flex justify-between items-center mb-3">
                                <label class="text-sm font-bold text-slate-300">
                                    비주얼 파일 <span class="text-slate-500">(선택)</span>
                                </label>
                                <button id="btn-add-visual"
                                        class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-colors">
                                    + 추가
                                </button>
                            </div>
                            <div id="visual-files-list" class="space-y-2">
                                <input type="text" placeholder="C:/visuals/001_image.png"
                                       class="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 outline-none">
                            </div>
                        </div>

                        <!-- Output Filename -->
                        <div>
                            <label class="block text-sm font-bold text-slate-300 mb-2">
                                출력 파일명 <span class="text-slate-500">(선택)</span>
                            </label>
                            <input type="text" id="output-filename-list" placeholder="my_batch.vrew"
                                   class="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition">
                        </div>

                        <button id="btn-batch-list"
                                class="mt-6 w-full flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20">
                            <i data-lucide="zap" class="w-5 h-5"></i>
                            <span>Vrew 파일 생성</span>
                        </button>
                    </div>
                </div>
            </div>

            <script>
                // Tab switching
                window.switchBatchTab = function(tab) {
                    const folderTab = document.getElementById('tab-folder');
                    const listTab = document.getElementById('tab-list');
                    const folderContent = document.getElementById('content-folder');
                    const listContent = document.getElementById('content-list');

                    if (tab === 'folder') {
                        folderTab.classList.add('bg-blue-600/20', 'text-blue-400', 'border', 'border-blue-500/30');
                        folderTab.classList.remove('text-slate-400', 'hover:bg-slate-700/50');
                        listTab.classList.remove('bg-blue-600/20', 'text-blue-400', 'border', 'border-blue-500/30');
                        listTab.classList.add('text-slate-400', 'hover:bg-slate-700/50');
                        folderContent.classList.remove('hidden');
                        listContent.classList.add('hidden');
                    } else {
                        listTab.classList.add('bg-blue-600/20', 'text-blue-400', 'border', 'border-blue-500/30');
                        listTab.classList.remove('text-slate-400', 'hover:bg-slate-700/50');
                        folderTab.classList.remove('bg-blue-600/20', 'text-blue-400', 'border', 'border-blue-500/30');
                        folderTab.classList.add('text-slate-400', 'hover:bg-slate-700/50');
                        listContent.classList.remove('hidden');
                        folderContent.classList.add('hidden');
                    }

                    lucide.createIcons();
                }
            </script>
        `;
    }

    addFileInput(type) {
        const container = document.getElementById(`${type}-files-list`);
        if (!container) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = type === 'audio' ? 'C:/audio/002_audio.mp3' :
            type === 'timestamp' ? 'C:/timestamps/002_timestamps.json' :
                'C:/visuals/002_image.png';
        input.className = 'w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 outline-none';
        container.appendChild(input);
    }

    async createFromFolder() {
        const audioFolder = document.getElementById('audio-folder')?.value;
        const timestampFolder = document.getElementById('timestamp-folder')?.value;
        const visualFolder = document.getElementById('visual-folder')?.value;
        const outputFilename = document.getElementById('output-filename-folder')?.value;
        const autoGenerate = document.getElementById('auto-generate-timestamps')?.checked || false;

        if (!audioFolder) {
            alert('오디오 폴더는 필수입니다.');
            return;
        }

        if (!autoGenerate && !timestampFolder) {
            alert('타임스탬프 폴더를 입력하거나 자동 생성 옵션을 선택하세요.');
            return;
        }

        this.hideAllStatus();
        if (autoGenerate) {
            this.showStatus('Whisper로 타임스탬프 자동 생성 중...', 0);
        } else {
            this.showStatus('처리 중...', 0);
        }

        try {
            const res = await fetch('/api/batch-vrew-from-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioFolder,
                    timestampFolder: autoGenerate ? null : timestampFolder,
                    visualFolder: visualFolder || null,
                    outputFilename: outputFilename || null,
                    autoGenerateTimestamps: autoGenerate
                })
            });

            const data = await res.json();

            if (data.success && data.taskId) {
                this.taskId = data.taskId;
                this.startStatusPolling();
            } else {
                throw new Error('작업 생성 실패');
            }

        } catch (error) {
            this.showError(error.message);
        }
    }

    async createFromList() {
        const audioInputs = document.querySelectorAll('#audio-files-list input');
        const timestampInputs = document.querySelectorAll('#timestamp-files-list input');
        const visualInputs = document.querySelectorAll('#visual-files-list input');
        const outputFilename = document.getElementById('output-filename-list')?.value;

        const audioFiles = Array.from(audioInputs).map(i => i.value).filter(v => v);
        const timestampFiles = Array.from(timestampInputs).map(i => i.value).filter(v => v);
        const visualFiles = Array.from(visualInputs).map(i => i.value).filter(v => v);

        if (audioFiles.length === 0 || timestampFiles.length === 0) {
            alert('오디오 파일과 타임스탬프 파일은 최소 1개 이상 필요합니다.');
            return;
        }

        if (audioFiles.length !== timestampFiles.length) {
            alert('오디오 파일과 타임스탬프 파일의 개수가 같아야 합니다.');
            return;
        }

        this.hideAllStatus();
        this.showStatus('처리 중...', 0);

        try {
            const res = await fetch(`${CONFIG.endpoints.batchVrewFromLists}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioFiles,
                    timestampFiles,
                    visualFiles: visualFiles.length > 0 ? visualFiles : null,
                    outputFilename: outputFilename || null
                })
            });

            const data = await res.json();

            if (data.success && data.taskId) {
                this.taskId = data.taskId;
                this.startStatusPolling();
            } else {
                throw new Error('작업 생성 실패');
            }

        } catch (error) {
            this.showError(error.message);
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
                    this.showResult(data.result?.vrewUrl, data.result?.transcripts);
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

    hideAllStatus() {
        document.getElementById('batch-status')?.classList.add('hidden');
        document.getElementById('batch-result')?.classList.add('hidden');
        document.getElementById('batch-transcripts')?.classList.add('hidden');
        document.getElementById('batch-error')?.classList.add('hidden');
    }

    showStatus(message, progress) {
        const statusDiv = document.getElementById('batch-status');
        const messageEl = document.getElementById('batch-status-message');
        const progressBar = document.getElementById('batch-progress-bar');

        if (statusDiv) statusDiv.classList.remove('hidden');
        if (messageEl) messageEl.textContent = message;
        if (progressBar) progressBar.style.width = `${progress}%`;

        lucide.createIcons();
    }

    showResult(vrewUrl, transcripts = null) {
        this.hideAllStatus();
        const resultDiv = document.getElementById('batch-result');
        const downloadLink = document.getElementById('batch-download-link');

        if (resultDiv) resultDiv.classList.remove('hidden');
        if (downloadLink && vrewUrl) {
            downloadLink.href = vrewUrl;
        }

        // Show transcripts if available
        if (transcripts && transcripts.length > 0) {
            this.showTranscripts(transcripts);
        }

        lucide.createIcons();
    }

    showTranscripts(transcripts) {
        const transcriptDiv = document.getElementById('batch-transcripts');
        const transcriptList = document.getElementById('transcript-list');
        const transcriptCount = document.getElementById('transcript-count');

        if (!transcriptDiv || !transcriptList || !transcriptCount) return;

        // Update count
        transcriptCount.textContent = `${transcripts.length}개 씬`;

        // Generate transcript items
        transcriptList.innerHTML = transcripts.map(item => `
            <div class="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                        <span class="text-purple-400 font-bold text-lg">${String(item.index).padStart(3, '0')}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-xs text-slate-400 font-mono">${item.audio_file}</span>
                            <span class="text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full">
                                ${item.timestamp_count}개 단어
                            </span>
                        </div>
                        <p class="text-sm text-slate-200 leading-relaxed break-words">${item.text}</p>
                    </div>
                </div>
            </div>
        `).join('');

        transcriptDiv.classList.remove('hidden');
        lucide.createIcons();
    }

    showError(message) {
        this.hideAllStatus();
        const errorDiv = document.getElementById('batch-error');
        const messageEl = document.getElementById('batch-error-message');

        if (errorDiv) errorDiv.classList.remove('hidden');
        if (messageEl) messageEl.textContent = message;

        lucide.createIcons();
    }
}
