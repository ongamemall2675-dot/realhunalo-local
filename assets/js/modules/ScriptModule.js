// ================================================================
// SCRIPT MODULE - YouTube Metadata Generator
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG, API_BASE_URL } from '../config.js';
import { STYLE_CATEGORIES } from '../styles.js';

export class ScriptModule extends Module {
    constructor() {
        super('script', '1. 대본 입력', 'file-text', '완성된 대본을 입력하고 의미 단위로 줄바꿈합니다.');
        this.metadata = null;
    }

    render() {
        return `
            <div class="max-w-6xl mx-auto space-y-6 animate-fade-in">
                <!-- Header -->
                <div class="flex justify-between items-end pb-4">
                    <div>
                        <h2 class="text-4xl font-black text-white tracking-tighter mb-2 italic">PHASE 1. <span class="text-blue-500">대본 교정</span></h2>
                        <p class="text-slate-400 font-medium">완성된 대본을 입력하고 시니어 가독성을 위한 의미 단위로 줄바꿈합니다.</p>
                    </div>
                    ${this.renderGuideButton()}
                </div>

                <!-- Script Input -->
                <div class="glass-card rounded-3xl p-8 border border-white/5 space-y-4">
                    <label class="block text-sm font-bold text-slate-400 uppercase tracking-widest pl-1">
                        <i data-lucide="file-text" class="w-4 h-4 inline mr-2 text-blue-500"></i>
                        Script Input
                    </label>
                        <textarea 
                        id="script-input" 
                        class="w-full h-[500px] bg-black/40 border border-white/5 rounded-2xl px-6 py-5 text-slate-200 text-lg leading-relaxed placeholder-slate-600 focus:border-blue-500/50 outline-none resize-none transition-all"
                        placeholder="작성된 대본 원문을 여기에 붙여넣으세요...&#10;&#10;'의미 단위 줄바꿈 변환' 버튼을 누르면 AI가 시니어 가독성에 맞게 문장을 적절히 나누어 줍니다."
                    >${AppState.getScript()}</textarea>
                    
                    <div class="flex justify-between items-center pt-2">
                        <span id="char-count" class="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full">0 Characters</span>
                        <div class="flex gap-4 items-center flex-wrap">
                            <div class="relative min-w-[200px]">
                                <select id="segment-model-select" class="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none appearance-none cursor-pointer pr-10">
                                    <option value="deepseek-reasoner" selected>DeepSeek Reasoner (Recommended/Best)</option>
                                    <option value="deepseek-chat">DeepSeek Chat (Fast)</option>
                                    <option value="gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
                                </select>
                                <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                </div>
                            </div>
                            <button id="btn-clear" class="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition flex items-center gap-2 border border-slate-700/50">
                                <i data-lucide="rotate-ccw" class="w-4 h-4"></i> 초기화
                            </button>
                            <button id="btn-segment-script" class="btn-primary-cinematic px-8 py-3 rounded-xl flex items-center gap-2">
                                <i data-lucide="split" class="w-5 h-5"></i>
                                <span class="text-sm font-black">의미 단위 줄바꿈 변환</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Segmentation Loading Progress -->
                <div id="segment-loading-area" class="hidden glass-card rounded-2xl p-6 border border-blue-500/20 bg-blue-500/5">
                    <div class="flex items-center gap-4 text-blue-400 mb-4">
                        <i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>
                        <span id="segment-loading-msg" class="text-lg font-bold">대본을 분석하여 줄바꿈을 적용하고 있습니다...</span>
                    </div>
                    <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div id="segment-progress-bar" class="h-full bg-blue-500 transition-all duration-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]" style="width: 0%"></div>
                    </div>
                </div>

                <!-- Next Step Button -->
                <div class="flex justify-end pt-4">
                    <button id="btn-next-to-tts" class="group flex items-center gap-3 px-10 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black transition-all border border-slate-700 shadow-xl">
                        <span>다음 단계: 음성 생성 (Phase 2)</span>
                        <i data-lucide="arrow-right" class="w-5 h-5 text-blue-500 group-hover:translate-x-1 transition-transform"></i>
                    </button>
                </div>

            </div>
        `;
    }

    onMount() {
        const scriptInput = document.getElementById('script-input');
        const charCount = document.getElementById('char-count');
        const btnClear = document.getElementById('btn-clear');
        const btnNextToTTS = document.getElementById('btn-next-to-tts');

        this.setupGuideButton();


        // Character count
        const updateCharCount = () => {
            const text = scriptInput.value;
            charCount.textContent = `${text.length}자`;
            AppState.setScript(text);
        };

        scriptInput.addEventListener('input', updateCharCount);
        updateCharCount();

        // Clear button
        btnClear?.addEventListener('click', () => {
            if (confirm('대본을 지우시겠습니까?')) {
                scriptInput.value = '';
                updateCharCount();
            }
        });

        // Semantic Segment button
        const btnSegment = document.getElementById('btn-segment-script');
        btnSegment?.addEventListener('click', () => this.segmentScript());

        // Next button (To TTS Module)
        btnNextToTTS?.addEventListener('click', () => {
            if (window.app) {
                window.app.route('tts');
            }
        });

        lucide.createIcons();
    }

