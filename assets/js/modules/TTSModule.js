// ================================================================
// TTS MODULE - TTS 녹음실
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG, API_BASE_URL } from '../config.js';
import { processInBatches } from '../utils.js';
import { DownloadHelper } from '../utils/download.js';

// ================================================================
// SRT 타임스탬프 파싱 유틸리티
// ================================================================

/**
 * SRT 시간 문자열을 초 단위로 변환
 * @param {string} timeStr - "00:00:02,500" 형식
 * @returns {number} 초 단위 시간
 */
function srtTimeToSeconds(timeStr) {
    const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!match) return 0;
    const [, h, m, s, ms] = match;
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

/**
 * SRT 데이터를 파싱하여 타임스탬프 배열 반환
 * @param {string} srtContent - SRT 형식 문자열
 * @returns {Array<{start: number, end: number, text: string}>}
 */
function parseSRTTimestamps(srtContent) {
    if (!srtContent) return [];

    const entries = [];
    const blocks = srtContent.trim().split(/\n\n+/);

    blocks.forEach(block => {
        const lines = block.trim().split('\n');
        if (lines.length >= 2) {
            const timeLine = lines.find(l => l.includes('-->'));
            if (timeLine) {
                const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
                entries.push({
                    start: srtTimeToSeconds(startStr),
                    end: srtTimeToSeconds(endStr),
                    text: lines.slice(lines.indexOf(timeLine) + 1).join(' ').trim()
                });
            }
        }
    });

    return entries;
}

/**
 * 전체 SRT의 총 길이(마지막 end 시간) 반환
 */
function getSRTTotalDuration(srtContent) {
    const entries = parseSRTTimestamps(srtContent);
    if (entries.length === 0) return 5; // 기본값
    return entries[entries.length - 1].end;
}

export class TTSModule extends Module {
    constructor() {
        super('tts', '2. 음성 생성 (TTS)', 'mic-2', 'Azure 및 ElevenLabs 음성 합성');
        this.voiceSettings = {
            engine: 'azure',  // Azure를 기본값으로 설정
            voiceId: 'ko-KR-SunHiNeural',  // Azure 한국어 기본 음성
            stability: 0.5,
            speed: 1.0
        };
        this.voices = { azure: [], elevenlabs: [], google: [] }; // 성우 리스트 캐시
    }

    // onMount moved to line ~544 to avoid duplication


    async loadVoices() {
        try {
            console.log('[TTSModule] Loading voices...');
            const voiceSelect = document.getElementById('tts-voice-id');
            const engineSelect = document.getElementById('tts-engine-id');

            if (!voiceSelect || !engineSelect) {
                console.error('[TTSModule] Select elements not found!');
                return;
            }

            // 로딩 상태 표시
            voiceSelect.innerHTML = '<option>성우 리스트 로딩 중...</option>';
            voiceSelect.disabled = true;

            const response = await fetch(`${API_BASE_URL}/api/tts/voices`);
            if (!response.ok) throw new Error('성우 리스트를 불러오는데 실패했습니다.');

            const data = await response.json();
            console.log('[TTSModule] API Response:', data);

            if (data.success) {
                this.voices = data.voices;

                if (!this.voices.elevenlabs || this.voices.elevenlabs.length === 0) {
                    console.info('[TTSModule] ElevenLabs API list is empty.');
                }

                console.log('[TTSModule] Voices loaded:', this.voices);
                this.updateVoiceList(); // 현재 선택된 엔진에 맞춰 리스트 업데이트
            } else {
                throw new Error(data.error || '성우 리스트 로드 실패');
            }

        } catch (error) {
            console.error('[TTSModule] Failed to load voices:', error);
            const voiceSelect = document.getElementById('tts-voice-id');
            if (voiceSelect) {
                voiceSelect.innerHTML = '<option>성우 리스트 로드 실패</option>';
            }
        } finally {
            const voiceSelect = document.getElementById('tts-voice-id');
            if (voiceSelect) voiceSelect.disabled = false;
        }
    }

