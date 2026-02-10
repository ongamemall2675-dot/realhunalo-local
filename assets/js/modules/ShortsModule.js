// ================================================================
// SHORTS MODULE - Shorts 변환실
// AI 기반 Shorts 추천 및 생성
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG } from '../config.js';

export class ShortsModule extends Module {
    constructor() {
        super('shorts', 'Shorts 변환', 'smartphone', 'AI 기반 Shorts 추천 및 생성');

        // 추천 목록
        this.recommendations = [];

        // 선택된 Shorts
        this.selectedShorts = new Set();

        // 생성된 Shorts 결과물
        this.generatedShorts = [];
    }

    render() {
        const scenes = AppState.getScenes();
        const script = AppState.getScript();

        const hasAnalysis = this.recommendations.length > 0;
        const hasSelection = this.selectedShorts.size > 0;

        // 단계 상태 결정
        const step1Complete = scenes.length > 0;
        const step2Complete = hasAnalysis;
        const step3Complete = hasSelection;

        return `
            <div class="max-w-6xl mx-auto slide-up space-y-6">
                <!-- User Guide Button -->
                ${this.renderGuideButton()}

                <!-- Process Flow Guide -->
                <div class="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6">
                    <h3 class="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                        <i data-lucide="route" class="w-4 h-4"></i>
                        Shorts 생성 프로세스
                    </h3>
                    <div class="flex items-center gap-3">
                        <!-- Step 1 -->
                        <div class="flex-1 relative">
                            <div class="flex items-center gap-3 p-4 rounded-xl ${step1Complete ? 'bg-green-500/10 border-2 border-green-500/50' : 'bg-slate-800/50 border-2 border-slate-700'}">
                                <div class="flex-shrink-0 w-10 h-10 rounded-full ${step1Complete ? 'bg-green-500' : 'bg-slate-700'} flex items-center justify-center text-white font-bold">
                                    ${step1Complete ? '<i data-lucide="check" class="w-5 h-5"></i>' : '1'}
                                </div>
                                <div>
                                    <div class="font-bold text-white text-sm">AI 대본 분석</div>
                                    <div class="text-xs ${step1Complete ? 'text-green-400' : 'text-slate-500'}">
                                        ${step1Complete ? '분석 완료' : '대본 준비 필요'}
                                    </div>
                                </div>
                            </div>
                            ${!step1Complete ? '<div class="absolute -bottom-6 left-0 right-0 text-center"><div class="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded px-2 py-1 inline-block">← 먼저 완료하세요</div></div>' : ''}
                        </div>

                        <!-- Arrow -->
                        <i data-lucide="arrow-right" class="w-6 h-6 text-slate-600 flex-shrink-0"></i>

                        <!-- Step 2 -->
                        <div class="flex-1 relative">
                            <div class="flex items-center gap-3 p-4 rounded-xl ${step2Complete ? 'bg-green-500/10 border-2 border-green-500/50' : step1Complete ? 'bg-blue-500/10 border-2 border-blue-500/50' : 'bg-slate-800/50 border-2 border-slate-700'}">
                                <div class="flex-shrink-0 w-10 h-10 rounded-full ${step2Complete ? 'bg-green-500' : step1Complete ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'} flex items-center justify-center text-white font-bold">
                                    ${step2Complete ? '<i data-lucide="check" class="w-5 h-5"></i>' : '2'}
                                </div>
                                <div>
                                    <div class="font-bold text-white text-sm">Shorts 선택</div>
                                    <div class="text-xs ${step2Complete ? 'text-green-400' : step1Complete ? 'text-blue-400' : 'text-slate-500'}">
                                        ${step2Complete ? `${this.recommendations.length}개 추천됨` : step1Complete ? 'AI 분석 시작 →' : '대기 중'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Arrow -->
                        <i data-lucide="arrow-right" class="w-6 h-6 text-slate-600 flex-shrink-0"></i>

                        <!-- Step 3 -->
                        <div class="flex-1 relative">
                            <div class="flex items-center gap-3 p-4 rounded-xl ${step3Complete ? 'bg-green-500/10 border-2 border-green-500/50' : step2Complete ? 'bg-purple-500/10 border-2 border-purple-500/50' : 'bg-slate-800/50 border-2 border-slate-700'}">
                                <div class="flex-shrink-0 w-10 h-10 rounded-full ${step3Complete ? 'bg-green-500' : step2Complete ? 'bg-purple-500 animate-pulse' : 'bg-slate-700'} flex items-center justify-center text-white font-bold">
                                    ${step3Complete ? '<i data-lucide="check" class="w-5 h-5"></i>' : '3'}
                                </div>
                                <div>
                                    <div class="font-bold text-white text-sm">영상 생성</div>
                                    <div class="text-xs ${step3Complete ? 'text-green-400' : step2Complete ? 'text-purple-400' : 'text-slate-500'}">
                                        ${step3Complete ? `${this.selectedShorts.size}개 선택됨` : step2Complete ? 'Shorts 선택 →' : '대기 중'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Analysis Section -->
                <div class="bg-gradient-to-r from-pink-900/30 to-purple-900/30 border border-pink-500/30 rounded-2xl p-6">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="p-3 bg-pink-500/20 rounded-lg text-pink-400">
                                <i data-lucide="sparkles" class="w-6 h-6"></i>
                            </div>
                            <div>
                                <h2 class="text-xl font-bold text-white">📊 Shorts 분석</h2>
                                <p class="text-sm text-slate-400">AI가 최적의 Shorts 후보 5개를 자동 추천합니다</p>
                            </div>
                        </div>
                    </div>

                    ${scenes.length === 0 ? `
                        <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
                            <i data-lucide="alert-triangle" class="w-8 h-8 text-yellow-400 mx-auto mb-2"></i>
                            <p class="text-yellow-300">먼저 대본 분석을 완료하세요.</p>
                        </div>
                    ` : `
                        <div class="flex items-center justify-between bg-slate-800/40 rounded-lg p-4">
                            <div class="flex items-center gap-4">
                                <div class="text-sm text-slate-400">
                                    <span class="font-bold text-white">${scenes.length}</span>개 씬 분석 가능
                                </div>
                                <div class="text-xs text-slate-500">|</div>
                                <div class="text-sm text-slate-400">
                                    대본 길이: <span class="font-bold text-white">${script.length}</span>자
                                </div>
                            </div>
                            <button id="btn-analyze-shorts" class="bg-pink-600 hover:bg-pink-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-pink-600/20 transition flex items-center gap-2">
                                <i data-lucide="cpu" class="w-5 h-5"></i>
                                AI 분석 시작
                            </button>
                        </div>
                    `}
                </div>

                <!-- Recommendations List -->
                ${hasAnalysis ? this.renderRecommendations() : ''}

                <!-- Creation Panel -->
                ${this.selectedShorts.size > 0 ? this.renderCreationPanel() : ''}

                <!-- Generated Shorts Results -->
                ${this.generatedShorts.length > 0 ? this.renderGeneratedShorts() : ''}
            </div>
        `;
    }