    async segmentScript() {
        const scriptInput = document.getElementById('script-input');
        const modelSelect = document.getElementById('segment-model-select');
        const script = scriptInput.value.trim();
        const model = modelSelect?.value || 'deepseek-reasoner';

        if (!script) {
            alert('의미 단위로 나눌 대본을 먼저 입력해주세요.');
            scriptInput.focus();
            return;
        }

        const btn = document.getElementById('btn-segment-script');
        const loadingArea = document.getElementById('segment-loading-area');

        // UI State
        btn.disabled = true;
        btn.classList.add('opacity-50', 'grayscale');
        loadingArea.classList.remove('hidden');
        this.updateSegmentProgress(10, `의미 단위 분석 중... (${model})`);

        try {
            console.log('[ScriptModule] Requesting semantic segmentation:', { model, length: script.length });

            const response = await fetch(CONFIG.endpoints.scriptSegment, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: script,
                    model: model
                })
            });

            const data = await response.json();

            if (!data.success || !data.taskId) {
                throw new Error(data.error || '대본 분절 요청 실패');
            }

            // Start polling
            this.pollSegmentTaskStatus(data.taskId);

        } catch (error) {
            console.error('[ScriptModule] Segmentation Error Details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            alert(`변환 실패: ${error.message}\n\n(자세한 내용은 콘솔(F12)을 확인하세요)`);
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'grayscale');
            loadingArea.classList.add('hidden');
        }
    }

    pollSegmentTaskStatus(taskId) {
        let attempts = 0;
        const maxAttempts = 60;

        const interval = setInterval(async () => {
            attempts++;
            if (attempts > maxAttempts) {
                clearInterval(interval);
                this.handleSegmentError('시간 초과: 서버 응답이 너무 늦습니다.');
                return;
            }

            try {
                const res = await fetch(`${CONFIG.endpoints.tasks}/${taskId}`);
                const data = await res.json();

                console.log(`[ScriptModule] Polling Segmentation ${taskId}:`, data.status);

                if (data.status === 'completed') {
                    clearInterval(interval);
                    this.handleSegmentComplete(data.result);
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    this.handleSegmentError(data.error || '분절 실패');
                } else {
                    const progress = Math.min(20 + (attempts * 1.5), 95);
                    this.updateSegmentProgress(progress, data.message || 'AI가 대본의 맥락을 분석하고 있습니다...');
                }

            } catch (error) {
                console.error('[ScriptModule] Polling Error:', error);
            }
        }, 1000);
    }

    handleSegmentComplete(result) {
        const btn = document.getElementById('btn-segment-script');
        const loadingArea = document.getElementById('segment-loading-area');
        const scriptInput = document.getElementById('script-input');

        this.updateSegmentProgress(100, '의미 단위 줄바꿈 변환이 성공적으로 완료되었습니다!');

        setTimeout(() => {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'grayscale');
            loadingArea.classList.add('hidden');

            if (result && result.originalScript) {
                console.log(`[ScriptModule] Segmentation Result Received (${result.originalScript.length} chars)`);
                console.log(`[ScriptModule] Line Breaks: ${(result.originalScript.match(/\n/g) || []).length}`);

                scriptInput.value = result.originalScript;
                scriptInput.dispatchEvent(new Event('input'));

                // Explicitly save to AppState to be sure
                AppState.setScript(result.originalScript);

                // Visual feedback
                scriptInput.classList.add('ring-4', 'ring-green-500/50');
                setTimeout(() => scriptInput.classList.remove('ring-4', 'ring-green-500/50'), 2000);

                // Scroll to top of textarea
                scriptInput.scrollTop = 0;
            }
        }, 800);
    }

    handleSegmentError(errorMsg) {
        const btn = document.getElementById('btn-segment-script');
        const loadingArea = document.getElementById('segment-loading-area');

        btn.disabled = false;
        btn.classList.remove('opacity-50', 'grayscale');
        loadingArea.classList.add('hidden');

        alert(`변환 오류: ${errorMsg}`);
    }

    updateSegmentProgress(percent, message) {
        const bar = document.getElementById('segment-progress-bar');
        const msg = document.getElementById('segment-loading-msg');
        if (bar) bar.style.width = `${percent}%`;
        if (msg) msg.textContent = message;
    }

    copyToClipboard(text, message = '복사되었습니다') {
        navigator.clipboard.writeText(text).then(() => {
            // Temporary visual feedback
            const alert = document.createElement('div');
            alert.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
            alert.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 inline mr-2"></i>${message}`;
            document.body.appendChild(alert);
            lucide.createIcons();

            setTimeout(() => {
                alert.remove();
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('복사 실패');
        });
    }
}
