// ================================================================
// SHORTS EDIT MODULE - 쇼츠 편집실
// 9:16 세로 포맷 전용 영상 편집
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG } from '../config.js';

export class ShortsEditModule extends Module {
    constructor() {
        super('shorts-edit', '쇼츠 편집실', 'smartphone', '9:16 세로 포맷 Shorts 영상 편집 및 생성');

        // 자막 설정 (기본값)
        this.subtitleSettings = {
            enabled: true,
            fontFamily: 'Pretendard-Vrew_700',
            fontSize: 120,  // 쇼츠는 폰트 크기가 더 큼
            fontColor: '#ffffff',
            outlineEnabled: true,
            outlineColor: '#000000',
            outlineWidth: 8,  // 쇼츠는 외곽선이 더 두꺼움
            position: 'center',  // 쇼츠는 중앙 배치 권장
            alignment: 'center'
        };

        // 현재 편집 중인 쇼츠
        this.currentShorts = [];
    }

    render() {
        // AppState에서 생성된 쇼츠 가져오기
        const generatedShorts = AppState.generatedShorts || [];

        if (generatedShorts.length === 0) {
            return `
                <div class="max-w-4xl mx-auto slide-up">
                    <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-8 text-center">
                        <i data-lucide="alert-triangle" class="w-16 h-16 text-yellow-400 mx-auto mb-4"></i>
                        <h2 class="text-2xl font-bold text-white mb-2">생성된 Shorts가 없습니다</h2>
                        <p class="text-slate-400 mb-6">먼저 Shorts 변환 모듈에서 Shorts를 생성하세요.</p>
                        <button id="btn-go-to-shorts" class="bg-pink-600 hover:bg-pink-500 text-white px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 mx-auto">
                            <i data-lucide="arrow-left" class="w-5 h-5"></i>
                            Shorts 변환으로 이동
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="max-w-6xl mx-auto slide-up space-y-6">
                <!-- User Guide Button -->
                ${this.renderGuideButton()}

                <!-- Header Info -->
                <div class="bg-gradient-to-r from-pink-900/30 to-purple-900/30 border border-pink-500/30 rounded-2xl p-6">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="p-3 bg-pink-500/20 rounded-lg text-pink-400">
                                <i data-lucide="smartphone" class="w-6 h-6"></i>
                            </div>
                            <div>
                                <h2 class="text-xl font-bold text-white">📱 Shorts 편집실</h2>
                                <p class="text-sm text-slate-400">${generatedShorts.length}개의 Shorts를 편집하고 영상으로 생성하세요</p>
                            </div>
                        </div>
                        <div class="text-sm bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700">
                            <span class="text-slate-400">포맷:</span>
                            <span class="font-bold text-pink-400 ml-2">9:16 세로</span>
                        </div>
                    </div>
                </div>

                <!-- 자막 설정 -->
                ${this.renderSubtitleSettings()}

                <!-- Shorts 목록 -->
                ${this.renderShortsList(generatedShorts)}

                <!-- 생성 버튼 -->
                ${this.renderGenerateButton(generatedShorts)}

                <!-- 진행 상황 표시 -->
                <div id="task-progress-container" class="hidden bg-slate-800/60 border border-blue-500/50 rounded-2xl p-6">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="p-3 bg-blue-500/20 rounded-lg text-blue-400 animate-pulse">
                            <i data-lucide="loader-2" class="w-6 h-6"></i>
                        </div>
                        <div class="flex-1">
                            <h3 id="task-progress-title" class="text-lg font-bold text-white mb-1">영상 생성 중...</h3>
                            <p id="task-progress-message" class="text-sm text-slate-400">준비 중...</p>
                        </div>
                        <div id="task-progress-percent" class="text-2xl font-bold text-blue-400">0%</div>
                    </div>
                    <div class="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div id="task-progress-bar" class="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                </div>

                <!-- 결과 표시 -->
                <div id="result-container" class="hidden"></div>
            </div>
        `;
    }

    renderSubtitleSettings() {
        return `
            <div class="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                            <i data-lucide="captions" class="w-5 h-5"></i>
                        </div>
                        <h4 class="font-bold text-white">자막 설정 (Shorts 최적화)</h4>
                    </div>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <span class="text-xs text-slate-400">자막 표시</span>
                        <input type="checkbox" id="subtitle-enabled" ${this.subtitleSettings.enabled ? 'checked' : ''} class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500">
                    </label>
                </div>

                <div id="subtitle-options" class="grid grid-cols-2 gap-4">
                    <!-- 크기 -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            크기: <span id="subtitle-size-value" class="text-purple-400">${this.subtitleSettings.fontSize}</span>
                        </label>
                        <input type="range" id="subtitle-size" min="80" max="200" value="${this.subtitleSettings.fontSize}"
                            class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500">
                    </div>

                    <!-- 위치 -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">위치</label>
                        <select id="subtitle-position" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500">
                            <option value="bottom" ${this.subtitleSettings.position === 'bottom' ? 'selected' : ''}>하단</option>
                            <option value="center" ${this.subtitleSettings.position === 'center' ? 'selected' : ''}>중앙 (권장)</option>
                            <option value="top" ${this.subtitleSettings.position === 'top' ? 'selected' : ''}>상단</option>
                        </select>
                    </div>

                    <!-- 텍스트 색상 -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">텍스트 색상</label>
                        <input type="color" id="subtitle-color" value="${this.subtitleSettings.fontColor}"
                            class="w-full h-10 bg-slate-900 border border-slate-700 rounded cursor-pointer">
                    </div>

                    <!-- 외곽선 색상 -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">외곽선 색상</label>
                        <input type="color" id="subtitle-outline-color" value="${this.subtitleSettings.outlineColor}"
                            class="w-full h-10 bg-slate-900 border border-slate-700 rounded cursor-pointer">
                    </div>
                </div>

                <!-- 미리보기 -->
                <div class="mt-4 bg-black rounded-lg p-6 text-center relative overflow-hidden" style="aspect-ratio: 9/16; max-height: 200px;">
                    <div id="subtitle-preview" class="absolute inset-0 flex items-center justify-center text-white font-bold">
                        자막 미리보기
                    </div>
                </div>
            </div>
        `;
    }

    renderShortsList(shorts) {
        return `
            <div class="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
                <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <i data-lucide="list" class="w-5 h-5 text-pink-400"></i>
                    Shorts 목록
                </h3>

                <div class="space-y-3">
                    ${shorts.map((short, index) => `
                        <div class="bg-slate-900/50 border border-slate-700 rounded-xl p-4 hover:border-pink-500/50 transition">
                            <div class="flex items-center gap-4">
                                <!-- 체크박스 -->
                                <input type="checkbox" class="short-checkbox w-5 h-5 rounded border-slate-600 bg-slate-800 text-pink-600 focus:ring-pink-500 cursor-pointer"
                                       data-index="${index}" checked>

                                <!-- 정보 -->
                                <div class="flex-1">
                                    <div class="flex items-center justify-between mb-2">
                                        <h4 class="font-bold text-white">${short.title}</h4>
                                        <span class="text-xs bg-pink-500/20 text-pink-400 px-2 py-1 rounded border border-pink-500/30">
                                            #${index + 1}
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-4 text-xs text-slate-400">
                                        <span>
                                            <i data-lucide="film" class="w-3 h-3 inline-block mr-1"></i>
                                            씬 ${short.startSceneId}-${short.endSceneId} (${short.sceneCount}개)
                                        </span>
                                        <span>
                                            <i data-lucide="clock" class="w-3 h-3 inline-block mr-1"></i>
                                            약 ${short.estimatedDuration}초
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderGenerateButton(shorts) {
        return `
            <div class="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-6">
                <div class="flex items-center justify-between">
                    <div class="text-sm text-slate-400">
                        <i data-lucide="info" class="w-4 h-4 inline-block mr-1"></i>
                        선택한 Shorts를 9:16 세로 포맷 영상으로 생성합니다
                    </div>
                    <button id="btn-generate-all-shorts" class="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg transition flex items-center gap-2">
                        <i data-lucide="video" class="w-5 h-5"></i>
                        Shorts 영상 생성
                    </button>
                </div>
            </div>
        `;
    }

    onMount() {
        // Setup guide button
        this.setupGuideButton();

        // Shorts 변환으로 이동 버튼
        const btnGoToShorts = document.getElementById('btn-go-to-shorts');
        if (btnGoToShorts) {
            btnGoToShorts.addEventListener('click', () => {
                window.app.route('shorts');
            });
        }

        // 자막 설정 초기화
        this.initializeSubtitleSettings();

        // Shorts 생성 버튼
        const btnGenerate = document.getElementById('btn-generate-all-shorts');
        if (btnGenerate) {
            btnGenerate.addEventListener('click', () => this.generateAllShorts());
        }
    }

    initializeSubtitleSettings() {
        const subtitleEnabled = document.getElementById('subtitle-enabled');
        const subtitleOptions = document.getElementById('subtitle-options');

        if (subtitleEnabled && subtitleOptions) {
            subtitleEnabled.addEventListener('change', (e) => {
                this.subtitleSettings.enabled = e.target.checked;
                if (e.target.checked) {
                    subtitleOptions.classList.remove('opacity-50', 'pointer-events-none');
                } else {
                    subtitleOptions.classList.add('opacity-50', 'pointer-events-none');
                }
                this.updateSubtitlePreview();
            });
        }

        // 크기 슬라이더
        const subtitleSize = document.getElementById('subtitle-size');
        const subtitleSizeValue = document.getElementById('subtitle-size-value');
        if (subtitleSize && subtitleSizeValue) {
            subtitleSize.addEventListener('input', (e) => {
                this.subtitleSettings.fontSize = parseInt(e.target.value);
                subtitleSizeValue.textContent = e.target.value;
                this.updateSubtitlePreview();
            });
        }

        // 위치 선택
        const subtitlePosition = document.getElementById('subtitle-position');
        if (subtitlePosition) {
            subtitlePosition.addEventListener('change', (e) => {
                this.subtitleSettings.position = e.target.value;
                this.updateSubtitlePreview();
            });
        }

        // 색상 선택
        const subtitleColor = document.getElementById('subtitle-color');
        if (subtitleColor) {
            subtitleColor.addEventListener('input', (e) => {
                this.subtitleSettings.fontColor = e.target.value;
                this.updateSubtitlePreview();
            });
        }

        const outlineColor = document.getElementById('subtitle-outline-color');
        if (outlineColor) {
            outlineColor.addEventListener('input', (e) => {
                this.subtitleSettings.outlineColor = e.target.value;
                this.updateSubtitlePreview();
            });
        }

        // 초기 미리보기
        this.updateSubtitlePreview();
    }

    updateSubtitlePreview() {
        const preview = document.getElementById('subtitle-preview');
        if (!preview) return;

        if (!this.subtitleSettings.enabled) {
            preview.style.opacity = '0.3';
            return;
        }

        preview.style.opacity = '1';
        preview.style.fontSize = `${this.subtitleSettings.fontSize / 6}px`;
        preview.style.color = this.subtitleSettings.fontColor;
        preview.style.webkitTextStroke = `${this.subtitleSettings.outlineWidth / 3}px ${this.subtitleSettings.outlineColor}`;
        preview.style.paintOrder = 'stroke fill';
        preview.style.textAlign = this.subtitleSettings.alignment;

        // 위치에 따라 배치
        preview.style.alignItems = this.subtitleSettings.position === 'top' ? 'flex-start' :
                                    this.subtitleSettings.position === 'center' ? 'center' : 'flex-end';
    }

    async generateAllShorts() {
        const generatedShorts = AppState.generatedShorts || [];
        const checkboxes = document.querySelectorAll('.short-checkbox:checked');
        const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
        const selectedShorts = selectedIndices.map(i => generatedShorts[i]);

        if (selectedShorts.length === 0) {
            alert('생성할 Shorts를 선택하세요.');
            return;
        }

        if (!confirm(`선택한 ${selectedShorts.length}개의 Shorts를 영상으로 생성하시겠습니까?\n\n⚠️ 시간이 다소 소요될 수 있습니다.`)) {
            return;
        }

        const btnGenerate = document.getElementById('btn-generate-all-shorts');
        const progressContainer = document.getElementById('task-progress-container');
        const progressTitle = document.getElementById('task-progress-title');
        const progressBar = document.getElementById('task-progress-bar');
        const progressMessage = document.getElementById('task-progress-message');
        const progressPercent = document.getElementById('task-progress-percent');

        try {
            btnGenerate.disabled = true;
            btnGenerate.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> 생성 중...';
            if (window.lucide) window.lucide.createIcons();

            progressContainer.classList.remove('hidden');
            progressTitle.textContent = 'Shorts 영상 생성 중...';
            progressBar.style.width = '0%';
            progressPercent.textContent = '0%';
            progressMessage.textContent = '준비 중...';

            const results = [];

            for (let i = 0; i < selectedShorts.length; i++) {
                const short = selectedShorts[i];
                const progress = Math.round(((i + 1) / selectedShorts.length) * 100);

                progressBar.style.width = `${progress}%`;
                progressPercent.textContent = `${progress}%`;
                progressMessage.textContent = `${i + 1}/${selectedShorts.length}: ${short.title} 생성 중...`;

                console.log(`[ShortsEdit] Generating ${i + 1}/${selectedShorts.length}: ${short.title}`);

                // 씬 데이터 추출 (startSceneId ~ endSceneId)
                const allScenes = AppState.getScenes();
                const shortsScenes = allScenes.filter(s =>
                    s.sceneId >= short.startSceneId && s.sceneId <= short.endSceneId
                );

                // 영상 생성 API 호출 (9:16 포맷)
                const response = await fetch(CONFIG.endpoints.video, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        scenes: shortsScenes,
                        aspectRatio: '9:16',  // 세로 포맷
                        subtitleStyle: this.subtitleSettings
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to generate ${short.title}`);
                }

                const result = await response.json();
                const taskId = result.taskId;

                // 작업 완료 대기
                const videoUrl = await this.pollTaskStatus(taskId, (percent, msg) => {
                    progressMessage.textContent = `${i + 1}/${selectedShorts.length}: ${short.title} - ${msg}`;
                });

                results.push({
                    title: short.title,
                    videoUrl: videoUrl
                });

                console.log(`[ShortsEdit] ✅ ${short.title} 생성 완료`);
            }

            progressContainer.classList.add('hidden');

            // 결과 표시
            this.displayResults(results);

            alert(`✅ ${results.length}개 Shorts 영상 생성 완료!`);

        } catch (error) {
            console.error('[ShortsEdit] Generation error:', error);
            alert(`❌ 생성 실패: ${error.message}`);
            progressContainer.classList.add('hidden');
        } finally {
            btnGenerate.disabled = false;
            btnGenerate.innerHTML = '<i data-lucide="video" class="w-5 h-5"></i> Shorts 영상 생성';
            if (window.lucide) window.lucide.createIcons();
        }
    }

    async pollTaskStatus(taskId, progressCallback) {
        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                try {
                    const response = await fetch(`http://localhost:8000/api/video/status?taskId=${taskId}`);
                    if (!response.ok) {
                        clearInterval(interval);
                        reject(new Error('Failed to check task status'));
                        return;
                    }

                    const task = await response.json();

                    if (progressCallback) {
                        progressCallback(task.progress || 0, task.message || '처리 중...');
                    }

                    if (task.status === 'completed') {
                        clearInterval(interval);
                        resolve(task.result.videoUrl);
                    } else if (task.status === 'failed') {
                        clearInterval(interval);
                        reject(new Error(task.error || 'Task failed'));
                    }
                } catch (error) {
                    clearInterval(interval);
                    reject(error);
                }
            }, 1000);
        });
    }

    displayResults(results) {
        const container = document.getElementById('result-container');
        if (!container) return;

        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-6">
                <div class="flex items-center gap-3 mb-6">
                    <div class="p-3 bg-green-500/20 rounded-lg text-green-400">
                        <i data-lucide="check-circle-2" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white">생성 완료!</h3>
                        <p class="text-sm text-slate-400">${results.length}개의 Shorts 영상이 생성되었습니다</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${results.map((result, index) => `
                        <div class="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                            <h4 class="font-bold text-white mb-3 flex items-center justify-between">
                                ${result.title}
                                <span class="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">#${index + 1}</span>
                            </h4>

                            <div class="aspect-[9/16] bg-black rounded-lg overflow-hidden mb-3">
                                <video src="${result.videoUrl}" controls class="w-full h-full object-cover"></video>
                            </div>

                            <a href="${result.videoUrl}" download="${result.title}.mp4" class="w-full bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold transition flex items-center justify-center gap-2">
                                <i data-lucide="download" class="w-4 h-4"></i>
                                다운로드
                            </a>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();
    }
}