    renderRecommendations() {
        if (this.recommendations.length === 0) {
            return '';
        }

        return `
            <div class="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h3 class="text-lg font-bold text-white flex items-center gap-2">
                            <i data-lucide="trophy" class="w-5 h-5 text-yellow-400"></i>
                            추천 Shorts 목록
                        </h3>
                        <p class="text-xs text-slate-500 mt-1">후킹 포인트 기반으로 선정된 5개 후보</p>
                    </div>
                    <div class="text-sm text-slate-400">
                        <span class="font-bold text-pink-400">${this.selectedShorts.size}</span>개 선택됨
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-4">
                    ${this.recommendations.map((rec, index) => this.renderRecommendationCard(rec, index)).join('')}
                </div>
            </div>
        `;
    }

    renderRecommendationCard(rec, index) {
        const isSelected = this.selectedShorts.has(rec.rank);
        const viralIcon = rec.viralPotential === 'high' ? '🔥' : rec.viralPotential === 'medium' ? '⭐' : '💡';

        return `
            <div class="bg-slate-900/50 border ${isSelected ? 'border-pink-500 ring-2 ring-pink-500/50' : 'border-slate-700'} rounded-xl p-4 transition hover:border-pink-500/50 cursor-pointer"
                 id="short-card-${rec.rank}"
                 data-rank="${rec.rank}">
                <div class="flex items-start gap-4">
                    <!-- Selection Checkbox -->
                    <div class="pt-1">
                        <input type="checkbox"
                               class="short-checkbox w-5 h-5 rounded border-slate-600 bg-slate-800 text-pink-600 focus:ring-pink-500 cursor-pointer"
                               data-rank="${rec.rank}"
                               ${isSelected ? 'checked' : ''}>
                    </div>

                    <!-- Rank Badge -->
                    <div class="flex-shrink-0">
                        <div class="w-12 h-12 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg flex items-center justify-center border border-pink-500/30">
                            <span class="text-2xl font-bold text-pink-400">#${rec.rank}</span>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="flex-1">
                        <div class="flex items-start justify-between mb-2">
                            <div>
                                <h4 class="font-bold text-white text-lg">${rec.title}</h4>
                                <div class="flex items-center gap-3 mt-1">
                                    <span class="text-xs bg-slate-700/50 px-2 py-1 rounded text-slate-300">
                                        <i data-lucide="film" class="w-3 h-3 inline-block mr-1"></i>
                                        씬 ${rec.startSceneId}-${rec.endSceneId}
                                    </span>
                                    <span class="text-xs bg-slate-700/50 px-2 py-1 rounded text-slate-300">
                                        <i data-lucide="clock" class="w-3 h-3 inline-block mr-1"></i>
                                        약 ${rec.estimatedDuration}초
                                    </span>
                                    <span class="text-xs">
                                        ${viralIcon} ${rec.viralPotential}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <p class="text-sm text-slate-400 mb-2">
                            <strong class="text-pink-400">후킹 이유:</strong> ${rec.hookReason}
                        </p>

                        <details class="text-xs text-slate-500">
                            <summary class="cursor-pointer hover:text-slate-300 transition">스크립트 미리보기</summary>
                            <p class="mt-2 p-3 bg-slate-800/50 rounded italic">${rec.extractedScript}</p>
                        </details>
                    </div>
                </div>
            </div>
        `;
    }