    updateVoiceList() {
        const engineSelect = document.getElementById('tts-engine-id');
        const voiceSelect = document.getElementById('tts-voice-id');
        if (!engineSelect || !voiceSelect) return;

        const engine = engineSelect.value;
        const voices = this.voices[engine] || [];

        console.log(`[TTSModule] Updating list for engine: ${engine}, count: ${voices.length}`);

        voiceSelect.innerHTML = '';

        if (voices.length === 0) {
            voiceSelect.innerHTML = '<option value="">사용 가능한 성우가 없습니다</option>';
            return;
        }

        // [Feature] 성별로 성우 분류 (남성 / 여성 / 기타)
        const groups = {
            '여성': [],
            '남성': [],
            '기타': []
        };

        voices.forEach(voice => {
            const gender = voice.gender || '기타';
            if (gender.includes('여성') || gender === 'Female') {
                groups['여성'].push(voice);
            } else if (gender.includes('남성') || gender === 'Male') {
                groups['남성'].push(voice);
            } else {
                groups['기타'].push(voice);
            }
        });

        // 그룹별로 그룹핑하여 추가
        const groupConfigs = [
            { key: '여성', label: '👩 여성 성우 (Female)' },
            { key: '남성', label: '👨 남성 성우 (Male)' },
            { key: '기타', label: '👥 기타 (Others)' }
        ];

        groupConfigs.forEach(config => {
            const list = groups[config.key];
            if (list && list.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = config.label;

                list.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.id;

                    let label = voice.name || voice.id;
                    try {
                        if (engine === 'azure') {
                            const style = voice.style || 'General';
                            label = `${voice.display_name || voice.name} (${style})`;
                        } else if (engine === 'google') {
                            const nameKo = voice.name_ko || voice.name || voice.id;
                            const instruction = voice.base_instruction || '';
                            const shortInstr = instruction.length > 40 ? instruction.substring(0, 40) + '...' : instruction;
                            label = `${nameKo} - ${shortInstr}`;
                        } else if (engine === 'elevenlabs') {
                            const desc = voice.description || '';
                            label = `${voice.name} (${desc})`;
                        }
                    } catch (e) {
                        label = voice.name || voice.id;
                    }

                    option.textContent = label;
                    option.title = voice.description || '';
                    optgroup.appendChild(option);
                });
                voiceSelect.appendChild(optgroup);
            }
        });

        // 이전에 선택한 성우가 있다면 복원, 없으면 첫 번째 선택
        if (this.voiceSettings.voiceId && voices.some(v => v.id === this.voiceSettings.voiceId)) {
            voiceSelect.value = this.voiceSettings.voiceId;
        } else if (voiceSelect.options.length > 0) {
            // optgroup 안의 첫 번째 option 선택
            const firstOption = voiceSelect.querySelector('option');
            if (firstOption) {
                voiceSelect.value = firstOption.value;
                this.voiceSettings.voiceId = firstOption.value;
            }
        }
    }

    setupEventListeners() {
        // 엔진 변경 시 성우 리스트 업데이트
        const engineSelect = document.getElementById('tts-engine-id');
        if (engineSelect) {
            engineSelect.addEventListener('change', (e) => {
                this.voiceSettings.engine = e.target.value;
                this.updateVoiceList();
            });
        }

        // 성우 변경 시 설정 업데이트
        const voiceSelect = document.getElementById('tts-voice-id');
        if (voiceSelect) {
            voiceSelect.addEventListener('change', (e) => {
                this.voiceSettings.voiceId = e.target.value;
            });
        }

        // 속도, 안정성 슬라이더 이벤트 등...
        const rngSpeed = document.getElementById('rng-speed');
        const valSpeed = document.getElementById('val-speed');
        if (rngSpeed && valSpeed) {
            rngSpeed.addEventListener('input', (e) => {
                this.voiceSettings.speed = parseFloat(e.target.value);
                valSpeed.textContent = `${this.voiceSettings.speed}x`;
            });
        }

        const rngStability = document.getElementById('rng-stability');
        const valStability = document.getElementById('val-stability');
        if (rngStability && valStability) {
            rngStability.addEventListener('input', (e) => {
                this.voiceSettings.stability = parseFloat(e.target.value);
                valStability.textContent = e.target.value;
            });
        }

        // 미리듣기 버튼
        const btnPreview = document.getElementById('btn-preview-voice');
        if (btnPreview) {
            btnPreview.addEventListener('click', () => this.previewVoice());
        }

        // ... (기존 이벤트 리스너들)
    }

    async previewVoice() {
        const voiceId = this.voiceSettings.voiceId;
        const engine = this.voiceSettings.engine;
        const text = "안녕하세요, 제 목소리는 이렇게 들립니다.";

        if (!voiceId) return alert('성우를 선택해주세요.');

        try {
            const btnPreview = document.getElementById('btn-preview-voice');
            const originalIcon = btnPreview.innerHTML;
            btnPreview.disabled = true;
            btnPreview.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>';
            lucide.createIcons();

            const response = await fetch(`${API_BASE_URL}/api/generate-tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sceneId: 'preview',
                    text: text,
                    settings: this.voiceSettings
                })
            });

            const result = await response.json();
            if (result.success && (result.audioBase64 || result.audio_base64)) {
                const base64Data = result.audioBase64 || result.audio_base64;
                const audio = new Audio(`data:audio/mp3;base64,${base64Data}`);
                audio.play();

            } else {
                throw new Error(result.error || '미리듣기 생성 실패');
            }
        } catch (e) {
            console.error(e);
            alert('미리듣기 실패: ' + e.message);
        } finally {
            const btnPreview = document.getElementById('btn-preview-voice');
            if (btnPreview) {
                btnPreview.disabled = false;
                btnPreview.innerHTML = `<i data-lucide="volume-2" class="w-4 h-4"></i><span>미리듣기</span>`;
                lucide.createIcons();
            }
        }
    }

    render() {
        const scenes = AppState.getScenes();
        const fullScript = AppState.getScript(); // 전역 스크립트 가져오기

        const voiceSettingsPanel = `
            <div class="glass-card rounded-3xl p-8 border border-white/5 space-y-6">
                <div class="flex items-center gap-3 border-b border-white/5 pb-4">
                    <div class="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                        <i data-lucide="sliders" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-lg font-black text-white uppercase tracking-tight">보이스 프로젝트 설정</h3>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <!-- 1. Engine Selection -->
                    <div class="space-y-2">
                        <div class="flex items-center gap-2">
                            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">TTS Engine</label>
                            <span class="bg-indigo-500/20 text-indigo-400 text-[10px] px-1.5 rounded border border-indigo-500/30">Dual</span>
                        </div>
                        <select id="tts-engine-id" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-yellow-400 font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="azure">Azure (기본/무료) ⭐</option>
                            <option value="google">Google Gemini 2.5 (Generative)</option>
                            <option value="elevenlabs">ElevenLabs (프리미엄/유료)</option>
                        </select>
                        <p class="text-[10px] text-slate-500 leading-tight">
                            * Azure: 빠르고 안정적 (권장)<br>
                            * Gemini 2.5: 30인 페르소나와 감정 표현 (Generative)<br>
                            * ElevenLabs: 감성적/고품질 (유료)
                        </p>
                    </div>

                    <!-- 2. Voice Actor -->
                    <div class="space-y-2 col-span-1">
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Voice Actor</label>
                        <select id="tts-voice-id" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none">
                            <!-- Options will be populated dynamically based on engine -->
                        </select>
                        <button id="btn-preview-voice" class="w-full bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 border border-purple-500/30 text-purple-300 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 flex items-center justify-center gap-2">
                            <i data-lucide="volume-2" class="w-4 h-4"></i>
                            <span>미리듣기</span>
                        </button>
                    </div>

                    <!-- 3. Stability -->
                    <div class="space-y-2">
                        <div class="flex justify-between">
                            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Stability</label>
                            <span id="val-stability" class="text-xs font-mono text-blue-400">${this.voiceSettings.stability}</span>
                        </div>
                        <input type="range" id="rng-stability" min="0" max="1" step="0.05" value="${this.voiceSettings.stability}"
                            class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500">
                    </div>

                    <!-- 4. Speed -->
                    <div class="space-y-2">
                        <div class="flex justify-between">
                            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Speed</label>
                            <span id="val-speed" class="text-xs font-mono text-blue-400">${this.voiceSettings.speed}x</span>
                        </div>
                        <input type="range" id="rng-speed" min="0.5" max="2.0" step="0.1" value="${this.voiceSettings.speed}"
                            class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500">
                    </div>
                </div>
            </div>
        `;

        // 🟢 ALWAYS use Full Script Mode - forced to true (new workflow)
        if (true) { // Previously: scenes.length === 0
            return `
                <div class="max-w-4xl mx-auto slide-up space-y-6">
                    ${voiceSettingsPanel}

                    <div class="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-500/30 rounded-2xl p-6 mb-6">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                <i data-lucide="file-audio" class="w-5 h-5"></i>
                            </div>
                            <h3 class="text-lg font-bold text-white">📜 전체 대본 오디오 생성</h3>
                            <span class="ml-auto text-xs text-indigo-400 bg-indigo-500/20 px-3 py-1 rounded-full">Step 2: Voice Generation</span>
                        </div>
                        
                        <div class="space-y-4">
                            <div>
                                <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">전체 대본 (수정 가능)</label>
                                <textarea id="full-script-input" 
                                    class="w-full h-64 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none scrollbar-hide leading-relaxed"
                                    placeholder="대본을 입력하거나 자동으로 불러옵니다...">${fullScript || ''}</textarea>
                                <div class="flex justify-end mt-2 text-xs text-slate-500">
                                    <span id="full-script-char-count">${(fullScript || '').length}자</span>
                                </div>
                            </div>
                            
                            <!-- Progress Bar (Hidden by default) -->
                            <div id="tts-progress-container" class="hidden mb-4 bg-slate-900 border border-blue-500/30 rounded-lg p-4">
                                <div class="flex items-center gap-3 mb-3">
                                    <i data-lucide="loader" class="w-5 h-5 text-blue-400 animate-spin"></i>
                                    <div class="flex-1">
                                        <h4 class="text-sm font-bold text-white">TTS 생성 중...</h4>
                                        <p class="text-xs text-slate-400" id="tts-progress-status">API 호출 중...</p>
                                    </div>
                                </div>
                                <div class="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                    <div id="tts-progress-bar" class="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500" style="width: 0%"></div>
                                </div>
                                <p class="text-xs text-slate-500 mt-2 text-right" id="tts-progress-time">예상 시간: --</p>
                            </div>
                            
                             <div class="flex gap-4 pt-6">
                                <button id="btn-generate-full-audio" class="btn-primary-cinematic w-full px-8 py-5 rounded-2xl text-xl flex items-center justify-center gap-3">
                                    <i data-lucide="mic-2" class="w-6 h-6"></i> 
                                    <span>시네마틱 보이스 생성 시작</span>
                                </button>
                            </div>

                            <!-- Result Section (Hidden initially) -->
                            <div id="full-audio-result" class="hidden mt-6 p-6 bg-slate-900/80 border border-green-500/30 rounded-2xl space-y-4 animate-in fade-in zoom-in duration-300">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-3 text-green-400 text-lg font-bold">
                                        <i data-lucide="check-circle-2" class="w-6 h-6"></i>
                                        <span>오디오 생성 완료!</span>
                                    </div>
                                    <span id="full-audio-info" class="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-1 rounded"></span>
                                </div>
                                
                                <audio id="full-audio-player" controls class="w-full h-12 rounded-lg"></audio>
                                
                                <div class="grid grid-cols-2 gap-3 pt-2">
                                    <button id="btn-download-full-audio" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2">
                                        <i data-lucide="download" class="w-4 h-4"></i> 다운로드
                                    </button>
                                    <button id="btn-go-segmentation" class="bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-green-600/20">
                                        <span>다음: 오디오 세분화</span>
                                        <i data-lucide="arrow-right-circle" class="w-5 h-5"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        const sceneRows = scenes.map(scene => `
            <tr class="border-b border-slate-800/50 hover:bg-white/5 transition group ${scene.groupId ? 'bg-indigo-900/10' : ''}" id="tts-row-${scene.sceneId}">
                <td class="py-4 pl-4 text-center align-top pt-6">
                    <input type="checkbox" class="chk-tts-item rounded bg-slate-800 border-slate-600 text-blue-600 focus:ring-0" data-id="${scene.sceneId}">
                </td>
                <td class="py-4 pl-2 text-xs font-bold text-slate-500 align-top pt-6">
                    <div>#${scene.sceneId}</div>
                    ${scene.groupId ? `<div class="mt-1 text-[10px] text-indigo-400 font-mono bg-indigo-900/30 px-1 rounded inline-block">G-${scene.groupId}</div>` : ''}
                </td>
                <td class="py-4 px-4 w-1/2">
                    <div class="flex flex-col gap-2">
                        <textarea id="tts-script-${scene.sceneId}" 
                            class="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none h-24 scrollbar-hide"
                            placeholder="대본을 입력하세요...">${scene.scriptForTTS || scene.originalScript}</textarea>
                        <div class="flex justify-between text-xs text-slate-500 px-1">
                            <span><i data-lucide="edit-3" class="w-3 h-3 inline"></i> 편집 가능</span>
                            <span id="tts-char-count-${scene.sceneId}">${(scene.scriptForTTS || scene.originalScript).length}자</span>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-4 align-top pt-6">
                    <div class="flex flex-col gap-3">
                         <div class="bg-black/30 rounded-lg p-3 border border-slate-700/50 min-h-[60px] flex flex-col justify-center items-center relative" id="audio-container-${scene.sceneId}">
                            ${scene.audioUrl
                ? `<audio src="${scene.audioUrl}" controls class="w-full h-8" id="audio-player-${scene.sceneId}"></audio>
                                   <div class="mt-2 flex gap-2 w-full">
                                        <div class="flex-1 bg-green-900/30 text-green-400 text-[10px] font-mono px-2 py-1 rounded border border-green-500/30 flex items-center justify-center gap-1">
                                            <i data-lucide="check-circle-2" class="w-3 h-3"></i> ${scene.ttsEngine ? scene.ttsEngine.toUpperCase() : 'TTS'}
                                        </div>
                                        ${scene.ttsFallback ? `<div class="flex-1 bg-yellow-900/30 text-yellow-400 text-[9px] font-mono px-1 py-0.5 rounded border border-yellow-500/30">Fallback</div>` : ''}
                                   </div>`
                : `<span class="text-xs text-slate-600">오디오 미생성</span>`
            }
                        </div>
                    </div>
                </td>
                <td class="py-4 pr-6 text-right w-32 align-top pt-6">
                     <button class="btn-gen-tts w-full ${scene.audioUrl ? 'bg-orange-600 hover:bg-orange-500' : 'bg-slate-700 hover:bg-blue-600'} text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 mb-2"
                        data-id="${scene.sceneId}" data-has-audio="${scene.audioUrl ? 'true' : 'false'}">
                        <i data-lucide="${scene.audioUrl ? 'refresh-cw' : 'mic'}" class="w-3.5 h-3.5"></i> ${scene.audioUrl ? '재생성' : '생성'}
                    </button>
                    ${scene.audioUrl ? `
                    <button onclick="(async function(){ try { const resp = await fetch('${scene.audioUrl}'); const blob = await resp.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'voice_${scene.sceneId}.mp3'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); } catch(e) { console.error('다운로드 실패:', e); } })();"
                        class="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-2">
                        <i data-lucide="download" class="w-3 h-3"></i> 다운로드
                    </button>` : ''}
                </td>
            </tr>
        `).join('');

        return `
            <div class="max-w-6xl mx-auto slide-up space-y-6">

                <div class="flex items-center gap-2">
                    <!-- User Guide Button -->
                    ${this.renderGuideButton()}

                    <!-- Reset Button -->
                    <button id="btn-reset-tts" class="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 rounded-xl text-xs font-bold transition">
                        <i data-lucide="refresh-ccw" class="w-3.5 h-3.5"></i>
                        초기화
                    </button>
                </div>

                ${voiceSettingsPanel}

                <!-- Action Toolbar -->
                <div class="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                    <div class="flex items-center gap-4">
                        <span class="text-sm font-bold text-slate-400">총 <b>${scenes.length}</b>개 스크립트</span>
                        <div class="h-6 w-px bg-slate-700"></div>
                        <button id="btn-merge-tts" class="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2" disabled>
                            <i data-lucide="merge" class="w-4 h-4"></i> 선택 병합
                        </button>
                    </div>
                    <div class="flex gap-3">
                        <button id="btn-tts-gen-all" class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition flex items-center gap-2">
                            <i data-lucide="zap" class="w-4 h-4"></i> TTS 일괄 생성
                        </button>
                        <button id="btn-auto-merge" class="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-purple-600/20 transition flex items-center gap-2">
                             <i data-lucide="wand-2" class="w-4 h-4"></i> 문장 단위 자동 병합
                        </button>
                        <button id="btn-tts-play-all" class="bg-slate-700 hover:bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="play-circle" class="w-4 h-4"></i> 전체 이어듣기
                        </button>
                        <button id="btn-download-all-audio" class="bg-slate-700 hover:bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="download-cloud" class="w-4 h-4"></i> 오디오 일괄 다운로드
                        </button>
                        <button id="btn-load-whisper" class="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-orange-600/20 transition flex items-center gap-2">
                            <i data-lucide="file-audio" class="w-4 h-4"></i> Whisper 타임스탬프 불러오기
                        </button>
                    </div>
                </div>

                <!-- Scripts List -->
                <div class="bg-slate-800/20 border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-900/60 border-b border-slate-700">
                            <tr>
                                <th class="py-4 pl-4 w-12 text-center">
                                    <input type="checkbox" id="chk-tts-all" class="rounded bg-slate-800 border-slate-600 text-blue-600 focus:ring-0">
                                </th>
                                <th class="py-4 pl-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-16">ID (Grp)</th>
                                <th class="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-1/2">대본 편집</th>
                                <th class="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">오디오</th>
                                <th class="py-4 pr-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest w-32">액션</th>
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

    async onMount() {
        const scenes = AppState.getScenes();
        const self = this;

        // Initialize Call
        this.setupEventListeners();
        await this.loadVoices(); // Load voices immediately


        // Setup guide button
        this.setupGuideButton();

        // Restore saved TTS result
        const savedAudioPath = AppState.getAudioPath();
        if (savedAudioPath) {
            this.restoreTTSResult(savedAudioPath);
        }

        // Reset button
        const btnResetTTS = document.getElementById('btn-reset-tts');
        if (btnResetTTS) {
            btnResetTTS.addEventListener('click', () => {
                if (confirm('⚠️ 모든 작업 내용이 삭제됩니다.\n\n정말 초기화하시겠습니까?')) {
                    AppState.startNewProject();
                    location.reload();
                }
            });
        }

        // Auto Merge Logic
        const btnAutoMerge = document.getElementById('btn-auto-merge');
        if (btnAutoMerge) {
            btnAutoMerge.addEventListener('click', async () => {
                if (!confirm("모든 장면을 '문장(groupId)' 단위로 자동 병합하고 TTS를 생성하시겠습니까?\n\n기존 개별 TTS 데이터는 덮어씌워집니다.")) return;

                // Grouping Logic
                const groups = {};
                scenes.forEach(s => {
                    const gid = s.groupId || s.sceneId; // Fallback to unique if no group
                    if (!groups[gid]) groups[gid] = [];
                    groups[gid].push(s);
                });

                btnAutoMerge.disabled = true;
                const originalHtml = btnAutoMerge.innerHTML;
                btnAutoMerge.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 처리 중...`;
                lucide.createIcons();

                try {
                    for (const gid in groups) {
                        const group = groups[gid];
                        if (group.length === 0) continue;

                        const firstId = group[0].sceneId;

                        // Combine text
                        let combinedText = group.map(s => s.scriptForTTS || s.originalScript).join(' ').trim();

                        // Update First Scene
                        const firstScene = scenes.find(s => s.sceneId == firstId);
                        firstScene.scriptForTTS = combinedText;

                        // Generate API Call
                        const success = await generateTTS(firstId, null, true);

                        if (success) {
                            // Parse SRT to get timestamps for each scene
                            const srtEntries = parseSRTTimestamps(firstScene.srtData);
                            const totalDuration = getSRTTotalDuration(firstScene.srtData);
                            const avgDuration = totalDuration / group.length;

                            // Mark leader scene with merge info and timestamps
                            firstScene.isMergeLeader = true;
                            firstScene.mergeGroupId = gid;
                            firstScene.totalMergedDuration = totalDuration;

                            // Assign timestamps to each scene in the group
                            group.forEach((s, idx) => {
                                const scene = scenes.find(k => k.sceneId == s.sceneId);

                                // SRT 엔트리 매칭 시도, 없거나 invalid하면 균등 분배
                                let entry = srtEntries[idx];
                                if (!entry || entry.end <= entry.start) {
                                    entry = {
                                        start: idx * avgDuration,
                                        end: (idx + 1) * avgDuration
                                    };
                                }

                                scene.startTime = entry.start;
                                scene.endTime = entry.end;
                                scene.duration = entry.end - entry.start;  // 명시적 duration 저장
                                scene.mergeGroupId = gid;

                                // 최소 1초 duration 보장
                                if (scene.duration < 1) {
                                    scene.duration = Math.max(3, avgDuration);
                                    scene.endTime = scene.startTime + scene.duration;
                                }

                                // For non-leader scenes, mark as merged and share audio
                                if (idx > 0) {
                                    scene.audioUrl = firstScene.audioUrl;
                                    scene.scriptForTTS = `(Merged to #${firstId}: Group ${gid})`;
                                    scene.srtData = firstScene.srtData;
                                    scene.isMergeLeader = false;
                                }
                            });

                            console.log(`✅ Group ${gid}: ${group.length} scenes merged with timestamps`, {
                                totalDuration,
                                avgDuration,
                                scenes: group.map((s, i) => {
                                    const sc = scenes.find(k => k.sceneId == s.sceneId);
                                    return {
                                        sceneId: s.sceneId,
                                        start: sc.startTime,
                                        end: sc.endTime,
                                        duration: sc.duration
                                    };
                                })
                            });
                        }
                    }

                    // ⭐ CRITICAL: Persist changes to AppState before re-rendering
                    AppState.setScenes(scenes);

                    alert("문장 단위 자동 병합 및 생성이 완료되었습니다!");
                    if (window.app) window.app.route('tts');

                } catch (e) {
                    console.error(e);
                    alert("자동 병합 실패: " + e.message);
                } finally {
                    btnAutoMerge.disabled = false;
                    btnAutoMerge.innerHTML = originalHtml;
                    lucide.createIcons();
                }
            });
        }

        // Checkbox Logic
        const chkAll = document.getElementById('chk-tts-all');
        const chkItems = document.querySelectorAll('.chk-tts-item');
        const btnMerge = document.getElementById('btn-merge-tts');

        const updateMergeBtn = () => {
            const count = document.querySelectorAll('.chk-tts-item:checked').length;
            if (btnMerge) {
                btnMerge.disabled = count < 2;
                btnMerge.innerHTML = `<i data-lucide="merge" class="w-4 h-4"></i> ${count}개 병합 생성`;
                lucide.createIcons();
            }
        };

        if (chkAll) {
            chkAll.addEventListener('change', (e) => {
                chkItems.forEach(chk => chk.checked = e.target.checked);
                updateMergeBtn();
            });
        }

        chkItems.forEach(chk => {
            chk.addEventListener('change', updateMergeBtn);
        });

        // Merge & Generate Logic
        if (btnMerge) {
            btnMerge.addEventListener('click', async () => {
                const selectedChks = Array.from(document.querySelectorAll('.chk-tts-item:checked'));
                if (selectedChks.length < 2) return;

                const selectedIds = selectedChks.map(chk => parseInt(chk.getAttribute('data-id'))).sort((a, b) => a - b);
                const firstId = selectedIds[0];
                const otherIds = selectedIds.slice(1);

                // Combine Text
                let combinedText = "";
                selectedIds.forEach(id => {
                    const scene = AppState.getScenes().find(s => s.sceneId == id);
                    const text = scene.scriptForTTS || scene.originalScript;
                    if (text && text.trim() !== "" && !text.includes("(Merged")) {
                        combinedText += text + " ";
                    }
                });
                combinedText = combinedText.trim();

                if (!combinedText) return alert("병합할 텍스트가 없습니다.");
                if (!confirm(`선택한 ${selectedIds.length}개 장면의 대본을 하나로 합쳐서 생성합니다.\n\n합친 대본: "${combinedText.substring(0, 50)}..."`)) return;

                // Update UI state
                btnMerge.disabled = true;
                const originalBtnText = btnMerge.innerHTML;
                btnMerge.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 병합 생성 중...`;
                lucide.createIcons();

                try {
                    // Update First Scene's Script
                    const firstScene = AppState.getScenes().find(s => s.sceneId == firstId);
                    firstScene.scriptForTTS = combinedText;

                    // Call API for First Scene
                    const success = await generateTTS(firstId, null, true); // true = raw return

                    if (success) {
                        // Share audio with others
                        otherIds.forEach(id => {
                            const scene = AppState.getScenes().find(s => s.sceneId == id);
                            scene.audioUrl = firstScene.audioUrl; // Share URL
                            scene.scriptForTTS = `(Merged to #${firstId})`;
                            scene.srtData = firstScene.srtData; // Share subtitle data
                        });

                        // ⭐ Persist changes
                        AppState.setScenes(AppState.getScenes());

                        // Refresh view
                        if (window.app) window.app.route('tts');
                        alert("병합 생성 완료!");
                    }

                } catch (e) {
                    console.error(e);
                    alert("병합 생성 실패: " + e.message);
                } finally {
                    btnMerge.disabled = false;
                    btnMerge.innerHTML = originalBtnText;
                    lucide.createIcons();
                }
            });
        }

        // Standalone add items
        const standaloneInput = document.getElementById('standalone-tts-input');
        const btnAddItems = document.getElementById('btn-standalone-add-items');
        const btnStandaloneTts = document.getElementById('btn-standalone-tts-gen');

        if (btnAddItems) {
            btnAddItems.addEventListener('click', () => {
                const text = standaloneInput?.value.trim();
                if (!text) return alert('대본을 입력해주세요.');

                const lines = text.split('\n').filter(line => line.trim());
                const currentScenes = AppState.getScenes();
                const startId = currentScenes.length > 0 ? Math.max(...currentScenes.map(s => s.sceneId)) + 1 : 1;

                const newScenes = lines.map((line, index) => ({
                    sceneId: startId + index,
                    originalScript: line.trim(),
                    scriptForTTS: line.trim(),
                    imagePrompt: '',
                    motionPrompt: '',
                    generatedUrl: null,
                    videoUrl: null,
                    audioUrl: null,
                    srtData: null
                }));

                AppState.setScenes([...currentScenes, ...newScenes]);
                standaloneInput.value = '';
                alert(`${newScenes.length}개의 TTS 항목이 추가되었습니다.`);

                if (window.app) window.app.route('tts');
            });
        }

        if (btnStandaloneTts) {
            btnStandaloneTts.addEventListener('click', async () => {
                const text = standaloneInput?.value.trim();
                if (!text) return alert('대본을 입력해주세요.');

                btnStandaloneTts.disabled = true;
                const originalText = btnStandaloneTts.innerHTML;
                const startTime = Date.now();
                btnStandaloneTts.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 생성 중...`;
                lucide.createIcons();

                try {
                    const payload = {
                        sceneId: 'standalone',
                        text: text,
                        settings: self.voiceSettings
                    };

                    const response = await fetch(`${CONFIG.endpoints.tts}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) throw new Error(`서버 오류: ${response.status}`);

                    const result = await response.json();
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    let audioUrl = result.audioUrl;

                    // Handle Base64
                    if (result.audioBase64) {
                        audioUrl = `data:audio/mp3;base64,${result.audioBase64}`;
                    }

                    if (audioUrl) {
                        const engine = result.usedEngine || result.engine || '알 수 없음';

                        // Show audio player
                        const audioResult = document.getElementById('standalone-audio-result');
                        const audioPlayer = document.getElementById('standalone-audio-player');
                        const audioInfo = document.getElementById('standalone-tts-info');
                        const btnDownload = document.getElementById('btn-standalone-download');

                        if (audioResult && audioPlayer) {
                            audioResult.classList.remove('hidden');
                            audioPlayer.src = audioUrl;
                            audioInfo.textContent = `엔진: ${engine} · ${elapsed}초`;

                            // Setup download button (Blob 방식으로 전체화면 전환 방지)
                            if (btnDownload) {
                                btnDownload.onclick = async () => {
                                    try {
                                        const resp = await fetch(audioUrl);
                                        const blob = await resp.blob();
                                        const blobUrl = URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = blobUrl;
                                        link.download = `standalone_tts_${Date.now()}.mp3`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        URL.revokeObjectURL(blobUrl);
                                    } catch (e) {
                                        console.error('다운로드 실패:', e);
                                    }
                                };
                            }

                            lucide.createIcons();
                        }
                    } else {
                        throw new Error('오디오 URL이 없습니다.');
                    }
                } catch (e) {
                    console.error(e);
                    const errorMsg = e.message || '알 수 없는 오류';
                    const errorLower = errorMsg.toLowerCase();

                    let helpText = '\n\n💡 해결 방법:\n';
                    if (errorLower.includes('timeout') || errorLower.includes('시간 초과')) {
                        helpText += '• 대본 길이를 줄이거나 분할해보세요.\n• 잠시 후 다시 시도해보세요.';
                    } else if (errorLower.includes('api 키') || errorLower.includes('인증')) {
                        helpText += '• 설정 메뉴에서 API 키를 확인하세요.\n• Azure TTS는 별도 API 키가 필요하지 않습니다.';
                    } else if (errorLower.includes('rate limit')) {
                        helpText += '• API 사용 한도를 초과했습니다.\n• Azure TTS로 전환해보세요.';
                    } else {
                        helpText += '• 인터넷 연결을 확인하세요.\n• 백엔드 서버가 실행 중인지 확인하세요.';
                    }

                    alert(`❌ TTS 생성 실패\n\n오류: ${errorMsg}${helpText}`);
                } finally {
                    btnStandaloneTts.disabled = false;
                    btnStandaloneTts.innerHTML = originalText;
                    lucide.createIcons();
                }
            });
        }

        // Full Script Generation
        const btnGenFull = document.getElementById('btn-generate-full-audio');
        if (btnGenFull) {
            btnGenFull.addEventListener('click', async () => {
                const scriptInput = document.getElementById('full-script-input');
                const text = scriptInput?.value.trim();

                if (!text) return alert('생성할 대본이 없습니다.');

                btnGenFull.disabled = true;
                const originalText = btnGenFull.innerHTML;
                const startTime = Date.now();
                btnGenFull.innerHTML = `<i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i> 생성 중... (0:00)`;
                lucide.createIcons();

                // Declare outside try block for cleanup
                let controller = new AbortController();
                let timeoutId = setTimeout(() => controller.abort(), 20 * 60 * 1000); // 20 minutes
                let elapsedInterval = null;

                // Update elapsed time every second
                elapsedInterval = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    const minutes = Math.floor(elapsed / 60);
                    const seconds = elapsed % 60;
                    btnGenFull.innerHTML = `<i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i> 생성 중... (${minutes}:${seconds.toString().padStart(2, '0')})`;
                    lucide.createIcons();
                }, 1000);

                try {
                    // 서버로 요청
                    const payload = {
                        sceneId: 'full_script',
                        text: text,
                        settings: this.voiceSettings
                    };

                    const response = await fetch(`${CONFIG.endpoints.tts}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    });

                    // Clear timeout and interval
                    clearTimeout(timeoutId);
                    clearInterval(elapsedInterval);

                    if (!response.ok) throw new Error(`서버 오류: ${response.status}`);

                    const result = await response.json();
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log('[TTS] Full Audio Generated:', result);

                    if (result.success) {
                        const audioUrl = result.audioUrl || (result.audioBase64 ? `data:audio/mp3;base64,${result.audioBase64}` : null);
                        const audioPath = result.audioPath;

                        if (audioUrl) {
                            // UI 표시
                            const resDiv = document.getElementById('full-audio-result');
                            const player = document.getElementById('full-audio-player');
                            const info = document.getElementById('full-audio-info');
                            const btnDownload = document.getElementById('btn-download-full-audio');
                            const btnGoSeg = document.getElementById('btn-go-segmentation');

                            if (resDiv && player) {
                                resDiv.classList.remove('hidden');
                                player.src = audioUrl;
                                if (info) info.textContent = `${result.usedEngine || 'Engine'} · ${elapsed}s`;

                                // AppState 저장
                                AppState.setScript(text); // 수정된 대본 저장
                                AppState.setAudioPath(audioPath); // 서버 경로 저장 (세분화용)

                                console.log(`💾 Audio Path Saved: ${audioPath}`);

                                if (btnDownload) {
                                    btnDownload.onclick = async () => {
                                        try {
                                            const resp = await fetch(audioUrl);
                                            const blob = await resp.blob();
                                            const blobUrl = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = blobUrl;
                                            a.download = `full_script_${Date.now()}.mp3`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(blobUrl);
                                        } catch (e) {
                                            console.error('다운로드 실패:', e);
                                        }
                                    };
                                }

                                if (btnGoSeg) {
                                    btnGoSeg.onclick = () => {
                                        console.log('➡️ Moving to Audio Segmentation Module');
                                        if (window.app) window.app.route('audio-segmentation');
                                    };
                                }
                            }
                        } else {
                            throw new Error("오디오 URL을 받지 못했습니다.");
                        }
                    } else {
                        throw new Error(result.error || "생성 실패");
                    }

                } catch (e) {
                    console.error('[TTS] Error:', e);

                    // Check if this is a timeout error
                    const isTimeout = e.name === 'AbortError';
                    const errorMsg = isTimeout
                        ? '⏱️ TTS 생성 시간이 20분을 초과했습니다.\n\n대본이 너무 길 수 있습니다. 대본을 짧게 분할하거나 Azure TTS로 전환해보세요.'
                        : `생성 실패: ${e.message}`;

                    alert(`❌ ${errorMsg}`);
                    this.hideTTSProgress();
                } finally {
                    // Cleanup: Clear timeout and interval
                    if (timeoutId) clearTimeout(timeoutId);
                    if (elapsedInterval) clearInterval(elapsedInterval);

                    btnGenFull.disabled = false;
                    btnGenFull.innerHTML = originalText;
                    lucide.createIcons();
                    // Hide progress bar after 2 seconds
                    setTimeout(() => this.hideTTSProgress(), 2000);
                }
            });
        }

        // ---------------------------------------------------------
        // Legacy code removed: Conflicting voice/engine selection logic
        // Handled by TTSModule.setupEventListeners() and updateVoiceList()
        // ---------------------------------------------------------


        // Generate TTS helper
        const generateTTS = async (sceneId, btn, isInternal = false) => {
            // ⭐ CRITICAL FIX: Get scenes array once and modify it directly
            const scenes = AppState.getScenes();
            const scene = scenes.find(s => s.sceneId == sceneId);
            const textArea = document.getElementById(`tts-script-${sceneId}`);
            let updatedScript = scene.scriptForTTS;

            // If called from button (not internal), update from textarea
            if (textArea && !isInternal) {
                updatedScript = textArea.value.trim();
                scene.scriptForTTS = updatedScript;
            }

            if (!updatedScript) {
                if (!isInternal) alert("대본 내용이 없습니다.");
                return false;
            }

            const audioContainer = document.getElementById(`audio-container-${sceneId}`);
            let originalBtnHtml = "";
            let elapsedInterval = null;  // Declare outside try block for cleanup

            if (btn) {
                originalBtnHtml = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> 생성 중`;
                lucide.createIcons();
            }

            try {
                const payload = {
                    sceneId: sceneId,
                    text: updatedScript,
                    settings: self.voiceSettings  // Use 'self' instead of 'this'
                };

                console.log(`🎤 TTS 요청 시작 (Scene ${sceneId})`, payload);

                // Create AbortController for 20-minute timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 20 * 60 * 1000); // 20 minutes

                // Track elapsed time
                const startTime = Date.now();

                // Update button with elapsed time every second (if button exists)
                if (btn && !isInternal) {
                    elapsedInterval = setInterval(() => {
                        const elapsed = Math.floor((Date.now() - startTime) / 1000);
                        const minutes = Math.floor(elapsed / 60);
                        const seconds = elapsed % 60;
                        btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> 생성 중 (${minutes}:${seconds.toString().padStart(2, '0')})`;
                        lucide.createIcons();
                    }, 1000);
                }

                const response = await fetch(`${CONFIG.endpoints.tts}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                // Clear timeout and interval
                clearTimeout(timeoutId);
                if (elapsedInterval) clearInterval(elapsedInterval);

                const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`📡 TTS 응답 수신 (Status: ${response.status}, Elapsed: ${totalElapsed}s)`);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`❌ TTS 서버 오류:`, errorText);
                    throw new Error(`서버 오류: ${response.status} - ${errorText}`);
                }

                const result = await response.json();
                console.log(`✅ TTS 결과:`, result);

                // 결과 검증
                if (!result.success) {
                    console.error(`❌ TTS 생성 실패:`, result.error);
                    throw new Error(result.error || "TTS 생성 실패");
                }

                // Drive URL 우선 사용 (Creatomate 호환성)
                // Base64는 즉시 재생용으로만 사용
                const driveUrl = result.audioUrl;
                const base64Url = result.audioBase64
                    ? `data:audio/mp3;base64,${result.audioBase64}`
                    : null;

                // 저장은 Drive URL 우선, 미리보기는 Base64 우선 (즉시 재생 가능)
                const previewUrl = base64Url || driveUrl;
                const persistUrl = driveUrl || base64Url;

                if (persistUrl) {
                    // 엔진 정보 추출
                    const usedEngine = result.usedEngine || result.engine || 'unknown';
                    const processingTime = result.processingTimeSeconds || 0;
                    const fallbackUsed = result.fallbackUsed || false;

                    // Scene에 TTS 데이터 저장
                    scene.audioUrl = persistUrl;  // Creatomate용 Drive URL 저장
                    scene.ttsEngine = usedEngine;  // 사용된 엔진 저장
                    scene.ttsFallback = fallbackUsed;  // Fallback 여부 저장
                    if (result.srtData) scene.srtData = result.srtData;
                    if (result.srt) scene.srtData = result.srt;  // srt 필드도 체크

                    // SRT에서 duration 추출하여 저장
                    if (scene.srtData) {
                        scene.audioDuration = getSRTTotalDuration(scene.srtData);
                        // Set scene.duration to match audio length
                        if (!scene.duration || scene.duration === 5) {
                            scene.duration = scene.audioDuration;
                        }
                    }

                    // ⭐ CRITICAL FIX: Save the modified scenes array (not a fresh copy!)
                    AppState.setScenes([...scenes]);

                    // Debug: Verify the save worked
                    const verifyScene = AppState.getScenes().find(s => s.sceneId == sceneId);
                    console.log(`✅ TTS audio saved to scene #${scene.sceneId}:`, {
                        audioUrl: verifyScene.audioUrl ? `${verifyScene.audioUrl.substring(0, 50)}...` : 'MISSING!',
                        srtData: verifyScene.srtData ? `${verifyScene.srtData.length} chars` : 'MISSING!',
                        audioDuration: verifyScene.audioDuration || 'MISSING!',
                        duration: verifyScene.duration || 'not set',
                        engine: usedEngine
                    });

                    // 엔진별 색상
                    const engineColor = usedEngine === 'elevenlabs'
                        ? 'bg-purple-900/30 text-purple-400 border-purple-500/30'
                        : 'bg-blue-900/30 text-blue-400 border-blue-500/30';
                    const engineLabel = usedEngine === 'elevenlabs' ? 'ElevenLabs' : 'Azure';

                    if (audioContainer) {
                        audioContainer.innerHTML = `
                            <audio src="${previewUrl}" controls class="w-full h-8" id="audio-player-${sceneId}"></audio>
                            <div class="mt-2 flex gap-2 w-full">
                                <div class="flex-1 bg-green-900/30 text-green-400 text-[10px] font-mono px-2 py-1 rounded border border-green-500/30 flex items-center justify-center gap-1">
                                    <i data-lucide="check-circle-2" class="w-3 h-3"></i> Ready
                                </div>
                                <div class="${engineColor} text-[10px] font-mono px-2 py-1 rounded border flex items-center gap-1">
                                    <i data-lucide="cpu" class="w-3 h-3"></i> ${engineLabel}
                                </div>
                                ${fallbackUsed ? `<div class="bg-yellow-900/30 text-yellow-400 text-[10px] font-mono px-2 py-1 rounded border border-yellow-500/30">Fallback</div>` : ''}
                            </div>
                            ${processingTime > 0 ? `<div class="text-[9px] text-slate-500 mt-1 text-right">${processingTime.toFixed(1)}s</div>` : ''}
                        `;
                        lucide.createIcons();
                    }
                    console.log(`💾 오디오 저장 완료 (Scene ${sceneId})`);
                    return true;
                } else {
                    console.error(`❌ 오디오 URL 없음:`, result);
                    throw new Error("서버에서 오디오 URL을 반환하지 않았습니다");
                }
            } catch (e) {
                console.error(e);

                // Check if this is an abort error (timeout)
                const isTimeout = e.name === 'AbortError';

                if (!isInternal) {
                    const errorMsg = isTimeout
                        ? '⏱️ TTS 생성 시간이 20분을 초과했습니다.'
                        : (e.message || '알 수 없는 오류');
                    const errorLower = errorMsg.toLowerCase();

                    let helpText = '\n\n💡 해결 방법:\n';
                    if (isTimeout || errorLower.includes('timeout') || errorLower.includes('시간 초과') || errorLower.includes('abort')) {
                        helpText += '• 대본이 너무 길 수 있습니다. 대본을 짧게 분할해보세요.\n';
                        helpText += '• Google TTS의 경우 긴 대본은 처리 시간이 오래 걸립니다.\n';
                        helpText += '• Azure TTS로 전환하거나 대본 길이를 줄여보세요.';
                    } else if (errorLower.includes('network') || errorLower.includes('fetch')) {
                        helpText += '• 인터넷 연결을 확인하세요.\n• 백엔드 서버가 실행 중인지 확인하세요 (localhost:8000).';
                    } else if (errorLower.includes('api 키') || errorLower.includes('api key') || errorLower.includes('인증')) {
                        helpText += '• 설정 메뉴에서 TTS API 키를 확인하세요.\n• Azure TTS는 무료로 사용 가능합니다.';
                    } else if (errorLower.includes('rate limit') || errorLower.includes('한도')) {
                        helpText += '• API 사용 한도를 초과했습니다.\n• Azure TTS로 전환하거나 잠시 후 다시 시도하세요.';
                    } else if (errorLower.includes('text') || errorLower.includes('대본')) {
                        helpText += '• 대본 내용이 비어있거나 너무 짧습니다.\n• 유효한 텍스트를 입력해주세요.';
                    } else {
                        helpText += '• 잠시 후 다시 시도해보세요.\n• Azure TTS (무료)로 전환해보세요.';
                    }

                    alert(`❌ TTS 생성 실패\n\nScene #${sceneId}\n오류: ${errorMsg}${helpText}`);
                }
                return false;
            } finally {
                // Cleanup: Clear interval and restore button
                if (elapsedInterval) {
                    clearInterval(elapsedInterval);
                }
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalBtnHtml;
                    lucide.createIcons();
                }
            }
        };

        // Individual TTS generation with regeneration confirmation
        document.querySelectorAll('.btn-gen-tts').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = btn.getAttribute('data-id');
                const hasAudio = btn.getAttribute('data-has-audio') === 'true';

                // 재생성인 경우 확인
                if (hasAudio) {
                    if (!confirm(`Scene #${sceneId}의 TTS를 재생성하시겠습니까?\n\n기존 오디오가 덮어씌워집니다.`)) {
                        return;
                    }
                }

                generateTTS(sceneId, btn);
            });
        });

        // Batch TTS generation
        const btnGenAll = document.getElementById('btn-tts-gen-all');
        if (btnGenAll) {
            btnGenAll.addEventListener('click', async () => {
                const btns = Array.from(document.querySelectorAll('.btn-gen-tts'));
                if (!confirm(`총 ${btns.length}개의 TTS를 병렬 생성합니다.\n(최대 8개씩 동시 생성)\n\n계속하시겠습니까?`)) return;

                btnGenAll.disabled = true;
                const originalText = btnGenAll.innerHTML;
                const batchStartTime = Date.now();
                let successCount = 0;
                let errorCount = 0;
                let completed = 0;

                // 병렬 처리 (8개씩 동시 실행)
                await processInBatches(btns, 8, async (btn) => {
                    const id = btn.getAttribute('data-id');

                    // Update progress display
                    btnGenAll.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> ${completed}개 생성 / 총 ${btns.length}개`;
                    lucide.createIcons();

                    const success = await generateTTS(id, btn);
                    if (success) {
                        successCount++;
                    } else {
                        errorCount++;
                    }

                    completed++;

                    // Update after generation
                    btnGenAll.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> ${completed}개 생성 / 총 ${btns.length}개`;
                    lucide.createIcons();
                }, () => { })

                const totalElapsed = ((Date.now() - batchStartTime) / 1000).toFixed(1);
                const avgTimePerTTS = successCount > 0 ? (parseFloat(totalElapsed) / successCount).toFixed(1) : 0;
                const successRate = ((successCount / btns.length) * 100).toFixed(0);

                btnGenAll.disabled = false;
                btnGenAll.innerHTML = originalText;
                lucide.createIcons();

                // Enhanced completion message with statistics
                if (errorCount === 0) {
                    alert(`✅ TTS 일괄 생성 완료!\n\n` +
                        `📊 통계:\n` +
                        `• 성공: ${successCount}/${btns.length}개 (${successRate}%)\n` +
                        `• 총 처리 시간: ${totalElapsed}초\n` +
                        `• 평균 생성 시간: ${avgTimePerTTS}초/TTS`
                    );
                } else {
                    alert(`⚠️ TTS 일괄 생성 완료 (일부 실패)\n\n` +
                        `📊 통계:\n` +
                        `• 성공: ${successCount}개\n` +
                        `• 실패: ${errorCount}개\n` +
                        `• 총 처리 시간: ${totalElapsed}초\n` +
                        `• 평균 생성 시간: ${avgTimePerTTS}초/TTS\n\n` +
                        `💡 실패한 장면은 개별적으로 다시 시도하거나\nAzure TTS로 전환해보세요.`
                    );
                }
            });
        }

        // Sequential playback
        const btnPlayAll = document.getElementById('btn-tts-play-all');
        if (btnPlayAll) {
            btnPlayAll.addEventListener('click', async () => {
                const audioElements = [];
                AppState.getScenes().forEach(s => {
                    if (s.audioUrl) {
                        const el = document.getElementById(`audio-player-${s.sceneId}`);
                        if (el) audioElements.push(el);
                    }
                });

                if (audioElements.length === 0) return alert("재생할 오디오가 없습니다.");

                audioElements.forEach(el => { el.pause(); el.currentTime = 0; });

                btnPlayAll.disabled = true;
                btnPlayAll.innerHTML = `<i data-lucide="volume-2" class="w-4 h-4 animate-pulse"></i> 재생 중...`;
                lucide.createIcons();

                const playNext = (index) => {
                    if (index >= audioElements.length) {
                        btnPlayAll.disabled = false;
                        btnPlayAll.innerHTML = `<i data-lucide="play-circle" class="w-4 h-4"></i> 전체 이어듣기`;
                        lucide.createIcons();
                        return;
                    }

                    const current = audioElements[index];
                    current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    current.parentElement.classList.add('ring-2', 'ring-blue-500');

                    current.play().catch(e => console.log("Auto-play blocked", e));

                    current.onended = () => {
                        current.parentElement.classList.remove('ring-2', 'ring-blue-500');
                        playNext(index + 1);
                    };
                };

                playNext(0);
            });
        }

        // Batch TTS Generation
        // Batch TTS Generation
        const btnTTSGenAll = document.getElementById('btn-tts-gen-all');

        const runBatchTTS = async (auto = false) => {
            const scenesWithoutAudio = AppState.getScenes().filter(s => !s.audioUrl);

            if (scenesWithoutAudio.length === 0) {
                if (!auto) alert("모든 장면에 이미 오디오가 생성되어 있습니다.");
                else {
                    console.log("✅ Auto TTS completed (all scenes have audio).");
                    // if (AppState.getAutomation('video') && window.app) window.app.route('video');
                }
                return;
            }

            if (!auto && !confirm(`총 ${scenesWithoutAudio.length}개의 TTS를 생성하시겠습니까?\n\n이 작업은 시간이 걸릴 수 있습니다.`)) return;

            if (btnTTSGenAll) {
                btnTTSGenAll.disabled = true;
                btnTTSGenAll.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 생성 중... (0/${scenesWithoutAudio.length})`;
                lucide.createIcons();
            }

            let completed = 0;
            let failed = 0;
            const batchStartTime = Date.now();

            // Update elapsed time periodically
            const batchInterval = setInterval(() => {
                if (btnTTSGenAll) {
                    const elapsed = Math.floor((Date.now() - batchStartTime) / 1000);
                    const minutes = Math.floor(elapsed / 60);
                    const seconds = elapsed % 60;
                    btnTTSGenAll.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 생성 중... (${completed + failed}/${scenesWithoutAudio.length}) - ${minutes}:${seconds.toString().padStart(2, '0')}`;
                    lucide.createIcons();
                }
            }, 1000);

            // 순차적으로 TTS 생성 (동시 생성 시 서버 부하 방지)
            for (const scene of scenesWithoutAudio) {
                try {
                    // 기존 로직 재사용 (generateTTS function is in scope)
                    // isInternal = true로 설정하여 alert 방지하고 boolean 반환값 사용
                    const success = await generateTTS(scene.sceneId, null, true);
                    if (success) completed++;
                    else {
                        failed++;
                        console.error(`❌ Scene ${scene.sceneId} TTS 생성 실패`);
                    }
                } catch (e) {
                    console.error(`Scene ${scene.sceneId} TTS failed:`, e);
                    failed++;
                }

                // 서버 부하 방지를 위한 딜레이
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Cleanup interval
            clearInterval(batchInterval);

            // 완료
            const totalElapsed = ((Date.now() - batchStartTime) / 1000).toFixed(1);
            const avgTime = completed > 0 ? (parseFloat(totalElapsed) / completed).toFixed(1) : '0.0';

            if (btnTTSGenAll) {
                btnTTSGenAll.disabled = false;
                btnTTSGenAll.innerHTML = `<i data-lucide="zap" class="w-4 h-4"></i> TTS 일괄 생성`;
                lucide.createIcons();
            }

            if (!auto) {
                if (failed === 0) {
                    alert(`✅ TTS 일괄 생성 완료!\n\n` +
                        `📊 통계:\n` +
                        `• 성공: ${completed}/${scenesWithoutAudio.length}개\n` +
                        `• 총 처리 시간: ${totalElapsed}초\n` +
                        `• 평균 생성 시간: ${avgTime}초/TTS`);
                } else {
                    alert(`⚠️ TTS 일괄 생성 완료 (일부 실패)\n\n` +
                        `📊 통계:\n` +
                        `• 성공: ${completed}개\n` +
                        `• 실패: ${failed}개\n` +
                        `• 총 처리 시간: ${totalElapsed}초\n` +
                        `• 평균 생성 시간: ${avgTime}초/TTS\n\n` +
                        `💡 해결 방법:\n` +
                        `• 실패한 장면은 개별적으로 다시 시도해보세요.\n` +
                        `• Azure TTS로 전환하거나 대본을 짧게 수정해보세요.\n` +
                        `• 긴 대본의 경우 20분 타임아웃이 발생할 수 있습니다.`);
                }
            } else {
                console.log(`✅ Auto TTS batch completed. Success: ${completed}, Failed: ${failed}, Elapsed: ${totalElapsed}s`);
                // 다음 단계 자동 이동 로직 (Video)
                if (window.app) window.app.route('video');
            }

            // UI 새로고침 (이미지 등이 업데이트 되었을 수 있음)
            if (window.app) window.app.route('tts');
        };

        if (btnTTSGenAll) {
            btnTTSGenAll.addEventListener('click', () => runBatchTTS(false));
        }

        // Auto Start Logic
        if (AppState.getAutomation('tts')) {
            setTimeout(() => {
                const scenes = AppState.getScenes();
                if (scenes.length > 0 && scenes.some(s => !s.audioUrl)) {
                    console.log('🤖 Auto-starting batch TTS generation...');
                    runBatchTTS(true);
                }
            }, 1000);
        }

        // Batch download all audio (improved with ZIP + timestamps)
        const btnDownloadAll = document.getElementById('btn-download-all-audio');
        if (btnDownloadAll) {
            btnDownloadAll.addEventListener('click', async () => {
                const scenesWithAudio = AppState.getScenes().filter(s => s.audioUrl && !s.audioUrl.startsWith('data:'));

                if (scenesWithAudio.length === 0) {
                    return alert("다운로드할 오디오 파일이 없습니다.\n(Base64 인코딩된 오디오는 제외됩니다)");
                }

                if (!confirm(`총 ${scenesWithAudio.length}개의 오디오를 ZIP으로 다운로드하시겠습니까?`)) return;

                try {
                    btnDownloadAll.disabled = true;
                    btnDownloadAll.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> ZIP 생성 중...`;
                    lucide.createIcons();

                    const files = [];

                    for (const scene of scenesWithAudio) {
                        // MP3 파일
                        files.push({
                            filename: `scene_${String(scene.sceneId).padStart(3, '0')}.mp3`,
                            url: scene.audioUrl
                        });

                        // 타임스탬프 JSON (SRT → JSON 변환)
                        if (scene.srtData) {
                            const timestamps = parseSRTTimestamps(scene.srtData);
                            files.push({
                                filename: `scene_${String(scene.sceneId).padStart(3, '0')}_timestamps.json`,
                                content: JSON.stringify(timestamps, null, 2)
                            });
                        }
                    }

                    await DownloadHelper.downloadAsZip(files, `tts_audio_${Date.now()}.zip`);
                    alert(`✅ ${scenesWithAudio.length}개 오디오가 ZIP으로 다운로드되었습니다.`);

                } catch (error) {
                    console.error('ZIP 다운로드 실패:', error);
                    alert(`❌ 다운로드 실패: ${error.message}`);
                } finally {
                    btnDownloadAll.disabled = false;
                    btnDownloadAll.innerHTML = `<i data-lucide="download-cloud" class="w-4 h-4"></i> 오디오 일괄 다운로드`;
                    lucide.createIcons();
                }
            });
        }

        // Whisper 타임스탬프 불러오기
        const btnLoadWhisper = document.getElementById('btn-load-whisper');
        if (btnLoadWhisper) {
            btnLoadWhisper.addEventListener('click', async () => {
                // 파일 선택 다이얼로그
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'audio/mp3,audio/wav,audio/m4a,audio/*';

                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                        btnLoadWhisper.disabled = true;
                        btnLoadWhisper.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Whisper 분석 중...`;
                        lucide.createIcons();

                        // FormData로 파일 업로드
                        const formData = new FormData();
                        formData.append('file', file);

                        const response = await fetch(`${CONFIG.endpoints.transcribeWhisper}`, {
                            method: 'POST',
                            body: formData
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Whisper API 오류 (${response.status}): ${errorText}`);
                        }

                        const result = await response.json();

                        if (!result.success || !result.timestamps) {
                            throw new Error('타임스탬프를 받지 못했습니다.');
                        }

                        // 타임스탬프를 씬에 적용
                        const scenes = AppState.getScenes();
                        const timestamps = result.timestamps;

                        console.log(`[Whisper] ${timestamps.length}개 타임스탬프 로드됨`);
                        console.log('[Whisper] 전체 텍스트:', result.fullText);

                        // 각 타임스탬프를 씬으로 분리 (간단한 1:1 매핑)
                        // 만약 씬 개수보다 타임스탬프가 많으면 새 씬 생성
                        for (let i = 0; i < timestamps.length; i++) {
                            const ts = timestamps[i];

                            if (i < scenes.length) {
                                // 기존 씬에 적용
                                scenes[i].scriptText = ts.text;
                                scenes[i].whisperStart = ts.start;
                                scenes[i].whisperEnd = ts.end;
                                scenes[i].whisperDuration = ts.end - ts.start;
                            } else {
                                // 새 씬 생성
                                scenes.push({
                                    sceneId: i + 1,
                                    scriptText: ts.text,
                                    whisperStart: ts.start,
                                    whisperEnd: ts.end,
                                    whisperDuration: ts.end - ts.start
                                });
                            }
                        }

                        AppState.setScenes(scenes);

                        alert(`✅ Whisper 타임스탬프 로드 완료!\n\n총 ${timestamps.length}개 구간\n\n전체 텍스트:\n${result.fullText.substring(0, 200)}...`);

                        // 모듈 새로고침
                        if (window.app) {
                            window.app.route('tts');
                        }

                    } catch (error) {
                        console.error('[Whisper] 오류:', error);
                        alert(`❌ Whisper 타임스탬프 로드 실패:\n${error.message}`);
                    } finally {
                        btnLoadWhisper.disabled = false;
                        btnLoadWhisper.innerHTML = `<i data-lucide="file-audio" class="w-4 h-4"></i> Whisper 타임스탬프 불러오기`;
                        lucide.createIcons();
                    }
                };

                input.click();
            });
        }

        lucide.createIcons();
    }

    // Restore TTS result from saved state
    restoreTTSResult(audioPath) {
        const resDiv = document.getElementById('full-audio-result');
        const player = document.getElementById('full-audio-player');
        const info = document.getElementById('full-audio-info');
        const btnDownload = document.getElementById('btn-download-full-audio');
        const btnGoSeg = document.getElementById('btn-go-segmentation');

        if (resDiv && player) {
            resDiv.classList.remove('hidden');

            // Convert server path to URL
            const filename = audioPath.split(/[/\\]/).pop();
            const baseUrl = API_BASE_URL || 'http://localhost:8000';
            const normalizedPath = String(audioPath).replace(/\\/g, '/');
            const outputMarker = '/output/';
            const outputIdx = normalizedPath.indexOf(outputMarker);
            const audioUrl = outputIdx !== -1
                ? `${baseUrl}/output/${normalizedPath.substring(outputIdx + outputMarker.length)}`
                : `${baseUrl}/output/${filename}`;
            player.src = audioUrl;

            if (info) info.textContent = 'TTS 저장됨 · 이전 세션';

            // Set up download button (Blob 방식으로 전체화면 전환 방지)
            if (btnDownload) {
                btnDownload.onclick = async () => {
                    try {
                        const resp = await fetch(audioUrl);
                        const blob = await resp.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = `full_script_${Date.now()}.mp3`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                    } catch (e) {
                        console.error('다운로드 실패:', e);
                    }
                };
            }

            // Set up go to segmentation button
            if (btnGoSeg) {
                btnGoSeg.onclick = () => {
                    console.log('➡️ Moving to Audio Segmentation Module');
                    if (window.app) window.app.route('audio-segmentation');
                };
            }

            console.log('✅ TTS Result Restored:', audioPath);
            lucide.createIcons();
        }
    }

    // Show TTS progress bar
    showTTSProgress(status = 'API 호출 중...', progress = 10) {
        const container = document.getElementById('tts-progress-container');
        const bar = document.getElementById('tts-progress-bar');
        const statusEl = document.getElementById('tts-progress-status');
        const timeEl = document.getElementById('tts-progress-time');

        if (container) {
            container.classList.remove('hidden');
            if (bar) bar.style.width = `${progress}%`;
            if (statusEl) statusEl.textContent = status;
            if (timeEl) timeEl.textContent = progress < 100 ? '예상 시간: 30-60초' : '완료!';
            lucide.createIcons();
        }
    }

    // Hide TTS progress bar
    hideTTSProgress() {
        const container = document.getElementById('tts-progress-container');
        if (container) {
            container.classList.add('hidden');
        }
    }
}
