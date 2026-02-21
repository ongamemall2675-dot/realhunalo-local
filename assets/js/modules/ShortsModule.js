import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG } from '../config.js';
import { STYLE_CATEGORIES } from '../styles.js';

export class ShortsModule extends Module {
    constructor() {
        super('shorts', 'Shorts 변환', 'smartphone', 'AI 기반 숏폼 영상 제작 (듀얼 모드)');

        // 상태 관리
        this.activeTab = 'new'; // 'new' | 'repurpose'
        this.scriptInput = '';
        this.selectedProject = null;
        this.analysisResult = null; // 리퍼퍼징 분석 결과
        this.selectedHighlightType = null; // 'summary' | 'hook_first' | 'qna'
        this.selectedStyle = 'stickman'; // 기본 스타일
        this.projects = [];
        this.projectsLoaded = false;

        // 미리보기 데이터
        this.previewScenes = [];
        this.currentPreviewIndex = 0;
        this.isPlaying = false;
        this.previewInterval = null;
        this.currentVideoUrl = null; // 생성된 최종 영상 URL
    }

    async onMount() {
        // 탭 전환 이벤트
        this.addEvent('click', '.shorts-tab-btn', (e) => {
            this.activeTab = e.target.dataset.tab;
            if (this.activeTab === 'repurpose' && !this.projectsLoaded) {
                this.loadProjects();
            }
            this.refreshModule();
        });

        // [Mode A] 대본 입력 이벤트
        this.addEvent('input', '#shorts-script-input', (e) => {
            this.scriptInput = e.target.value;
        });

        // [Mode A] 스타일 선택 이벤트
        this.addEvent('change', '#shorts-style-select', (e) => {
            this.selectedStyle = e.target.value;
            this.updateStyleDescription();
        });

        // [Mode A] 생성 버튼
        this.addEvent('click', '#btn-create-new-shorts', () => this.createNewShorts());

        // [Mode B] 프로젝트 선택
        this.addEvent('change', '#project-select', (e) => {
            this.selectedProject = e.target.value;
            this.analysisResult = null;
            this.selectedHighlightType = null;
            this.refreshModule();
        });

        // [Mode B] 분석 버튼
        this.addEvent('click', '#btn-analyze-project', () => this.analyzeProject());

        // [Mode B] 하이라이트 선택 카드
        this.addEvent('click', '.repurpose-card', (e) => {
            const card = e.target.closest('.repurpose-card');
            if (card) {
                this.selectedHighlightType = card.dataset.type;
                this.refreshModule();
            }
        });

        // [Mode B] 생성 버튼
        this.addEvent('click', '#btn-create-repurpose', () => this.createRepurposedShorts());

        // 미리보기 컨트롤
        this.addEvent('click', '#btn-preview-play', () => this.togglePreview());
        this.addEvent('click', '#btn-download-video', () => this.downloadVideo());

        // 초기 스타일 설명 업데이트
        this.updateStyleDescription();
    }

    updateStyleDescription() {
        const style = STYLE_CATEGORIES[this.selectedStyle];
        const descEl = this.container.querySelector('#style-desc-text');
        const nameEl = this.container.querySelector('#style-desc-name');

        if (style && descEl && nameEl) {
            nameEl.textContent = style.name;
            descEl.textContent = style.description || style.style;
        }
    }

    async loadProjects() {
        try {
            const res = await fetch('/api/projects');
            if (!res.ok) throw new Error('Failed to load projects');
            const projects = await res.json();

            this.projects = projects;
            this.projectsLoaded = true;
            this.refreshModule();
        } catch (e) {
            console.error("Failed to load projects", e);
            this.showToast("프로젝트 목록 로드 실패", "error");
        }
    }