    renderCreationPanel() {
        const selectedCount = this.selectedShorts.size;

        return `
            <div class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-6">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-lg font-bold text-white">선택한 Shorts 생성</h3>
                        <p class="text-sm text-slate-400">${selectedCount}개의 Shorts가 선택되었습니다</p>
                    </div>
                </div>

                <div class="bg-slate-800/40 rounded-lg p-4 mb-4">
                    <h4 class="text-sm font-bold text-slate-300 mb-3">📱 Shorts 설정</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">화면 비율</label>
                            <select id="shorts-aspect-ratio" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                                <option value="9:16">9:16 (세로 - Shorts 표준)</option>
                                <option value="1:1">1:1 (정사각)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">자막</label>
                            <select id="shorts-subtitle" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                                <option value="auto">자동 (권장)</option>
                                <option value="none">없음</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-between bg-slate-900/50 rounded-lg p-4">
                    <div class="text-sm text-slate-400">
                        각 Shorts는 기존 씬의 에셋(이미지, 음성)을 재사용합니다
                    </div>
                    <button id="btn-create-selected-shorts" class="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-purple-600/20 transition flex items-center gap-2">
                        <i data-lucide="rocket" class="w-5 h-5"></i>
                        선택한 Shorts 생성
                    </button>
                </div>
            </div>
        `;
    }

