// ================================================================
// TTS MODULE - TTS 녹음실
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG } from '../config.js';
import { processInBatches } from '../utils.js';

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
        super('tts', 'TTS 녹음실', 'mic-2', 'ElevenLabs 및 Azure 음성 합성');
        this.voiceSettings = {
            engine: 'elevenlabs',
            voiceId: 'zcAOhNBS3c14rBihAFp1',
            stability: 0.5,
            speed: 1.0
        };
    }

    render() {
        const scenes = AppState.getScenes();

        const standalonePanel = `
            <div class="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-2xl p-6 mb-6">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                        <i data-lucide="zap" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white">🚀 독립 실행 모드</h3>
                    <span class="ml-auto text-xs text-blue-400 bg-blue-500/20 px-3 py-1 rounded-full">분석 없이 바로 TTS</span>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">대본 직접 입력</label>
                        <textarea id="standalone-tts-input" 
                            class="w-full h-32 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none scrollbar-hide"
                            placeholder="여기에 대본을 직접 입력하세요."></textarea>
                    </div>
                    
                    <div class="flex gap-3">
                        <button id="btn-standalone-add-items" class="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2">
                            <i data-lucide="plus-circle" class="w-4 h-4"></i> 목록에 추가
                        </button>
                        <button id="btn-standalone-tts-gen" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2">
                            <i data-lucide="mic" class="w-4 h-4"></i> 즉시 TTS 생성
                        </button>
                    </div>

                    <!-- Audio Player & Download Section (initially hidden) -->
                    <div id="standalone-audio-result" class="hidden mt-4 p-4 bg-slate-900/50 border border-green-500/30 rounded-xl space-y-3">
                        <div class="flex items-center gap-2 text-green-400 text-sm font-semibold">
                            <i data-lucide="check-circle" class="w-5 h-5"></i>
                            <span>TTS 생성 완료!</span>
                            <span id="standalone-tts-info" class="ml-auto text-xs text-slate-400"></span>
                        </div>
                        <audio id="standalone-audio-player" controls class="w-full h-10"></audio>
                        <button id="btn-standalone-download" class="w-full bg-gradient-to-r from-green-600/20 to-blue-600/20 hover:from-green-600/30 hover:to-blue-600/30 border border-green-500/30 text-green-300 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>오디오 다운로드</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Voice Settings Panel - 씬 유무와 관계없이 항상 표시
        const voiceSettingsPanel = `
            <div class="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                <div class="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
                    <div class="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                        <i data-lucide="sliders" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white">보이스 설정 (Global Settings)</h3>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <!-- 1. Engine Selection -->
                    <div class="space-y-2">
                        <div class="flex items-center gap-2">
                            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">TTS Engine</label>
                            <span class="bg-indigo-500/20 text-indigo-400 text-[10px] px-1.5 rounded border border-indigo-500/30">Dual</span>
                        </div>
                        <select id="tts-engine-id" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-yellow-400 font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="elevenlabs" selected>ElevenLabs (Premium)</option>
                            <option value="azure">Azure (Basic/Free)</option>
                        </select>
                        <p class="text-[10px] text-slate-500 leading-tight">
                            * ElevenLabs: 감성적/고품질<br>
                            * Azure: 빠르고 안정적 (무료)
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

        if (scenes.length === 0) {
            return `
                <div class="max-w-4xl mx-auto slide-up space-y-6">
                    ${voiceSettingsPanel}
                    ${standalonePanel}

                    <div class="text-center p-10 text-slate-500 border border-dashed border-slate-700 rounded-2xl">
                        <i data-lucide="list-plus" class="w-12 h-12 mx-auto mb-4 opacity-50"></i>
                        <h3 class="text-lg font-bold">TTS 항목이 없습니다</h3>
                        <p class="text-sm mt-2">위 입력창에서 대본을 입력하고 "목록에 추가" 버튼을 누르세요.</p>
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
                    <button onclick="const a = document.createElement('a'); a.href='${scene.audioUrl}'; a.download='voice_${scene.sceneId}.mp3'; a.click();"
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

    onMount() {
        const scenes = AppState.getScenes();
        const self = this;

        // Setup guide button
        this.setupGuideButton();

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

                    const response = await fetch(CONFIG.endpoints.tts, {
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

                            // Setup download button
                            if (btnDownload) {
                                btnDownload.onclick = () => {
                                    const link = document.createElement('a');
                                    link.href = audioUrl;
                                    link.download = `standalone_tts_${Date.now()}.mp3`;
                                    link.click();
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

        // Voice settings
        const updateSetting = (key, val, displayId) => {
            if (key === 'voiceId' || key === 'engine') val = String(val);
            else val = parseFloat(val);

            this.voiceSettings[key] = val;
            if (displayId) {
                const el = document.getElementById(displayId);
                if (el) el.innerText = key === 'speed' ? val + 'x' : val;
            }
        };

        const selEngine = document.getElementById('tts-engine-id');
        const selVoice = document.getElementById('tts-voice-id');

        const voices = {
            elevenlabs: [
                { id: "pNInz6obpgDQGcFmaJgB", name: "아담 (Adam) - 남성 · 다국어 · 깊고 신뢰감" },
                { id: "21m00Tcm4TlvDq8ikWAM", name: "레이첼 (Rachel) - 여성 · 다국어 · 차분하고 전문적" },
                { id: "AZnzlk1XvdvUeBnXmlld", name: "도미 (Domi) - 여성 · 다국어 · 밝고 친근함" },
                { id: "EXAVITQu4vr4xnSDxMaL", name: "벨라 (Bella) - 여성 · 다국어 · 세련되고 우아함" },
                { id: "ErXwobaYiN019PkySvjV", name: "안토니 (Antoni) - 남성 · 다국어 · 명랑하고 젊음" },
                { id: "MF3mGyEYCl7XYWbV9V6O", name: "엔조 (Enzo) - 남성 · 다국어 · 부드럽고 나레이션" },
                { id: "TxGEqnHWrfWFTfGW9XjX", name: "조쉬 (Josh) - 남성 · 다국어 · 활기차고 뉴스 스타일" },
                { id: "VR6AewLTigWG4xSOukaG", name: "아놀드 (Arnold) - 남성 · 다국어 · 강인하고 웅장함" }
            ],
            azure: [] // Will be loaded from API
        };

        // Fetch Azure voices from API
        const fetchAzureVoices = async () => {
            try {
                const response = await fetch('/api/tts/voices?engine=azure');
                const data = await response.json();
                if (data.success && data.voices) {
                    voices.azure = data.voices;
                    console.log(`[TTS] Loaded ${data.voices.length} Azure voices`);
                }
            } catch (error) {
                console.error('[TTS] Failed to fetch Azure voices:', error);
                // Fallback to basic voice
                voices.azure = [{
                    name: "ko-KR-SunHiNeural",
                    display_name: "선희 (SunHi)",
                    gender: "여성",
                    type: "Neural",
                    style: "밝고 친근함"
                }];
            }
        };

        const updateVoiceOptions = async (engine) => {
            if (!selVoice) return;
            selVoice.innerHTML = '';

            // Fetch Azure voices if needed
            if (engine === 'azure' && voices.azure.length === 0) {
                await fetchAzureVoices();
            }

            const engineVoices = voices[engine] || voices['elevenlabs'];
            const group = document.createElement('optgroup');
            group.label = engine === 'azure' ? 'Azure Voices' : 'ElevenLabs Voices';

            engineVoices.forEach(v => {
                const opt = document.createElement('option');

                // Format based on engine
                if (engine === 'azure' && v.gender) {
                    // Azure: use 'name' field (e.g., "ko-KR-SunHiNeural") as value
                    opt.value = v.name;
                    // Display as: "선희 (SunHi) - 여성 · Neural · 밝고 친근함"
                    opt.textContent = `${v.display_name} - ${v.gender} · ${v.type} · ${v.style}`;
                    // Add description as tooltip
                    if (v.description) {
                        opt.title = v.description;
                    }
                } else {
                    // ElevenLabs: keep original format
                    opt.value = v.id;
                    opt.textContent = v.name;
                }

                group.appendChild(opt);
            });

            selVoice.appendChild(group);

            // Set first option as default and update settings
            if (engineVoices.length > 0) {
                const firstVoice = engineVoices[0];
                const voiceId = engine === 'azure' ? firstVoice.name : firstVoice.id;
                selVoice.value = voiceId;
                updateSetting('voiceId', voiceId);
            }
        };

        if (selEngine) {
            selEngine.value = this.voiceSettings.engine || 'elevenlabs';
            selEngine.addEventListener('change', async (e) => {
                const engine = e.target.value;
                updateSetting('engine', engine);
                await updateVoiceOptions(engine);
            });
            // Init voice list (if voiceSettings has engine) - must await
            (async () => {
                await updateVoiceOptions(this.voiceSettings.engine || 'elevenlabs');
                // After voices are loaded, set the voiceId
                if (selVoice) {
                    const currentEngine = this.voiceSettings.engine || 'elevenlabs';
                    const engineVoices = voices[currentEngine] || [];

                    // Check if current voiceId exists in the engine's voice list
                    const voiceExists = engineVoices.some(v =>
                        (currentEngine === 'azure' ? v.name : v.id) === this.voiceSettings.voiceId
                    );

                    if (voiceExists) {
                        selVoice.value = this.voiceSettings.voiceId;
                    } else {
                        // If voiceId doesn't exist, use first voice
                        if (engineVoices.length > 0) {
                            const firstVoiceId = currentEngine === 'azure' ? engineVoices[0].name : engineVoices[0].id;
                            selVoice.value = firstVoiceId;
                            updateSetting('voiceId', firstVoiceId);
                        }
                    }

                    selVoice.addEventListener('change', (e) => updateSetting('voiceId', e.target.value));
                }
            })();
        }

        const rngStability = document.getElementById('rng-stability');
        if (rngStability) rngStability.addEventListener('input', (e) => updateSetting('stability', e.target.value, 'val-stability'));

        const rngSpeed = document.getElementById('rng-speed');
        if (rngSpeed) rngSpeed.addEventListener('input', (e) => updateSetting('speed', e.target.value, 'val-speed'));

        // Preview voice button
        const btnPreview = document.getElementById('btn-preview-voice');
        if (btnPreview) {
            btnPreview.addEventListener('click', async () => {
                const voiceId = this.voiceSettings.voiceId;

                if (!voiceId) {
                    alert('성우를 선택해주세요.');
                    return;
                }

                const originalHtml = btnPreview.innerHTML;
                btnPreview.disabled = true;
                btnPreview.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>생성 중...</span>`;
                lucide.createIcons();

                try {
                    const sampleText = '안녕하세요. 이 음성으로 녹음됩니다.';

                    const payload = {
                        sceneId: 0, // Preview scene
                        text: sampleText,
                        settings: this.voiceSettings
                    };

                    const response = await fetch(CONFIG.endpoints.tts, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        throw new Error(`서버 오류: ${response.status}`);
                    }

                    const result = await response.json();

                    if (!result.success) {
                        throw new Error(result.error || 'TTS 생성 실패');
                    }

                    // Play preview audio
                    const audioUrl = result.audioBase64
                        ? `data:audio/mp3;base64,${result.audioBase64}`
                        : result.audioUrl;

                    if (audioUrl) {
                        const audio = new Audio(audioUrl);
                        audio.volume = 0.8;
                        await audio.play();
                        console.log('[Preview] Playing voice preview');
                    }

                } catch (error) {
                    console.error('[Preview] Error:', error);
                    alert(`미리듣기 실패: ${error.message}`);
                } finally {
                    btnPreview.disabled = false;
                    btnPreview.innerHTML = originalHtml;
                    lucide.createIcons();
                }
            });
        }

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

                const response = await fetch(CONFIG.endpoints.tts, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                console.log(`📡 TTS 응답 수신 (Status: ${response.status})`);

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
                if (!isInternal) {
                    const errorMsg = e.message || '알 수 없는 오류';
                    const errorLower = errorMsg.toLowerCase();

                    let helpText = '\n\n💡 해결 방법:\n';
                    if (errorLower.includes('timeout') || errorLower.includes('시간 초과')) {
                        helpText += '• 음성 합성은 시간이 걸릴 수 있습니다. 잠시 후 다시 시도하세요.\n• 대본 길이를 줄이거나 분할해보세요.';
                    } else if (errorLower.includes('network') || errorLower.includes('fetch')) {
                        helpText += '• 인터넷 연결을 확인하세요.\n• 백엔드 서버가 실행 중인지 확인하세요 (localhost:8000).';
                    } else if (errorLower.includes('api 키') || errorLower.includes('api key') || errorLower.includes('인증')) {
                        helpText += '• 설정 메뉴에서 ElevenLabs 또는 Azure API 키를 확인하세요.\n• Azure TTS는 무료로 사용 가능합니다.';
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
                }, () => {})

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

            // 순차적으로 TTS 생성 (동시 생성 시 서버 부하 방지)
            for (const scene of scenesWithoutAudio) {
                try {
                    // 기존 로직 재사용 (generateTTS function is in scope)
                    // isInternal = true로 설정하여 alert 방지하고 boolean 반환값 사용
                    const success = await generateTTS(scene.sceneId, null, true);
                    if (success) completed++;
                    else failed++;
                } catch (e) {
                    console.error(`Scene ${scene.sceneId} TTS failed:`, e);
                    failed++;
                }

                // 진행 상황 업데이트
                if (btnTTSGenAll) {
                    btnTTSGenAll.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 생성 중... (${completed + failed}/${scenesWithoutAudio.length})`;
                    lucide.createIcons();
                }

                // 서버 부하 방지를 위한 딜레이
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 완료
            if (btnTTSGenAll) {
                btnTTSGenAll.disabled = false;
                btnTTSGenAll.innerHTML = `<i data-lucide="zap" class="w-4 h-4"></i> TTS 일괄 생성`;
                lucide.createIcons();
            }

            if (!auto) {
                alert(`✅ TTS 일괄 생성 완료!\n\n성공: ${completed}개\n실패: ${failed}개`);
            } else {
                console.log(`✅ Auto TTS batch completed. Success: ${completed}, Failed: ${failed}`);
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

        // Batch download all audio
        const btnDownloadAll = document.getElementById('btn-download-all-audio');
        if (btnDownloadAll) {
            btnDownloadAll.addEventListener('click', () => {
                const scenesWithAudio = AppState.getScenes().filter(s => s.audioUrl && !s.audioUrl.startsWith('data:'));

                if (scenesWithAudio.length === 0) {
                    return alert("다운로드할 오디오 파일이 없습니다.\n(Base64 인코딩된 오디오는 제외됩니다)");
                }

                if (!confirm(`총 ${scenesWithAudio.length}개의 오디오 파일을 다운로드하시겠습니까?`)) return;

                btnDownloadAll.disabled = true;
                btnDownloadAll.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 다운로드 중...`;
                lucide.createIcons();

                // 순차적으로 다운로드 (브라우저 제한 방지)
                scenesWithAudio.forEach((scene, index) => {
                    setTimeout(() => {
                        const link = document.createElement('a');
                        link.href = scene.audioUrl;
                        link.download = `tts_scene_${scene.sceneId}_${Date.now()}.mp3`;
                        link.click();

                        // 마지막 다운로드 후 버튼 복원
                        if (index === scenesWithAudio.length - 1) {
                            setTimeout(() => {
                                btnDownloadAll.disabled = false;
                                btnDownloadAll.innerHTML = `<i data-lucide="download-cloud" class="w-4 h-4"></i> 오디오 일괄 다운로드`;
                                lucide.createIcons();
                            }, 500);
                        }
                    }, index * 800); // 800ms 간격으로 다운로드
                });

                // 사용자 피드백
                alert(`${scenesWithAudio.length}개 오디오 파일 다운로드를 시작합니다.\n잠시만 기다려주세요.`);
            });
        }

        lucide.createIcons();
    }
}
