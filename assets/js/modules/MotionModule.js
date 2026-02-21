// ================================================================
// MOTION MODULE - 모션 작업실
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG, API_BASE_URL } from '../config.js';
import { processInBatches } from '../utils.js';
import { motionCache } from '../cache.js';
import { DownloadHelper } from '../utils/download.js';

export class MotionModule extends Module {
    constructor() {
        super('motion', '4-1. 모션 생성', 'video', '정적인 이미지를 역동적인 영상으로 변환합니다.');

        // Motion settings (default values)
        this.motionSettings = {
            model: 'bytedance/seedance-1-lite',
            duration: 5,
            aspectRatio: '16:9',
            quality: 'standard'
        };

        // Statistics
        this.stats = {
            totalGenerated: 0,
            successCount: 0,
            errorCount: 0,
            totalProcessingTime: 0 // milliseconds
        };

        this.showSettings = false;
        this.showStats = false;

        // 다양한 모션 프롬프트 (자동 할당용 & 백업용) - VEO3/GROK Natural Style
        // Priority: Character Action > Environment > Camera (Subtle)
        this.motionPromptLibrary = [
            "The character nods gently in agreement while soft light shifts across their face, camera holding steady.",
            "Wind blows through the character's hair as they gaze into the distance, with a slow and subtle push in.",
            "The character types furiously on the keyboard, screen light flickering on their face, camera circling slowly to build tension.",
            "The character slumps into the chair with a heavy sigh, dust floating in the light beams, capturing a moment of defeat.",
            "The character points excitedly at the chart, their face beaming with joy, while the camera follows their hand movement.",
            "A peaceful moment as the character sips coffee, steam rising gently, with the background blurring softly.",
            "The character paces nervously back and forth, shadows stretching across the floor, camera tracking their movement.",
            "The character laughs uncontrollably, head thrown back, as the environment brightens with warm lighting.",
            "The character wipes a tear from their cheek, rain falling softly in the background, camera drifting closer.",
            "The character stands triumphant with arms raised, confetti falling around them, camera slowly pulling back to reveal the scene.",
            "The character looks around in confusion, browsing through papers, with a handheld camera feel adding urgency.",
            "The character shakes hands firmly with another person, confident smile, as the camera focuses on the handshake.",
            "The character walks confidently towards the camera, coat tail flapping in the wind, with a low angle shot.",
            "The character meditates in silence, chest rising and falling rhythmically, soft particles drifting in the air.",
            "The character checks their watch impatiently, tapping their foot, while the background city moves in a blur.",
            "The character presents the product with a welcoming gesture, spotlight focusing on them, camera gliding smoothly.",
            "The character reads a book intently, turning a page, while leaves fall gently outside the window.",
            "The character adjusts their glasses and looks directly at the lens, a serious expression, with a slow zoom in.",
            "The character celebrates a victory, jumping in the air, freeze frame effect for a split second before landing.",
            "The character walks away into the sunset, silhouette defined against the light, camera remaining static."
        ];
    }