    render() {
        return `
            <div class="shorts-container slide-up flex h-full gap-6">
                <!-- Left Panel: Controls -->
                <div class="shorts-left-panel flex-1 min-w-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                        <div class="shorts-tabs mb-6 flex bg-slate-900/50 p-1 rounded-xl">
                            <button class="shorts-tab-btn flex-1 py-2 px-4 rounded-lg text-sm font-bold transition ${this.activeTab === 'new' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}" data-tab="new">
                                ✨ 새로 만들기
                            </button>
                            <button class="shorts-tab-btn flex-1 py-2 px-4 rounded-lg text-sm font-bold transition ${this.activeTab === 'repurpose' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}" data-tab="repurpose">
                                ♻️ 리퍼퍼징 (재활용)
                            </button>
                        </div>

                        ${this.activeTab === 'new' ? this.renderNewMode() : this.renderRepurposeMode()}
                    </div>
                </div>

                <!-- Right Panel: Preview -->
                <div class="shorts-right-panel w-[320px] flex-shrink-0 flex flex-col">
                    <h3 class="text-slate-400 font-bold mb-4 flex items-center gap-2">
                        <i data-lucide="smartphone" class="w-5 h-5"></i> 
                        미리보기 (9:16)
                    </h3>
                    
                    <div class="phone-frame aspect-[9/16] bg-black border-8 border-slate-800 rounded-[2rem] overflow-hidden relative shadow-2xl ring-1 ring-slate-700">
                        <div class="phone-screen w-full h-full bg-slate-900 flex items-center justify-center relative">
                            ${this.renderScreenContent()}
                        </div>
                        <div class="phone-overlay absolute inset-0 pointer-events-none p-4 flex flex-col justify-end pb-12 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                            ${this.renderOverlayContent()}
                        </div>
                    </div>

                    <div class="mt-4 flex gap-2 justify-center">
                        <button id="btn-preview-play" class="p-3 rounded-full bg-pink-600 hover:bg-pink-500 text-white transition shadow-lg shadow-pink-600/20">
                            <i data-lucide="${this.isPlaying ? 'pause' : 'play'}" class="w-6 h-6"></i>
                        </button>
                         ${this.currentVideoUrl ? `
                            <button id="btn-download-video" class="p-3 rounded-full bg-slate-700 hover:bg-blue-600 text-white transition shadow-lg">
                                <i data-lucide="download" class="w-6 h-6"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderNewMode() {
        const styleOptions = Object.entries(STYLE_CATEGORIES).map(([key, val]) =>
            `<option value="${key}" ${this.selectedStyle === key ? 'selected' : ''}>${val.name}</option>`
        ).join('');

        return `
            <div class="space-y-6">
                <div>
                    <label class="block text-sm font-bold text-slate-400 mb-2">쇼츠 대본 입력</label>
                    <textarea id="shorts-script-input" 
                        class="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white resize-none focus:ring-2 focus:ring-pink-500 outline-none text-sm leading-relaxed scrollbar-hide"
                        placeholder="여기에 대본을 입력하세요. 1분 이내 (약 300자) 권장...&#10;예: 서울 아파트 가격이 또 올랐습니다. 도대체 언제까지 오를까요? 전문가들의 의견을 종합해봤습니다.">${this.scriptInput}</textarea>
                    <div class="text-right text-xs text-slate-500 mt-1">
                        ${this.scriptInput.length}자 / 권장 300자
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-bold text-slate-400 mb-2">비주얼 스타일</label>
                    <select id="shorts-style-select" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-pink-500 text-sm">
                        ${styleOptions}
                    </select>
                    <div class="mt-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 flex gap-3 items-start">
                        <i data-lucide="info" class="w-4 h-4 text-slate-500 mt-0.5 shrink-0"></i>
                        <div>
                             <p class="text-xs font-bold text-slate-300" id="style-desc-name">스타일 이름</p>
                             <p class="text-xs text-slate-500 mt-1 leading-relaxed" id="style-desc-text">스타일 설명이 여기에 표시됩니다.</p>
                        </div>
                    </div>
                </div>

                <div class="pt-2">
                    <button id="btn-create-new-shorts" class="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl font-bold text-white text-lg shadow-lg hover:shadow-pink-500/20 transition transform hover:scale-[1.02] flex items-center justify-center gap-2">
                        <i data-lucide="sparkles" class="w-5 h-5"></i>
                        <span>AI 쇼츠 원클릭 생성</span>
                    </button>
                    <p class="text-center text-[10px] text-slate-500 mt-2">대본 분석, 이미지 생성, 더빙, 영상 편집이 자동으로 진행됩니다.</p>
                </div>
            </div>
        `;
    }

    renderRepurposeMode() {
        return `
            <div class="space-y-6">
                <!-- 1. 프로젝트 선택 -->
                <div>
                    <label class="block text-sm font-bold text-slate-400 mb-2">기존 프로젝트 선택</label>
                    <div class="flex gap-2">
                        <select id="project-select" class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none text-sm">
                            <option value="">프로젝트를 선택하세요...</option>
                            ${(this.projects || []).map(p => `<option value="${p.id}" ${this.selectedProject === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                        <button id="btn-analyze-project" class="px-6 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm transition shadow-lg truncate whitespace-nowrap" ${!this.selectedProject ? 'disabled' : ''}>
                            분석
                        </button>
                    </div>
                </div>

                <!-- 2. 분석 결과 (옵션 선택) -->
                ${this.analysisResult ? `
                    <div class="space-y-3 slide-up">
                        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">추천 하이라이트</h4>
                        
                        <div class="repurpose-card ${this.selectedHighlightType === 'summary' ? 'selected ring-2 ring-blue-500 bg-blue-900/20' : 'bg-slate-900 hover:bg-slate-800'} border border-slate-700 rounded-xl p-4 cursor-pointer transition relative" data-type="summary">
                            <div class="flex items-center gap-3 mb-2">
                                <span class="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold">요약형</span>
                                <h5 class="font-bold text-white text-sm">핵심 내용 1분 요약</h5>
                                <span class="ml-auto text-xs text-slate-500">${this.analysisResult.summary ? this.analysisResult.summary.length + ' Scenes' : ''}</span>
                            </div>
                            <p class="text-xs text-slate-500 line-clamp-2">전체 영상의 중요 포인트만 빠르게 짚어줍니다.</p>
                        </div>

                        <div class="repurpose-card ${this.selectedHighlightType === 'hook_first' ? 'selected ring-2 ring-red-500 bg-red-900/20' : 'bg-slate-900 hover:bg-slate-800'} border border-slate-700 rounded-xl p-4 cursor-pointer transition relative" data-type="hook_first">
                            <div class="flex items-center gap-3 mb-2">
                                <span class="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-bold">반전형</span>
                                <h5 class="font-bold text-white text-sm">충격적인 결말부터</h5>
                                <span class="ml-auto text-xs text-slate-500">${this.analysisResult.hook_first ? this.analysisResult.hook_first.length + ' Scenes' : ''}</span>
                            </div>
                            <p class="text-xs text-slate-500 line-clamp-2">가장 자극적인 부분을 앞에 배치하여 시선을 끕니다.</p>
                        </div>

                        <div class="repurpose-card ${this.selectedHighlightType === 'qna' ? 'selected ring-2 ring-green-500 bg-green-900/20' : 'bg-slate-900 hover:bg-slate-800'} border border-slate-700 rounded-xl p-4 cursor-pointer transition relative" data-type="qna">
                            <div class="flex items-center gap-3 mb-2">
                                <span class="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-bold">Q&A형</span>
                                <h5 class="font-bold text-white text-sm">질문과 답변 스타일</h5>
                                <span class="ml-auto text-xs text-slate-500">${this.analysisResult.qna ? this.analysisResult.qna.length + ' Scenes' : ''}</span>
                            </div>
                            <p class="text-xs text-slate-500 line-clamp-2">시청자와 소통하는 느낌의 질의응답 포맷입니다.</p>
                        </div>

                        <button id="btn-create-repurpose" class="w-full py-4 mt-4 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl font-bold text-white text-lg shadow-lg hover:shadow-blue-500/20 transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed" ${!this.selectedHighlightType ? 'disabled' : ''}>
                            <i data-lucide="video" class="w-5 h-5 inline-block mr-2"></i>
                            선택한 옵션으로 생성
                        </button>
                    </div>
                ` : `
                    <div class="text-center py-10 text-slate-600 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                        <i data-lucide="search" class="w-10 h-10 mx-auto mb-3 opacity-50"></i>
                        <p class="text-xs">프로젝트를 선택하고 분석 버튼을 눌러주세요.</p>
                    </div>
                `}
            </div>
        `;
    }

    renderScreenContent() {
        if (this.currentVideoUrl) {
            return `<video src="${this.currentVideoUrl}" class="w-full h-full object-cover" controls autoplay loop></video>`;
        }

        if (this.previewScenes.length === 0) {
            return `
                <div class="text-center p-4">
                    <i data-lucide="clapperboard" class="w-8 h-8 text-slate-700 mx-auto mb-2"></i>
                    <p class="text-slate-600 text-xs">미리보기 없음</p>
                </div>
            `;
        }
        const scene = this.previewScenes[this.currentPreviewIndex];
        // 이미지 또는 비디오 표시
        if (!scene.visualUrl) {
            return `
                <div class="text-center p-4 animate-pulse">
                     <i data-lucide="image" class="w-8 h-8 text-slate-700 mx-auto mb-2"></i>
                    <p class="text-slate-600 text-xs">생성 중 (${this.currentPreviewIndex + 1}/${this.previewScenes.length})...</p>
                </div>
            `;
        }
        return `<img src="${scene.visualUrl}" class="w-full h-full object-cover animate-fade-in">`;
    }

    renderOverlayContent() {
        if (this.previewScenes.length === 0) return '';
        const scene = this.previewScenes[this.currentPreviewIndex];

        // 리퍼퍼징 재사용 표시 (선택적)
        const reuseBadge = scene.reused_visual ? `<span class="absolute top-2 right-2 bg-green-500/80 text-white text-[10px] px-2 py-0.5 rounded-full">♻️ Reused</span>` : '';

        return `
            ${reuseBadge}
            <div class="shorts-subtitle text-center px-4">
                <span class="bg-black/50 text-yellow-300 font-bold text-lg px-2 py-1 rounded box-decoration-clone leading-[1.6]">
                    ${scene.text || ''}
                </span>
            </div>
        `;
    }

    // --- Actions ---

    async createNewShorts() {
        if (!this.scriptInput.trim()) {
            alert("대본을 입력해주세요.");
            return;
        }

        const btn = this.container.querySelector('#btn-create-new-shorts');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin mr-2"></i> 생성 중...`;

        try {
            // 스타일 정보 가져오기
            const selectedStyleConfig = STYLE_CATEGORIES[this.selectedStyle];

            this.showToast("쇼츠 생성을 시작합니다... (약 1-2분 소요)", "info");

            const res = await fetch('/api/shorts/create/script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: this.scriptInput,
                    options: {
                        style_context: selectedStyleConfig
                    }
                })
            });
            const data = await res.json();

            if (data.success) {
                this.previewScenes = data.scenes || [];
                this.currentPreviewIndex = 0;
                this.currentVideoUrl = data.video_url; // 최종 영상 URL 저장

                this.showToast("쇼츠 영상이 완성되었습니다!", "success");

                // 미리보기 재생 시작
                if (this.currentVideoUrl) {
                    this.isPlaying = true;
                } else {
                    this.togglePreview();
                }

                this.refreshModule();
            } else {
                throw new Error(data.error || "Unknown error");
            }
        } catch (e) {
            console.error(e);
            this.showToast("생성 실패: " + e.message, "error");
        } finally {
            if (this.container && this.container.querySelector('#btn-create-new-shorts')) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    }