    renderGeneratedShorts() {
        return `
            <div class="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-6">
                <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                        <div class="p-3 bg-green-500/20 rounded-lg text-green-400">
                            <i data-lucide="check-circle-2" class="w-6 h-6"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-white">생성된 Shorts</h3>
                            <p class="text-sm text-slate-400">${this.generatedShorts.length}개의 Shorts가 생성되었습니다</p>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${this.generatedShorts.map((short, index) => `
                        <div class="bg-slate-800/40 border border-slate-700 rounded-xl p-4 hover:border-green-500/50 transition">
                            <div class="flex items-center justify-between mb-3">
                                <h4 class="font-bold text-white text-sm">${short.title}</h4>
                                <span class="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30">
                                    #${index + 1}
                                </span>
                            </div>

                            <div class="space-y-2 text-xs text-slate-400 mb-4">
                                <div class="flex items-center gap-2">
                                    <i data-lucide="film" class="w-3 h-3"></i>
                                    씬 ${short.startSceneId} ~ ${short.endSceneId} (${short.sceneCount}개 씬)
                                </div>
                                <div class="flex items-center gap-2">
                                    <i data-lucide="clock" class="w-3 h-3"></i>
                                    약 ${short.estimatedDuration}초
                                </div>
                                ${short.videoUrl ? `
                                    <div class="flex items-center gap-2 text-green-400">
                                        <i data-lucide="video" class="w-3 h-3"></i>
                                        영상 생성 완료
                                    </div>
                                ` : ''}
                            </div>

                            ${short.videoUrl ? `
                                <div class="aspect-[9/16] bg-black rounded-lg overflow-hidden mb-3">
                                    <video src="${short.videoUrl}" controls class="w-full h-full object-cover"></video>
                                </div>
                                <div class="flex gap-2">
                                    <a href="${short.videoUrl}" download="${short.title}.mp4" class="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1">
                                        <i data-lucide="download" class="w-3 h-3"></i> 다운로드
                                    </a>
                                    <button onclick="navigator.clipboard.writeText('${short.videoUrl}')" class="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded-lg transition">
                                        <i data-lucide="link" class="w-3 h-3"></i>
                                    </button>
                                </div>
                            ` : `
                                <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                                    <div class="text-xs text-yellow-400 flex items-center justify-center gap-2">
                                        <i data-lucide="alert-triangle" class="w-3 h-3"></i>
                                        씬 추출만 완료. 영상 생성은 최종 편집실에서 진행하세요.
                                    </div>
                                </div>
                            `}
                        </div>
                    `).join('')}
                </div>

                <div class="mt-6 bg-slate-900/50 rounded-lg p-4 flex items-center justify-between">
                    <div class="text-sm text-slate-400">
                        <i data-lucide="info" class="w-4 h-4 inline-block mr-1"></i>
                        쇼츠 편집실에서 9:16 세로 포맷으로 렌더링하세요
                    </div>
                    <button id="btn-go-to-shorts-edit" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2">
                        <i data-lucide="arrow-right" class="w-4 h-4"></i>
                        쇼츠 편집실로 이동
                    </button>
                </div>
            </div>
        `;
    }