    /**
     * Render settings panel
     */
    renderSettingsPanel() {
        return `
            <div class="bg-gradient-to-r from-pink-900/20 to-rose-900/20 border border-pink-500/30 rounded-2xl p-6 mb-6 ${this.showSettings ? '' : 'hidden'}">
                <div class="flex items-center gap-3 mb-5">
                    <div class="p-2 bg-pink-500/20 rounded-lg text-pink-400">
                        <i data-lucide="settings" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white">⚙️ 모션 설정</h3>
                </div>

                <div class="grid grid-cols-4 gap-4">
                    <!-- Model Selection -->
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">모델</label>
                        <select id="motion-model" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition">
                            <option value="bytedance/seedance-1-lite" ${this.motionSettings.model === 'bytedance/seedance-1-lite' ? 'selected' : ''}>SeeDance Lite (Fast)</option>
                            <option value="bytedance/seedance-1" ${this.motionSettings.model === 'bytedance/seedance-1' ? 'selected' : ''}>SeeDance (Quality)</option>
                        </select>
                    </div>

                    <!-- Duration -->
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                            영상 길이 <span class="text-pink-400">${this.motionSettings.duration}초</span>
                        </label>
                        <input type="range" id="motion-duration" min="3" max="10" step="1" value="${this.motionSettings.duration}"
                            class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500">
                    </div>

                    <!-- Aspect Ratio -->
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">비율</label>
                        <select id="motion-aspect-ratio" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition">
                            <option value="16:9" ${this.motionSettings.aspectRatio === '16:9' ? 'selected' : ''}>16:9 (Landscape)</option>
                            <option value="9:16" ${this.motionSettings.aspectRatio === '9:16' ? 'selected' : ''}>9:16 (Portrait)</option>
                            <option value="1:1" ${this.motionSettings.aspectRatio === '1:1' ? 'selected' : ''}>1:1 (Square)</option>
                        </select>
                    </div>

                    <!-- Quality -->
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">품질</label>
                        <select id="motion-quality" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition">
                            <option value="draft" ${this.motionSettings.quality === 'draft' ? 'selected' : ''}>Draft (빠름)</option>
                            <option value="standard" ${this.motionSettings.quality === 'standard' ? 'selected' : ''}>Standard (권장)</option>
                            <option value="high" ${this.motionSettings.quality === 'high' ? 'selected' : ''}>High (느림)</option>
                        </select>
                    </div>
                </div>

                <div class="mt-4 p-3 bg-black/20 rounded-lg border border-pink-500/20">
                    <p class="text-xs text-slate-400">
                        <i data-lucide="info" class="w-3 h-3 inline mr-1"></i>
                        <strong class="text-pink-400">SeeDance Lite:</strong> 빠른 처리 속도 (3-5초) |
                        <strong class="text-pink-400">SeeDance:</strong> 고품질 모션 (10-20초)
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Render statistics panel
     */
    renderStatsPanel() {
        const avgTime = this.stats.totalGenerated > 0
            ? (this.stats.totalProcessingTime / this.stats.totalGenerated / 1000).toFixed(1)
            : 0;

        return `
            <div class="bg-gradient-to-r from-emerald-900/20 to-teal-900/20 border border-emerald-500/30 rounded-2xl p-6 mb-6 ${this.showStats ? '' : 'hidden'}">
                <div class="flex items-center gap-3 mb-5">
                    <div class="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                        <i data-lucide="bar-chart-3" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white">📊 통계</h3>
                </div>

                <div class="grid grid-cols-4 gap-4">
                    <div class="bg-black/20 p-4 rounded-xl border border-slate-700/30">
                        <div class="text-2xl font-black text-emerald-400" id="stat-total-generated-motion">${this.stats.totalGenerated}</div>
                        <div class="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">총 생성</div>
                    </div>
                    <div class="bg-black/20 p-4 rounded-xl border border-slate-700/30">
                        <div class="text-2xl font-black text-green-400" id="stat-success-count-motion">${this.stats.successCount}</div>
                        <div class="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">성공</div>
                    </div>
                    <div class="bg-black/20 p-4 rounded-xl border border-slate-700/30">
                        <div class="text-2xl font-black text-red-400" id="stat-error-count-motion">${this.stats.errorCount}</div>
                        <div class="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">실패</div>
                    </div>
                    <div class="bg-black/20 p-4 rounded-xl border border-slate-700/30">
                        <div class="text-2xl font-black text-cyan-400" id="stat-avg-time-motion">${avgTime}s</div>
                        <div class="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">평균 시간</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Count scene statuses for display
     */
    countSceneStatus(scenes) {
        return {
            complete: scenes.filter(s => s.videoUrl).length,
            pending: scenes.filter(s => !s.videoUrl && s.generatedUrl && s.motionPrompt).length,
            error: scenes.filter(s => !s.generatedUrl).length
        };
    }

    render() {
        const scenes = AppState.getScenes();

        const standalonePanel = `
            <div class="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-6 mb-6">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                        <i data-lucide="link" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white">🔗 외부 이미지로 비디오 생성</h3>
                    <span class="ml-auto text-xs text-purple-400 bg-purple-500/20 px-3 py-1 rounded-full">URL 직접 입력</span>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">이미지 URL</label>
                        <input id="external-image-url" type="url"
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                            placeholder="https://example.com/image.jpg">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">모션 프롬프트</label>
                        <input id="external-motion-prompt" type="text"
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                            placeholder="Slow dolly-in, smooth camera movement">
                    </div>
                </div>
                
                <button id="btn-external-gen-video" class="mt-4 w-full bg-purple-600 hover:bg-purple-500 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg shadow-purple-600/20 transition flex items-center justify-center gap-2">
                    <i data-lucide="clapperboard" class="w-4 h-4"></i> 비디오 생성
                </button>

                <!-- 생성 결과 표시 영역 -->
                <div id="external-video-result" class="hidden mt-4 p-4 bg-slate-900/50 border border-purple-500/30 rounded-xl space-y-3">
                    <div class="flex items-center gap-2 text-purple-400 text-sm font-semibold">
                        <i data-lucide="check-circle" class="w-5 h-5"></i>
                        <span>비디오 생성 완료!</span>
                        <span id="external-video-info" class="ml-auto text-xs text-slate-400"></span>
                    </div>
                    <video id="external-video-player" controls class="w-full rounded-lg bg-black">
                        <source src="" type="video/mp4">
                        브라우저가 비디오 재생을 지원하지 않습니다.
                    </video>
                    <button id="btn-external-download-video" class="w-full bg-slate-700 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        <span>비디오 다운로드</span>
                    </button>
                </div>
            </div>
        `;

        if (scenes.length === 0) {
            return `
                <div class="max-w-4xl mx-auto slide-up space-y-6">
                    ${standalonePanel}
                    
                    <div class="text-center p-10 text-slate-500 border border-dashed border-slate-700 rounded-2xl">
                        <i data-lucide="video" class="w-12 h-12 mx-auto mb-4 opacity-50"></i>
                        <h3 class="text-lg font-bold">장면이 없습니다</h3>
                        <p class="text-sm mt-2">위에서 외부 이미지 URL을 입력하거나, 미술 작업실에서 이미지를 먼저 생성하세요.</p>
                    </div>
                </div>
            `;
        }

        const sceneRows = scenes.map(scene => `
            <tr class="border-b border-slate-800/30 hover:bg-white/5 transition group" id="motion-row-${scene.sceneId}">
                <td class="py-4 pl-6 text-xs font-bold text-slate-500 w-16">#${scene.sceneId}</td>
                <td class="py-4 px-4 w-1/4">
                    <div class="max-h-24 overflow-y-auto pr-2 text-sm text-slate-300 leading-relaxed scrollbar-hide">
                        ${scene.originalScript}
                    </div>
                </td>
                <td class="py-4 px-4">
                    <div class="w-32 aspect-video bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden relative">
                        <img src="${scene.generatedUrl || ''}" class="${scene.generatedUrl ? '' : 'hidden'} w-full h-full object-cover">
                        <div class="absolute inset-0 bg-black/40 ${scene.generatedUrl ? 'hidden' : ''} flex items-center justify-center">
                            <span class="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Image Missing</span>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-4 w-1/3">
                    <div class="bg-black/20 p-2 rounded-lg border border-slate-700/30 relative">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[8px] text-purple-600 font-bold uppercase tracking-widest">Motion Prompt</span>
                            <button class="btn-randomize-prompt text-[9px] px-2 py-0.5 bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white rounded transition flex items-center gap-1"
                                data-scene-id="${scene.sceneId}" title="랜덤 프롬프트 생성">
                                <i data-lucide="shuffle" class="w-2.5 h-2.5"></i> 랜덤
                            </button>
                        </div>
                        <textarea id="motion-prompt-text-${scene.sceneId}"
                            class="w-full h-16 bg-transparent text-[11px] text-slate-400 font-mono italic resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 rounded p-1 scrollbar-hide"
                            placeholder="모션 프롬프트를 입력하세요..."
                            data-scene-id="${scene.sceneId}">${scene.motionPrompt || ''}</textarea>
                    </div>
                </td>
                <td class="py-4 px-4">
                    <div class="w-32 aspect-video bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center overflow-hidden relative group cursor-pointer
                         hover:border-purple-500 transition"
                         ondragover="event.preventDefault(); this.classList.add('border-purple-500', 'ring-2', 'ring-purple-500/50')"
                         ondragleave="this.classList.remove('border-purple-500', 'ring-2', 'ring-purple-500/50')"
                         ondrop="handleMotionVideoDrop(event, this)"
                         data-scene-id="${scene.sceneId}">
                        ${scene.videoUrl
                ? `<video src="${scene.videoUrl}" class="w-full h-full object-cover" muted
                          onclick="window.openLightbox('${scene.videoUrl}', 'video')"></video>
                   <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                       <i data-lucide="maximize-2" class="w-6 h-6 text-white"></i>
                   </div>`
                : `<span class="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Drag Video Here</span>`}
                    </div>
                </td>
                <td class="py-4 pr-6 text-right w-36">
                    <div class="flex flex-col gap-2 scale-90 origin-right">
                        <button class="btn-gen-video bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${scene.generatedUrl ? '' : 'opacity-50 cursor-not-allowed'}" 
                            id="btn-video-${scene.sceneId}" data-id="${scene.sceneId}" ${scene.generatedUrl ? '' : 'disabled'}>
                            <i data-lucide="clapperboard" class="w-3.5 h-3.5"></i> 비디오 변환
                        </button>
                        <button class="btn-down-video bg-slate-800 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${scene.videoUrl ? '' : 'hidden'}"
                            id="btn-down-video-${scene.sceneId}" data-id="${scene.sceneId}">
                            <i data-lucide="download" class="w-3.5 h-3.5"></i> 영상 다운로드
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        const statusCounts = this.countSceneStatus(scenes);

        return `
            <div class="max-w-7xl mx-auto slide-up space-y-6">
                <div class="flex items-center gap-2">
                    <!-- User Guide Button -->
                    ${this.renderGuideButton()}

                    <!-- Reset Button -->
                    <button id="btn-reset-motion" class="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 rounded-xl text-xs font-bold transition">
                        <i data-lucide="refresh-ccw" class="w-3.5 h-3.5"></i>
                        초기화
                    </button>
                </div>

                <!-- Settings and Stats Panels -->
                ${this.renderSettingsPanel()}
                ${this.renderStatsPanel()}

                <!-- Control Bar -->
                <div class="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                    <div class="flex items-center gap-4">
                        <span class="text-sm font-bold text-slate-400">총 <b>${scenes.length}</b>개 장면</span>
                        <div class="h-4 w-px bg-slate-700"></div>
                        <div class="flex gap-2">
                            <span class="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-lg font-bold">
                                ✓ 완료 ${statusCounts.complete}
                            </span>
                            <span class="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg font-bold">
                                ⏳ 대기 ${statusCounts.pending}
                            </span>
                            <span class="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-lg font-bold">
                                ✕ 오류 ${statusCounts.error}
                            </span>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button id="btn-auto-gen-prompts" class="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-purple-600/20 transition flex items-center gap-2">
                            <i data-lucide="sparkles" class="w-4 h-4"></i> 프롬프트 자동 생성
                        </button>
                        <button id="btn-toggle-motion-settings" class="bg-slate-700 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="settings" class="w-4 h-4"></i> 설정
                        </button>
                        <button id="btn-toggle-motion-stats" class="bg-slate-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="bar-chart-3" class="w-4 h-4"></i> 통계
                        </button>
                        <button id="btn-gen-motion-video-batch" class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2">
                            <i data-lucide="film" class="w-4 h-4"></i> 비디오 일괄 생성
                        </button>
                        <button id="btn-down-motion-videos" class="bg-slate-700 hover:bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="download-cloud" class="w-4 h-4"></i> 영상 일괄 다운로드
                        </button>
                        <button id="btn-down-motion-prompts" class="bg-slate-700 hover:bg-pink-600 text-white px-6 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="file-text" class="w-4 h-4"></i> 프롬프트 다운로드
                        </button>
                    </div>
                </div>

                 <div class="bg-slate-800/20 border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl">
                    <table class="w-full text-left table-fixed">
                        <thead class="bg-slate-900/60 border-b border-slate-700">
                            <tr>
                                <th class="py-4 pl-6 text-[10px] font-black text-slate-500 uppercase tracking-widest w-16">ID</th>
                                <th class="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-1/4">대본(한글)</th>
                                <th class="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">생성 이미지</th>
                                <th class="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-1/4">모션 설정</th>
                                <th class="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">최종 영상</th>
                                <th class="py-4 pr-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest w-36">액션</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sceneRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Get a random motion prompt from the library
     */
    getRandomMotionPrompt() {
        const randomIndex = Math.floor(Math.random() * this.motionPromptLibrary.length);
        return this.motionPromptLibrary[randomIndex];
    }

    /**
     * Auto-generate motion prompts for all scenes missing them using Backend API
     */
    async autoGenerateMotionPrompts() {
        const scenes = AppState.getScenes();
        const scenesToUpdate = scenes.filter(s => !s.motionPrompt || s.motionPrompt.trim() === '');

        if (scenesToUpdate.length === 0) return 0;

        console.log(`📡 Requesting motion prompts for ${scenesToUpdate.length} scenes...`);

        try {
            // Prepare payload
            const payload = {
                scenes: scenesToUpdate.map(s => ({
                    index: s.sceneId,
                    text: s.originalScript,
                    imagePrompt: s.imagePrompt
                }))
            };

            const response = await fetch(CONFIG.endpoints.motionPromptsBatch, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Server Error: ${response.status}`);

            const result = await response.json();

            if (result.success && result.prompts) {
                let updatedCount = 0;
                result.prompts.forEach(p => {
                    const scene = scenes.find(s => s.sceneId == p.index);
                    if (scene) {
                        scene.motionPrompt = p.motionPrompt;
                        updatedCount++;
                    }
                });

                if (updatedCount > 0) {
                    AppState.setScenes([...scenes]);
                    console.log(`✅ Backend generated ${updatedCount} motion prompts`);
                    return updatedCount;
                }
            }
        } catch (error) {
            console.error("❌ Failed to auto-generate motion prompts:", error);
            alert("모션 프롬프트 생성 중 오류가 발생했습니다. 백엔드 로그를 확인하세요.");
        }
        return 0;
    }