    async analyzeProject() {
        if (!this.selectedProject) {
            alert("프로젝트를 선택해주세요.");
            return;
        }

        const btn = this.container.querySelector('#btn-analyze-project');
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>`;

        try {
            const res = await fetch('/api/shorts/analyze-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_path: this.selectedProject }) // project_path is actually project ID here
            });
            const data = await res.json();

            if (data.success) {
                this.analysisResult = data.highlights;
                this.showToast("분석이 완료되었습니다.", "success");
                this.refreshModule();
            } else {
                throw new Error(data.error || "Analysis failed");
            }
        } catch (e) {
            console.error(e);
            this.showToast("분석 실패: " + e.message, "error");
            this.analysisResult = null;
        } finally {
            // 버튼 상태 복구는 refreshModule에서 처리됨
        }
    }

    async createRepurposedShorts() {
        if (!this.selectedHighlightType || !this.analysisResult) return;

        const scenes = this.analysisResult[this.selectedHighlightType];
        if (!scenes || scenes.length === 0) {
            alert("선택한 타입의 장면 데이터가 없습니다.");
            return;
        }

        const btn = this.container.querySelector('#btn-create-repurpose');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin mr-2"></i> 자산 매칭 및 생성 중...`;

        try {
            this.showToast("기존 자산을 스캔하고 부족한 부분을 생성합니다...", "info");

            const res = await fetch('/api/shorts/create/highlight', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original_project_path: this.selectedProject,
                    highlight_type: this.selectedHighlightType,
                    scenes: scenes
                })
            });
            const data = await res.json();

            if (data.success) {
                this.previewScenes = data.scenes || [];
                this.currentPreviewIndex = 0;
                this.currentVideoUrl = data.video_url;

                this.showToast("리퍼퍼징 쇼츠가 완성되었습니다!", "success");

                if (this.currentVideoUrl) {
                    this.isPlaying = true;
                } else {
                    this.togglePreview();
                }

                this.refreshModule();
            } else {
                throw new Error(data.error || "Generation failed");
            }
        } catch (e) {
            console.error(e);
            this.showToast("생성 실패: " + e.message, "error");
        } finally {
            if (this.container && this.container.querySelector('#btn-create-repurpose')) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    }

    togglePreview() {
        if (this.currentVideoUrl) {
            // 비디오 모드인 경우 제어는 비디오 태그가 함 or 커스텀 제어
            const video = this.container.querySelector('video');
            if (video) {
                if (video.paused) video.play();
                else video.pause();
                this.isPlaying = !video.paused;
                this.refreshModule(); // 아이콘 업데이트
            }
            return;
        }

        // 이미지 슬라이드 모드
        if (this.isPlaying) {
            clearInterval(this.previewInterval);
            this.isPlaying = false;
        } else {
            this.isPlaying = true;
            this.previewInterval = setInterval(() => {
                this.currentPreviewIndex = (this.currentPreviewIndex + 1) % (this.previewScenes.length || 1);
                this.refreshModule();
            }, 3000);
        }
        this.refreshModule();
    }

    downloadVideo() {
        if (this.currentVideoUrl) {
            const a = document.createElement('a');
            a.href = this.currentVideoUrl;
            a.download = `shorts_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 text-white font-bold animate-slide-up flex items-center gap-3 ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-slate-800 border border-slate-600'
            }`;
        toast.innerHTML = `
            <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info'}" class="w-5 h-5"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}