    onMount() {
        // Setup guide button
        this.setupGuideButton();

        // AI 분석 버튼
        const btnAnalyze = document.getElementById('btn-analyze-shorts');
        if (btnAnalyze) {
            btnAnalyze.addEventListener('click', () => this.analyzeForShorts());
        }

        // Shorts 체크박스 이벤트 (카드 클릭 시에도 체크)
        document.querySelectorAll('.short-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const rank = parseInt(e.target.dataset.rank);
                if (e.target.checked) {
                    this.selectedShorts.add(rank);
                } else {
                    this.selectedShorts.delete(rank);
                }
                this.refreshModule();
            });
        });

        // 카드 클릭 시 체크박스 토글
        document.querySelectorAll('[id^="short-card-"]').forEach(card => {
            card.addEventListener('click', (e) => {
                // 체크박스 자체를 클릭한 경우는 제외
                if (e.target.classList.contains('short-checkbox')) return;
                if (e.target.tagName === 'SUMMARY') return;

                const rank = parseInt(card.dataset.rank);
                const checkbox = card.querySelector('.short-checkbox');

                if (this.selectedShorts.has(rank)) {
                    this.selectedShorts.delete(rank);
                    checkbox.checked = false;
                } else {
                    this.selectedShorts.add(rank);
                    checkbox.checked = true;
                }

                this.refreshModule();
            });
        });

        // Shorts 생성 버튼
        const btnCreate = document.getElementById('btn-create-selected-shorts');
        if (btnCreate) {
            btnCreate.addEventListener('click', () => this.createSelectedShorts());
        }

        // 쇼츠 편집실로 이동 버튼
        const btnGoToShortsEdit = document.getElementById('btn-go-to-shorts-edit');
        if (btnGoToShortsEdit) {
            btnGoToShortsEdit.addEventListener('click', () => {
                // 생성된 쇼츠 데이터를 AppState에 저장
                AppState.generatedShorts = this.generatedShorts;
                // 쇼츠 편집 모듈로 이동
                window.app.route('shorts-edit');
            });
        }
    }

    async analyzeForShorts() {
        const script = AppState.getScript();
        const scenes = AppState.getScenes();

        if (!script || scenes.length === 0) {
            alert('먼저 대본 분석을 완료하세요.');
            return;
        }

        const btnAnalyze = document.getElementById('btn-analyze-shorts');

        try {
            btnAnalyze.disabled = true;
            btnAnalyze.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> AI 분석 중...';
            if (window.lucide) window.lucide.createIcons();

            console.log(`[Shorts] Analyzing script with ${scenes.length} scenes`);
            const response = await fetch(`http://localhost:8000${CONFIG.endpoints.shortsAnalyze}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullScript: script,
                    scenes: scenes
                })
            });

            console.log(`[Shorts] Analysis response status: ${response.status}`);

            const result = await response.json();

            if (result.success) {
                this.recommendations = result.recommendations || [];
                this.selectedShorts.clear();

                alert(`✅ Shorts 분석 완료!\n${this.recommendations.length}개의 후보를 발견했습니다.`);
                this.refreshModule();
            } else {
                alert(`❌ 분석 실패: ${result.error}`);
            }

        } catch (error) {
            console.error('Shorts analysis error:', error);
            alert(`❌ 오류 발생: ${error.message}`);
        } finally {
            btnAnalyze.disabled = false;
            btnAnalyze.innerHTML = '<i data-lucide="cpu" class="w-5 h-5"></i> AI 분석 시작';
            if (window.lucide) window.lucide.createIcons();
        }
    }

    async createSelectedShorts() {
        if (this.selectedShorts.size === 0) {
            alert('생성할 Shorts를 선택하세요.');
            return;
        }

        const scenes = AppState.getScenes();
        const selectedRecs = this.recommendations.filter(rec => this.selectedShorts.has(rec.rank));

        if (!confirm(`선택한 ${selectedRecs.length}개의 Shorts를 생성하시겠습니까?`)) {
            return;
        }

        const btnCreate = document.getElementById('btn-create-selected-shorts');
        if (btnCreate) {
            btnCreate.disabled = true;
            btnCreate.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> 생성 중...';
            if (window.lucide) window.lucide.createIcons();
        }

        try {
            const createdShorts = [];
            let successCount = 0;
            let failCount = 0;

            for (const rec of selectedRecs) {
                console.log(`[Shorts] Creating: ${rec.title} (Scenes ${rec.startSceneId}-${rec.endSceneId})`);

                try {
                    console.log(`[Shorts] Calling API: ${CONFIG.endpoints.shortsCreate}`);
                    const response = await fetch(`http://localhost:8000${CONFIG.endpoints.shortsCreate}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            scenes: scenes,
                            startSceneId: rec.startSceneId,
                            endSceneId: rec.endSceneId,
                            title: rec.title
                        })
                    });

                    console.log(`[Shorts] Response status: ${response.status}`);

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`[Shorts] API Error: ${errorText}`);
                        failCount++;
                        continue;
                    }

                    const result = await response.json();
                    console.log(`[Shorts] Result:`, result);

                    if (result.success) {
                        console.log(`✅ ${rec.title}: ${result.sceneCount}개 씬 추출 완료`);

                        // 생성된 Shorts를 배열에 추가
                        createdShorts.push({
                            title: rec.title,
                            startSceneId: rec.startSceneId,
                            endSceneId: rec.endSceneId,
                            sceneCount: result.sceneCount,
                            estimatedDuration: rec.estimatedDuration,
                            videoUrl: result.videoUrl || null // 영상 URL이 있으면 저장
                        });
                        successCount++;
                    } else {
                        console.error(`❌ ${rec.title} 생성 실패:`, result.error);
                        failCount++;
                    }
                } catch (fetchError) {
                    console.error(`❌ ${rec.title} API 호출 실패:`, fetchError);
                    failCount++;
                }
            }

            console.log(`[Shorts] 생성 완료: 성공 ${successCount}개, 실패 ${failCount}개`);
            console.log(`[Shorts] createdShorts:`, createdShorts);

            // 생성된 Shorts를 generatedShorts 배열에 추가
            this.generatedShorts.push(...createdShorts);

            console.log(`[Shorts] Total generatedShorts:`, this.generatedShorts);

            if (successCount > 0) {
                alert(`✅ ${successCount}개 Shorts 생성 완료!\n\n생성된 Shorts 결과물을 아래에서 확인하세요.`);
            } else {
                alert(`❌ Shorts 생성 실패\n\n모든 Shorts 생성이 실패했습니다. 콘솔을 확인하세요.`);
            }

            // UI 갱신
            this.refreshModule();

        } catch (error) {
            console.error('Shorts creation error:', error);
            alert(`❌ 생성 실패: ${error.message}`);
        } finally {
            if (btnCreate) {
                btnCreate.disabled = false;
                btnCreate.innerHTML = '<i data-lucide="rocket" class="w-5 h-5"></i> 선택한 Shorts 생성';
                if (window.lucide) window.lucide.createIcons();
            }
        }
    }
}