    // ...

    onMount() {
        // ... (previous code)

        // Auto-generate motion prompts for all scenes
        const btnAutoGenPrompts = document.getElementById('btn-auto-gen-prompts');
        if (btnAutoGenPrompts) {
            btnAutoGenPrompts.addEventListener('click', async () => {
                const originalText = btnAutoGenPrompts.innerHTML;
                btnAutoGenPrompts.disabled = true;
                btnAutoGenPrompts.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 생성 중...`;
                lucide.createIcons();

                try {
                    const count = await this.autoGenerateMotionPrompts();
                    if (count > 0) {
                        alert(`✅ ${count}개 장면에 모션 프롬프트가 (VEO3/GROK 스타일로) 자동 생성되었습니다.`);
                        this.refreshModule();
                    } else {
                        alert('모든 장면에 이미 모션 프롬프트가 있거나 생성에 실패했습니다.');
                    }
                } finally {
                    btnAutoGenPrompts.disabled = false;
                    btnAutoGenPrompts.innerHTML = originalText;
                    lucide.createIcons();
                }
            });
        }

        // Randomize individual scene prompts
        document.querySelectorAll('.btn-randomize-prompt').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = btn.getAttribute('data-scene-id');
                const scene = AppState.getScenes().find(s => s.sceneId == sceneId);
                if (scene) {
                    scene.motionPrompt = this.getRandomMotionPrompt();
                    AppState.setScenes([...AppState.getScenes()]);
                    const textarea = document.getElementById(`motion-prompt-text-${sceneId}`);
                    if (textarea) textarea.value = scene.motionPrompt;
                    console.log(`🎲 Random motion prompt assigned to scene #${sceneId}`);
                }
            });
        });

        // Toggle settings panel
        const btnToggleSettings = document.getElementById('btn-toggle-motion-settings');
        if (btnToggleSettings) {
            btnToggleSettings.addEventListener('click', () => this.toggleSettings());
        }

        // Toggle stats panel
        const btnToggleStats = document.getElementById('btn-toggle-motion-stats');
        if (btnToggleStats) {
            btnToggleStats.addEventListener('click', () => this.toggleStats());
        }

        // Settings change listeners
        const modelSelect = document.getElementById('motion-model');
        const durationInput = document.getElementById('motion-duration');
        const aspectRatioSelect = document.getElementById('motion-aspect-ratio');
        const qualitySelect = document.getElementById('motion-quality');

        if (modelSelect) {
            modelSelect.addEventListener('change', () => this.updateSettings());
        }
        if (durationInput) {
            durationInput.addEventListener('input', (e) => {
                this.updateSettings();
                // Update label
                const label = e.target.previousElementSibling;
                if (label) {
                    label.innerHTML = `영상 길이 <span class="text-pink-400">${e.target.value}초</span>`;
                }
            });
        }
        if (aspectRatioSelect) {
            aspectRatioSelect.addEventListener('change', () => this.updateSettings());
        }
        if (qualitySelect) {
            qualitySelect.addEventListener('change', () => this.updateSettings());
        }

        // External video gen
        const btnExternalGen = document.getElementById('btn-external-gen-video');
        if (btnExternalGen) {
            btnExternalGen.addEventListener('click', async () => {
                const imageUrl = document.getElementById('external-image-url')?.value.trim();
                const motionPrompt = document.getElementById('external-motion-prompt')?.value.trim();

                if (!imageUrl) return alert('이미지 URL을 입력해주세요.');

                btnExternalGen.disabled = true;
                const originalText = btnExternalGen.innerHTML;
                const startTime = Date.now();
                btnExternalGen.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 생성 중...`;
                lucide.createIcons();

                try {
                    const response = await fetch(`${CONFIG.endpoints.motion}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sceneId: 'external',
                            imageUrl: imageUrl,
                            motionPrompt: motionPrompt || this.getRandomMotionPrompt()
                        })
                    });

                    if (!response.ok) throw new Error(`서버 오류: ${response.status}`);

                    const result = await response.json();
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

                    if (result.videoUrl) {
                        // 결과 영역 표시
                        const videoResult = document.getElementById('external-video-result');
                        const videoPlayer = document.getElementById('external-video-player');
                        const videoInfo = document.getElementById('external-video-info');
                        const btnDownload = document.getElementById('btn-external-download-video');

                        videoResult.classList.remove('hidden');
                        videoPlayer.src = result.videoUrl;
                        videoInfo.textContent = `처리 시간: ${elapsed}초`;

                        // 다운로드 버튼 이벤트
                        btnDownload.onclick = () => {
                            const link = document.createElement('a');
                            link.href = result.videoUrl;
                            link.download = `external_video_${Date.now()}.mp4`;
                            link.click();
                        };

                        lucide.createIcons();
                    } else {
                        throw new Error('비디오 URL이 없습니다.');
                    }
                } catch (e) {
                    console.error(e);
                    const errorMsg = e.message || '알 수 없는 오류';
                    const errorLower = errorMsg.toLowerCase();

                    let helpText = '\n\n💡 해결 방법:\n';
                    if (errorLower.includes('timeout') || errorLower.includes('시간 초과')) {
                        helpText += '• 비디오 생성은 시간이 오래 걸립니다. 잠시 후 다시 시도하세요.';
                    } else if (errorLower.includes('image') || errorLower.includes('이미지')) {
                        helpText += '• 이미지 URL이 유효한지 확인하세요.\n• 공개적으로 접근 가능한 이미지 URL을 사용해야 합니다.';
                    } else if (errorLower.includes('api 키') || errorLower.includes('인증')) {
                        helpText += '• 설정 메뉴에서 Replicate API 키를 확인하세요.';
                    } else {
                        helpText += '• 이미지 URL이 올바른지 확인하세요.\n• 잠시 후 다시 시도해보세요.';
                    }

                    alert(`❌ 비디오 생성 실패\n\n오류: ${errorMsg}${helpText}`);
                } finally {
                    btnExternalGen.disabled = false;
                    btnExternalGen.innerHTML = originalText;
                    lucide.createIcons();
                }
            });
        }

        // Motion prompt sync
        document.querySelectorAll('textarea[id^="motion-prompt-text-"]').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                const sceneId = e.target.getAttribute('data-scene-id');
                const scene = scenes.find(s => s.sceneId == sceneId);
                if (scene) scene.motionPrompt = e.target.value;
            });
        });

        // Individual video generation
        document.querySelectorAll('.btn-gen-video').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sceneId = btn.getAttribute('data-id');
                const scene = scenes.find(s => s.sceneId == sceneId);

                if (!scene.generatedUrl) return alert("이미지가 먼저 생성되어야 합니다.");

                // Auto-generate motion prompt if missing
                if (!scene.motionPrompt || scene.motionPrompt.trim() === '') {
                    scene.motionPrompt = this.getRandomMotionPrompt();
                    AppState.setScenes([...AppState.getScenes()]);
                    const textarea = document.getElementById(`motion-prompt-text-${sceneId}`);
                    if (textarea) textarea.value = scene.motionPrompt;
                    console.log(`🎲 Auto-generated motion prompt for scene #${sceneId}`);
                }

                btn.disabled = true;
                const originalText = btn.innerHTML;
                const startTime = Date.now();

                btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> 생성 중...`;
                lucide.createIcons();

                try {
                    this.stats.totalGenerated++;

                    // Check cache first
                    const cacheKey = motionCache.generateKey('motion', {
                        imageUrl: scene.generatedUrl,
                        prompt: scene.motionPrompt,
                        model: this.motionSettings.model,
                        duration: this.motionSettings.duration
                    });

                    const cachedResult = motionCache.get(cacheKey);
                    let result;
                    let fromCache = false;

                    if (cachedResult) {
                        // Use cached result
                        result = cachedResult;
                        fromCache = true;
                        console.log(`📦 Using cached motion for scene #${sceneId}`);
                    } else {
                        // Make API call
                        const response = await fetch(`${CONFIG.endpoints.motion}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sceneId: sceneId,
                                imageUrl: scene.generatedUrl,
                                motionPrompt: scene.motionPrompt,
                                duration: this.motionSettings.duration,
                                aspectRatio: this.motionSettings.aspectRatio,
                                model: this.motionSettings.model
                            })
                        });

                        if (!response.ok) throw new Error(`Server Error: ${response.status}`);

                        result = await response.json();

                        // Cache successful result
                        if (result.videoUrl) {
                            motionCache.set(cacheKey, result);
                        }
                    }

                    const processingTime = Date.now() - startTime;
                    const elapsed = fromCache ? '0.0' : ((processingTime / 1000).toFixed(1));

                    if (result.videoUrl) {
                        scene.videoUrl = result.videoUrl;
                        this.stats.successCount++;
                        this.stats.totalProcessingTime += processingTime;

                        // 중요: AppState에 변경사항 저장
                        AppState.setScenes([...AppState.getScenes()]);
                        console.log(`✅ Motion video saved to scene #${scene.sceneId}:`, result.videoUrl);

                        const videoContainer = document.querySelector(`#motion-row-${sceneId} td:nth-child(5) div`);
                        if (videoContainer) {
                            videoContainer.innerHTML = `<video src="${result.videoUrl}" class="w-full h-full object-cover" controls></video>`;
                        }

                        const downBtn = document.getElementById(`btn-down-video-${sceneId}`);
                        if (downBtn) downBtn.classList.remove('hidden');

                        // Update stats (only count non-cached processing time)
                        if (!fromCache) {
                            this.stats.totalProcessingTime += processingTime;
                        }

                        // Visual success feedback
                        const icon = fromCache ? 'database' : 'check-circle';
                        const displayElapsed = fromCache ? `${elapsed}s (cached)` : `${elapsed}s`;
                        btn.classList.remove('bg-purple-600', 'bg-purple-500');
                        btn.classList.add(fromCache ? 'bg-cyan-600' : 'bg-green-600');
                        btn.innerHTML = `<i data-lucide="${icon}" class="w-3.5 h-3.5"></i> ${displayElapsed}`;
                        lucide.createIcons();

                        setTimeout(() => {
                            btn.classList.remove('bg-green-600', 'bg-cyan-600');
                            btn.classList.add('bg-orange-600');
                            btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> 재생성`;
                            lucide.createIcons();
                        }, 2000);

                        this.updateStatsUI();
                    } else {
                        throw new Error("No videoUrl in response");
                    }
                } catch (e) {
                    console.error(e);
                    this.stats.errorCount++;
                    this.updateStatsUI();

                    // Enhanced error message with contextual help
                    const errorMsg = e.message || '알 수 없는 오류';
                    const errorLower = errorMsg.toLowerCase();

                    let helpText = '\n\n💡 해결 방법:\n';
                    if (errorLower.includes('timeout') || errorLower.includes('시간 초과')) {
                        helpText += '• 비디오 생성은 시간이 오래 걸릴 수 있습니다. 잠시 후 다시 시도하세요.\n• 더 짧은 영상 길이를 선택하거나 Lite 모델을 사용해보세요.';
                    } else if (errorLower.includes('network') || errorLower.includes('fetch')) {
                        helpText += '• 인터넷 연결을 확인하세요.\n• 백엔드 서버가 실행 중인지 확인하세요 (localhost:8000).';
                    } else if (errorLower.includes('api 키') || errorLower.includes('인증')) {
                        helpText += '• 설정 메뉴에서 Replicate API 키를 확인하세요.\n• API 키가 유효한지 테스트해보세요.';
                    } else if (errorLower.includes('rate limit') || errorLower.includes('한도')) {
                        helpText += '• API 사용 한도를 초과했습니다.\n• 잠시 후 다시 시도하거나 다른 모델을 사용해보세요.';
                    } else if (errorLower.includes('image') || errorLower.includes('이미지')) {
                        helpText += '• 이미지 URL이 유효하지 않을 수 있습니다.\n• 미술 작업실에서 이미지를 다시 생성해보세요.';
                    } else {
                        helpText += '• 잠시 후 다시 시도해보세요.\n• 문제가 계속되면 다른 모델이나 설정을 시도해보세요.';
                    }

                    alert(`❌ 비디오 생성 실패\n\nScene #${sceneId}\n오류: ${errorMsg}${helpText}`);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    lucide.createIcons();
                }
            });
        });

        // Download video
        document.querySelectorAll('.btn-down-video').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = btn.getAttribute('data-id');
                const scene = scenes.find(s => s.sceneId == sceneId);
                if (scene?.videoUrl) {
                    const link = document.createElement('a');
                    link.href = scene.videoUrl;
                    link.download = `scene_${sceneId}.mp4`;
                    link.click();
                }
            });
        });

        // Batch video generation
        const btnGenVideoBatch = document.getElementById('btn-gen-motion-video-batch');
        if (btnGenVideoBatch) {
            btnGenVideoBatch.addEventListener('click', async () => {
                const validScenes = scenes.filter(s => s.generatedUrl && s.motionPrompt);
                if (validScenes.length === 0) return alert("생성 가능한 장면이 없습니다.\n(이미지와 모션 프롬프트가 필요합니다)");

                if (!confirm(`총 ${validScenes.length}개의 비디오를 병렬 생성합니다.\n(최대 5개씩 동시 생성)\n\n계속하시겠습니까?`)) return;

                btnGenVideoBatch.disabled = true;
                const originalText = btnGenVideoBatch.innerHTML;
                const batchStartTime = Date.now();

                const updateProgress = (count, total) => {
                    this.showBatchProgress(count, total, batchStartTime);
                };
                updateProgress(0, validScenes.length);

                const initialSuccessCount = this.stats.successCount;
                const initialErrorCount = this.stats.errorCount;

                await processInBatches(validScenes, 5, async (scene) => {
                    const btn = document.querySelector(`#btn-video-${scene.sceneId}`);
                    if (btn) btn.click();
                }, updateProgress);

                const totalElapsed = ((Date.now() - batchStartTime) / 1000).toFixed(1);
                const successCount = this.stats.successCount - initialSuccessCount;
                const errorCount = this.stats.errorCount - initialErrorCount;
                const avgTimePerVideo = successCount > 0 ? (parseFloat(totalElapsed) / successCount).toFixed(1) : 0;
                const successRate = ((successCount / validScenes.length) * 100).toFixed(0);

                btnGenVideoBatch.disabled = false;
                btnGenVideoBatch.innerHTML = originalText;
                lucide.createIcons();

                // Enhanced completion message with statistics
                if (errorCount === 0) {
                    alert(`✅ 비디오 일괄 생성 완료!\n\n` +
                        `📊 통계:\n` +
                        `• 성공: ${successCount}/${validScenes.length}개 (${successRate}%)\n` +
                        `• 총 처리 시간: ${totalElapsed}초\n` +
                        `• 평균 생성 시간: ${avgTimePerVideo}초/비디오`
                    );
                } else {
                    alert(`⚠️ 비디오 일괄 생성 완료 (일부 실패)\n\n` +
                        `📊 통계:\n` +
                        `• 성공: ${successCount}개\n` +
                        `• 실패: ${errorCount}개\n` +
                        `• 총 처리 시간: ${totalElapsed}초\n` +
                        `• 평균 생성 시간: ${avgTimePerVideo}초/비디오\n\n` +
                        `💡 실패한 장면은 개별적으로 다시 시도해보세요.`
                    );
                }
            });
        }

        // Batch download videos (improved with ZIP)
        const btnDownVideos = document.getElementById('btn-down-motion-videos');
        if (btnDownVideos) {
            btnDownVideos.addEventListener('click', async () => {
                const scenesWithVideo = scenes.filter(s => s.videoUrl);
                if (scenesWithVideo.length === 0) return alert("생성된 영상이 없습니다.");

                if (!confirm(`총 ${scenesWithVideo.length}개의 영상을 ZIP으로 다운로드 하시겠습니까?`)) return;

                try {
                    btnDownVideos.disabled = true;
                    btnDownVideos.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> ZIP 생성 중...`;
                    lucide.createIcons();

                    const files = [];
                    for (const scene of scenesWithVideo) {
                        files.push({
                            filename: `scene_${String(scene.sceneId).padStart(3, '0')}_motion.mp4`,
                            url: scene.videoUrl
                        });
                    }

                    await DownloadHelper.downloadAsZip(files, `motion_videos_${Date.now()}.zip`);
                    alert(`✅ ${scenesWithVideo.length}개 영상이 ZIP으로 다운로드되었습니다.`);

                } catch (error) {
                    console.error('ZIP 다운로드 실패:', error);
                    alert(`❌ 다운로드 실패: ${error.message}`);
                } finally {
                    btnDownVideos.disabled = false;
                    btnDownVideos.innerHTML = `<i data-lucide="download-cloud" class="w-4 h-4"></i> 영상 일괄 다운로드`;
                    lucide.createIcons();
                }
            });
        }

        // Download all motion prompts as JSON file (improved)
        const btnDownMotionPrompts = document.getElementById('btn-down-motion-prompts');
        if (btnDownMotionPrompts) {
            btnDownMotionPrompts.addEventListener('click', () => {
                const allScenes = AppState.getScenes();
                if (allScenes.length === 0) return alert("다운로드할 장면이 없습니다.");

                const scenesWithPrompts = allScenes.filter(s => s.motionPrompt);
                if (scenesWithPrompts.length === 0) return alert("모션 프롬프트가 없습니다.");

                // JSON 형식으로 저장
                const promptsData = scenesWithPrompts.map(scene => ({
                    sceneId: scene.sceneId,
                    motionPrompt: scene.motionPrompt,
                    imagePrompt: scene.imagePrompt,
                    originalScript: scene.originalScript
                }));

                DownloadHelper.downloadJSON(promptsData, `motion_prompts_${Date.now()}.json`);
                alert(`✅ 모션 프롬프트 JSON 파일이 다운로드되었습니다.\n총 ${scenesWithPrompts.length}개 프롬프트 포함`);
            });
        }

        lucide.createIcons();
    }
}
