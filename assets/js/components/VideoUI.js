import { AppState } from '../state.js';
import { CONFIG } from '../config.js';

/**
 * Video UI Component
 * 최종 편집실의 HTML 렌더링을 전담하는 View 클래스입니다.
 */
export class VideoUI {
    // Helper to ensure correct asset URLs (pointing to Backend 8000)
    static getAssetUrl(url) {
        if (!url) return '';
        if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
        // Remove leading slash if present to avoid double slashes
        const cleanPath = url.startsWith('/') ? url.substring(1) : url;
        return `${CONFIG.apiBaseUrl || 'http://localhost:8000'}/${cleanPath}`;
    }

    static countReadyScenes(scenes) {
        let complete = 0;
        let partial = 0;
        let missing = 0;

        scenes.forEach(s => {
            const hasVisual = !!(s.videoUrl || s.generatedUrl);
            const hasAudio = !!s.audioUrl;

            if (hasVisual && hasAudio) {
                complete++;
            } else if (hasVisual || hasAudio) {
                partial++;
            } else {
                missing++;
            }
        });

        return { complete, partial, missing };
    }

    static analyzeAssetStatus(scenes) {
        /**
         * 모든 장면의 자산 상태를 분석하여 누락된 항목 파악
         */
        const missingVisuals = [];
        const missingAudio = [];
        const missingBoth = [];
        let readyCount = 0;

        scenes.forEach(scene => {
            const hasVisual = !!(scene.videoUrl || scene.generatedUrl);
            const hasAudio = !!scene.audioUrl;

            if (!hasVisual && !hasAudio) {
                missingBoth.push(scene.sceneId);
            } else if (!hasVisual) {
                missingVisuals.push(scene.sceneId);
            } else if (!hasAudio) {
                missingAudio.push(scene.sceneId);
            } else {
                readyCount++;
            }
        });

        const hasIssues = missingVisuals.length > 0 || missingAudio.length > 0 || missingBoth.length > 0;

        return {
            hasIssues,
            missingVisuals,
            missingAudio,
            missingBoth,
            readyCount,
            totalScenes: scenes.length
        };
    }

    static render(scenes, assetStatus, readyScenes, isEmpty) {
        const sceneRows = scenes.map(scene => this.renderSceneRow(scene)).join('');

        return `
            <div class="max-w-7xl mx-auto space-y-8 slide-up">
                <!--Header Toolbar -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <button id="btn-toggle-timeline" class="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition">
                            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                            타임라인 보기
                        </button>
                        <button id="btn-add-scene" class="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-indigo-600 border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition">
                            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                            장면 추가
                        </button>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="btn-reset-video" class="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 rounded-xl text-xs font-bold transition">
                            <i data-lucide="refresh-ccw" class="w-3.5 h-3.5"></i>
                            초기화
                        </button>
                    </div>
                </div>

                <!--Asset Status Warning (if applicable) -->
                ${assetStatus.hasIssues ? this.renderAssetWarning(assetStatus) : ''}
                <!--Status Bar -->
                <div class="flex justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-xl">
                    <div class="flex items-center gap-6">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Scenes</span>
                            <span class="text-2xl font-black text-white italic">${scenes.length}</span>
                        </div>
                        <div class="h-10 w-px bg-white/5"></div>
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ready Status</span>
                            <div class="flex items-center gap-2">
                                <b class="text-green-400">${readyScenes.complete}</b>
                                <span class="text-slate-600">/</span>
                                <b class="text-yellow-400">${readyScenes.partial}</b>
                                <span class="text-slate-600">/</span>
                                <b class="text-red-400">${readyScenes.missing}</b>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <button id="btn-export-vrew" class="btn-primary-cinematic px-8 py-3 rounded-2xl flex items-center gap-3">
                            <i data-lucide="file-video" class="w-5 h-5"></i>
                            <span class="font-black italic uppercase tracking-tighter text-lg">Vrew Export</span>
                        </button>
                        <button id="btn-gen-final-video" class="glass-card hover:bg-white/5 text-white px-8 py-3 rounded-2xl flex items-center gap-3 border border-white/10 transition-all font-black italic uppercase tracking-tighter text-lg" ${readyScenes.complete === 0 ? 'disabled' : ''}>
                            <i data-lucide="clapperboard" class="w-5 h-5 text-blue-500"></i>
                            <span>Final Render</span>
                        </button>
                    </div>
                </div>

                <!--Progress Display (Hidden by default) -->
                <div id="task-progress-container" class="hidden bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700 rounded-2xl p-6 shadow-2xl">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="relative">
                                <i data-lucide="loader-2" class="w-6 h-6 text-blue-400 animate-spin"></i>
                            </div>
                            <div>
                                <h3 id="task-progress-title" class="text-lg font-bold text-white">작업 진행 중...</h3>
                                <p id="task-elapsed-time" class="text-xs text-slate-500">경과 시간: 0:00</p>
                            </div>
                        </div>
                        <div id="task-progress-percent" class="text-3xl font-black text-blue-400">0%</div>
                    </div>
                    <div class="mb-3">
                        <div class="w-full bg-slate-900 rounded-full h-3 overflow-hidden">
                            <div id="task-progress-bar" class="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 transition-all duration-500 relative" style="width: 0%">
                                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                            </div>
                        </div>
                        <p id="task-progress-message" class="text-sm text-slate-400 mt-3 font-medium">준비 중...</p>
                    </div>
                    <button id="btn-cancel-task" class="mt-2 text-xs text-red-400 hover:text-red-300 transition">
                        <i data-lucide="x-circle" class="w-3 h-3 inline mr-1"></i> 작업 취소
                    </button>
                </div>

                <!--Final Video Preview (Hidden by default) -->
                <div id="final-video-container" class="hidden bg-gradient-to-br from-slate-800/60 to-green-900/20 border border-green-700/50 rounded-3xl p-6 shadow-2xl">
                    <div class="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
                        <div class="p-2 bg-green-500/20 rounded-lg text-green-400">
                            <i data-lucide="check-circle-2" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-white">최종 영상 생성 완료!</h3>
                            <p id="final-video-stats" class="text-xs text-slate-400"></p>
                        </div>
                    </div>
                    <div class="aspect-video bg-black rounded-xl overflow-hidden mb-4 ring-2 ring-green-500/30">
                        <video id="final-video-player" controls class="w-full h-full"></video>
                    </div>
                    <div class="flex justify-between items-center">
                        <div class="text-sm text-slate-400">
                            <span id="final-video-info"></span>
                        </div>
                        <button id="btn-download-final" class="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-lg shadow-green-600/20">
                            <i data-lucide="download" class="w-4 h-4"></i> 최종 영상 다운로드
                        </button>
                    </div>
                </div>

                <!--Scene List (Detailed View) -->
                <div class="bg-slate-800/20 border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl">
                    <div class="bg-slate-900/60 border-b border-slate-700 px-6 py-4">
                        <div class="flex items-center justify-between">
                            <h3 class="text-sm font-bold text-white flex items-center gap-2">
                                <i data-lucide="list" class="w-4 h-4 text-slate-400"></i>
                                상세 씬 목록
                            </h3>
                            <span class="text-xs text-slate-500">에셋 관리 및 편집</span>
                        </div>
                    </div>
                    <table class="w-full text-left">
                        <thead class="bg-slate-900/60 border-b border-slate-700">
                            <tr>
                                <th class="py-4 pl-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-16">상태</th>
                                <th class="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-1/3">Visual Asset</th>
                                <th class="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-1/3">Audio & Subtitle</th>
                                <th class="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">옵션</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${isEmpty
                ? `<tr>
                                    <td colspan="4" class="py-16 text-center">
                                        <div class="flex flex-col items-center gap-4 text-slate-500">
                                            <i data-lucide="inbox" class="w-16 h-16 opacity-20"></i>
                                            <div>
                                                <p class="text-lg font-bold mb-2">씬이 없습니다</p>
                                                <p class="text-sm mb-4">스크립트 모듈에서 대본을 작성하고 씬을 생성하세요</p>
                                                <button onclick="app.route('script')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-bold transition">
                                                    <i data-lucide="file-text" class="w-4 h-4 inline mr-2"></i>
                                                    스크립트 모듈로 이동
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>`
                : sceneRows
            }
                        </tbody>
                    </table>
                </div>

                <!--Metadata Generation Panel -->
                ${this.renderMetadataPanel()}

                <!--Thumbnail Generation Panel -->
                ${this.renderThumbnailPanel()}

                <!--Service Stats (Initially hidden) -->
                <div id="video-service-stats" class="hidden bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4">
                    <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Video Service Stats</h4>
                    <div class="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <div id="stat-total-videos" class="text-2xl font-bold text-white">-</div>
                            <div class="text-[10px] text-slate-500">총 생성</div>
                        </div>
                        <div>
                            <div id="stat-total-duration" class="text-2xl font-bold text-blue-400">-</div>
                            <div class="text-[10px] text-slate-500">총 재생시간</div>
                        </div>
                        <div>
                            <div id="stat-avg-process-time" class="text-2xl font-bold text-green-400">-</div>
                            <div class="text-[10px] text-slate-500">평균 처리시간</div>
                        </div>
                        <div>
                            <div id="stat-success-rate" class="text-2xl font-bold text-purple-400">-</div>
                            <div class="text-[10px] text-slate-500">성공률</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    static renderAssetWarning(assetStatus) {
        const warnings = [];

        if (assetStatus.missingBoth.length > 0) {
            warnings.push({
                type: 'critical',
                icon: 'alert-triangle',
                color: 'red',
                title: '이미지/비디오 & 오디오 모두 없음',
                sceneIds: assetStatus.missingBoth,
                actions: [
                    { label: '이미지 생성하기', module: 'image', icon: 'image' },
                    { label: 'TTS 생성하기', module: 'tts', icon: 'mic' }
                ]
            });
        }

        if (assetStatus.missingVisuals.length > 0) {
            warnings.push({
                type: 'warning',
                icon: 'image-off',
                color: 'yellow',
                title: '이미지/비디오 누락',
                sceneIds: assetStatus.missingVisuals,
                actions: [
                    { label: '이미지 생성하기', module: 'image', icon: 'image' },
                    { label: '모션 생성하기', module: 'motion', icon: 'video' }
                ]
            });
        }

        if (assetStatus.missingAudio.length > 0) {
            warnings.push({
                type: 'warning',
                icon: 'volume-x',
                color: 'orange',
                title: '오디오 누락',
                sceneIds: assetStatus.missingAudio,
                actions: [
                    { label: 'TTS 생성하기', module: 'tts', icon: 'mic' }
                ]
            });
        }

        const colorMap = {
            red: { bg: 'bg-red-900/20', border: 'border-red-500/30', text: 'text-red-400', iconBg: 'bg-red-500/20' },
            yellow: { bg: 'bg-yellow-900/20', border: 'border-yellow-500/30', text: 'text-yellow-400', iconBg: 'bg-yellow-500/20' },
            orange: { bg: 'bg-orange-900/20', border: 'border-orange-500/30', text: 'text-orange-400', iconBg: 'bg-orange-500/20' }
        };

        return `
            <div class="bg-gradient-to-r from-red-900/10 to-orange-900/10 border border-red-500/20 rounded-2xl p-6">
                <div class="flex items-start gap-4 mb-4">
                    <div class="p-3 bg-red-500/20 rounded-xl text-red-400">
                        <i data-lucide="alert-circle" class="w-6 h-6"></i>
                    </div>
                    <div class="flex-1">
                        <h3 class="text-lg font-bold text-white mb-1">⚠️ 자산 누락 감지</h3>
                        <p class="text-sm text-slate-400">
                            총 ${assetStatus.totalScenes}개 장면 중 ${assetStatus.readyCount}개만 완료되었습니다.
                            누락된 자산을 생성하면 더 완성도 높은 영상을 만들 수 있습니다.
                        </p>
                    </div>
                </div>

                <div class="space-y-3">
                    ${warnings.map(warning => {
            const colors = colorMap[warning.color];
            return `
                            <div class="p-4 ${colors.bg} border ${colors.border} rounded-xl">
                                <div class="flex items-start gap-3">
                                    <div class="p-2 ${colors.iconBg} rounded-lg ${colors.text}">
                                        <i data-lucide="${warning.icon}" class="w-4 h-4"></i>
                                    </div>
                                    <div class="flex-1">
                                        <div class="flex items-center justify-between mb-2">
                                            <h4 class="text-sm font-bold ${colors.text}">${warning.title}</h4>
                                            <span class="text-xs ${colors.text} font-mono">${warning.sceneIds.length}개 씬</span>
                                        </div>
                                        <p class="text-xs text-slate-400 mb-2">
                                            씬 번호: ${warning.sceneIds.map(id => `#${id}`).join(', ')}
                                        </p>
                                        <div class="flex gap-2 mt-3">
                                            ${warning.actions.map(action => `
                                                <button onclick="app.route('${action.module}')"
                                                    class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5">
                                                    <i data-lucide="${action.icon}" class="w-3 h-3"></i>
                                                    ${action.label}
                                                </button>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }

    static renderSceneRow(scene) {
        const hasImage = !!scene.generatedUrl;
        const hasMotion = !!scene.videoUrl;
        const hasAudio = !!scene.audioUrl;

        // Resolve absolute URLs
        const videoSrc = this.getAssetUrl(scene.videoUrl);
        const imageSrc = this.getAssetUrl(scene.generatedUrl);
        const audioSrc = this.getAssetUrl(scene.audioUrl);

        const srtContent = scene.srtData || scene.srt || null;
        const hasSrt = !!srtContent;

        const useMotion = hasMotion;
        const hasVisual = hasMotion || hasImage;

        // 상태 아이콘 결정
        let statusIcon, statusColor, statusText;
        if (hasVisual && hasAudio) {
            statusIcon = 'check-circle-2';
            statusColor = 'text-green-400';
            statusText = '준비됨';
        } else if (hasVisual || hasAudio) {
            statusIcon = 'alert-circle';
            statusColor = 'text-yellow-400';
            statusText = '부분';
        } else {
            statusIcon = 'x-circle';
            statusColor = 'text-red-400';
            statusText = '미완료';
        }

        // 엔진 정보 (TTS에서 가져옴)
        const ttsEngine = scene.ttsEngine || scene.usedEngine;
        const engineBadge = ttsEngine
            ? `<span class="text-[9px] px-1.5 py-0.5 rounded ${ttsEngine === 'elevenlabs' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'} border ${ttsEngine === 'elevenlabs' ? 'border-blue-500/30' : 'border-purple-500/30'}">${ttsEngine}</span>`
            : '';

        return `
                <tr class="border-b border-slate-700/50 hover:bg-slate-800/30 transition group" data-scene-id="${scene.sceneId}">
                <!--Status Column-->
                <td class="py-4 pl-4 align-top pt-6">
                    <div class="flex flex-col items-center gap-1">
                        <i data-lucide="${statusIcon}" class="w-5 h-5 ${statusColor}"></i>
                        <span class="text-[9px] ${statusColor} font-medium">${statusText}</span>
                        <span class="text-[10px] text-slate-600 font-mono">#${scene.sceneId}</span>
                    </div>
                </td>

                <!--Visual Asset Column-->
                <td class="py-4 px-4 align-top">
                    <div class="flex flex-col gap-3">
                        <div class="aspect-video w-48 bg-slate-900 rounded-lg overflow-hidden border border-slate-700 relative group/visual"
                             ondragover="event.preventDefault(); this.classList.add('border-blue-500', 'ring-2', 'ring-blue-500/50')"
                             ondragleave="this.classList.remove('border-blue-500', 'ring-2', 'ring-blue-500/50')"
                             ondrop="window.handleVideoAssetDrop(event, this)"
                             data-scene-id="${scene.sceneId}">
                            
                            ${(() => {
                const showVideo = (scene.preferredVisual === 'video' && hasMotion) || (!hasImage && hasMotion);
                const showImage = (scene.preferredVisual === 'image' && hasImage) || (!hasMotion && hasImage);

                if (showVideo) {
                    return `
                                        <video src="${videoSrc}" controls class="w-full h-full object-cover"
                                            onerror="this.style.display='none'"></video>
                                        <div class="absolute top-2 left-2 bg-blue-600/80 text-white text-[9px] px-2 py-0.5 rounded font-bold">MOTION</div>
                                    `;
                } else if (showImage) {
                    return `
                                        <img src="${imageSrc}" class="w-full h-full object-cover"
                                            onerror="this.style.display='none'">
                                        <div class="absolute top-2 left-2 bg-green-600/80 text-white text-[9px] px-2 py-0.5 rounded font-bold">IMAGE</div>
                                    `;
                } else {
                    return `
                                        <div class="w-full h-full flex flex-col items-center justify-center text-xs text-slate-600 gap-2">
                                            <i data-lucide="image-plus" class="w-8 h-8 opacity-30"></i>
                                            <span>드래그하여 추가</span>
                                        </div>
                                    `;
                }
            })()}

                            ${hasVisual ? `
                                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover/visual:opacity-100 transition flex items-center justify-center">
                                    <span class="text-xs text-white">클릭하여 변경</span>
                                </div>
                            ` : ''}
                        </div>

                        <!--Asset Toggles (Mixed Support) -->
                        ${hasImage && hasMotion ? `
                            <div class="flex items-center gap-1 bg-slate-800 p-1 rounded-lg self-start">
                                <button onclick="app.getModule('video').setPreferredVisual(${scene.sceneId}, 'image')" 
                                    class="px-2 py-1 rounded text-[9px] font-bold transition ${scene.preferredVisual === 'image' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-slate-200'}">
                                    IMAGE
                                </button>
                                <button onclick="app.getModule('video').setPreferredVisual(${scene.sceneId}, 'video')" 
                                    class="px-2 py-1 rounded text-[9px] font-bold transition ${scene.preferredVisual === 'video' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}">
                                    VIDEO
                                </button>
                            </div>
                        ` : ''}

                        <!--Video Volume Control -->
                        ${hasMotion ? `
                            <div class="flex flex-col gap-1 px-1 mt-2">
                                <div class="flex justify-between items-center">
                                    <span class="text-[9px] text-slate-400 font-bold uppercase">
                                        <i data-lucide="video" class="w-3 h-3 inline mr-1"></i> Video Vol
                                    </span>
                                    <div class="flex items-center gap-2">
                                        <button class="btn-mute-video p-0.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition" data-scene-id="${scene.sceneId}" title="${scene.videoVolume === 0 ? '음소거 해제' : '음소거'}">
                                            <i data-lucide="${scene.videoVolume === 0 ? 'volume-x' : 'volume-2'}" class="w-3 h-3"></i>
                                        </button>
                                        <span class="text-[9px] text-blue-400 font-bold volume-label-video">${Math.round((scene.videoVolume !== undefined ? scene.videoVolume : 1.0) * 100)}%</span>
                                    </div>
                                </div>
                                <input type="range" min="0" max="1" step="0.1" value="${scene.videoVolume !== undefined ? scene.videoVolume : 1.0}" 
                                    class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 volume-slider-video"
                                    data-scene-id="${scene.sceneId}">
                            </div>
                        ` : ''}
                    </div>
                </td>

                <!--Audio & Subtitle Column-->
                <td class="py-4 px-4 align-top">
                    <div class="space-y-2">
                        <div class="p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                             <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-bold text-slate-400">Audio Track</span>
                                    ${engineBadge}
                                </div>
                                ${hasAudio
                ? `<span class="text-[10px] text-green-400 font-mono bg-green-900/30 px-1.5 py-0.5 rounded border border-green-500/30 flex items-center gap-1">
                                        <i data-lucide="check" class="w-3 h-3"></i> Ready
                                       </span>`
                : `<span class="text-[10px] text-red-400 font-mono bg-red-900/30 px-1.5 py-0.5 rounded border border-red-500/30">Missing</span>`
            }
                             </div>
                             ${hasAudio ? `
                                <audio src="${audioSrc}" controls class="w-full h-6 rounded"
                                    onerror="console.error('Audio load failed:', this.src)"></audio>
                                <div class="flex flex-col gap-1 px-1 mt-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-[9px] text-slate-400 font-bold uppercase">
                                            <i data-lucide="mic" class="w-3 h-3 inline mr-1"></i> Voice Vol
                                        </span>
                                        <div class="flex items-center gap-2">
                                            <button class="btn-mute-audio p-0.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition" data-scene-id="${scene.sceneId}" title="${scene.audioVolume === 0 ? '음소거 해제' : '음소거'}">
                                                <i data-lucide="${scene.audioVolume === 0 ? 'mic-off' : 'mic'}" class="w-3 h-3"></i>
                                            </button>
                                            <span class="text-[9px] text-green-400 font-bold volume-label-audio">${Math.round((scene.audioVolume !== undefined ? scene.audioVolume : 1.0) * 100)}%</span>
                                        </div>
                                    </div>
                                    <input type="range" min="0" max="2" step="0.1" value="${scene.audioVolume !== undefined ? scene.audioVolume : 1.0}" 
                                        class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500 volume-slider-audio"
                                        data-scene-id="${scene.sceneId}">
                                </div>
                             ` : ''}
                        </div>

                        <div class="p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                             <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-bold text-slate-400">Subtitle (SRT)</span>
                                ${hasSrt
                ? `<span class="text-[10px] text-purple-400 font-mono bg-purple-900/30 px-1.5 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">
                                        <i data-lucide="subtitles" class="w-3 h-3"></i> Vrew 호환
                                       </span>`
                : `<span class="text-[10px] text-slate-500 font-mono">No Data</span>`
            }
                             </div>
                             <div class="text-[10px] text-slate-400 font-mono h-12 overflow-y-auto bg-black/20 p-2 rounded scrollbar-thin">
                                ${hasSrt ? srtContent.replace(/\n/g, '<br>') : '<span class="text-slate-600">타임스탬프 데이터 없음</span>'}
                             </div>
                        </div>
                    </div>
                </td>

                <!--Options Column-->
            <td class="py-4 px-4 align-top text-right">
                <div class="flex flex-col gap-2 items-end">
                    <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-200 transition">
                        <input type="checkbox" checked class="scene-include-check rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-0 focus:ring-offset-0" data-scene-id="${scene.sceneId}">
                            <span>포함</span>
                    </label>
                    ${scene.duration ? `<span class="text-[10px] text-slate-600">${scene.duration.toFixed(1)}s</span>` : ''}
                </div>
            </td>
            </tr>
            `;
    }

    static renderMetadataPanel() {
        const metadata = AppState.metadata || {
            titles: [],
            description: '',
            tags: []
        };

        return `
            <div class="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-2xl p-6">
                <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                        <div class="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
                            <i data-lucide="hash" class="w-6 h-6"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-white">📝 메타데이터 생성</h2>
                            <p class="text-sm text-slate-400">YouTube 및 SNS 업로드용 제목, 설명, 태그</p>
                        </div>
                    </div>
                    <button id="btn-generate-metadata" class="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2">
                        <i data-lucide="sparkles" class="w-4 h-4"></i> AI로 생성하기
                    </button>
                </div>

                ${metadata.titles.length > 0 ? `
                    <div class="space-y-4">
                        <!--제목 5개 -->
                        <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                            <label class="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">제목 옵션 (5개)</label>
                            <div class="space-y-2">
                                ${metadata.titles.map((title, i) => `
                                    <div class="flex items-center gap-2">
                                        <input type="radio" name="selected-title" value="${i}" id="title-${i}" class="text-emerald-600">
                                        <label for="title-${i}" class="flex-1 text-sm text-slate-200 cursor-pointer hover:text-white">${i + 1}. ${title}</label>
                                        <button class="btn-copy-title text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition" data-text="${title.replace(/"/g, '&quot;')}">
                                            <i data-lucide="copy" class="w-3 h-3"></i>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!--설명 -->
                        <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                            <div class="flex justify-between items-center mb-3">
                                <label class="text-xs font-bold text-emerald-400 uppercase tracking-wider">설명 (Description)</label>
                                <button id="btn-copy-description" class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition flex items-center gap-1">
                                    <i data-lucide="copy" class="w-3 h-3"></i> 복사
                                </button>
                            </div>
                            <textarea id="metadata-description" class="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 resize-none scrollbar-hide">${metadata.description}</textarea>
                        </div>

                        <!--태그 -->
                        <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                            <div class="flex justify-between items-center mb-3">
                                <label class="text-xs font-bold text-emerald-400 uppercase tracking-wider">태그 (Tags)</label>
                                <button id="btn-copy-tags" class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition flex items-center gap-1">
                                    <i data-lucide="copy" class="w-3 h-3"></i> 복사
                                </button>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                ${metadata.tags.map(tag => `
                                    <span class="px-3 py-1 bg-emerald-900/30 text-emerald-300 text-xs rounded-full border border-emerald-500/30">#${tag}</span>
                                `).join('')}
                            </div>
                            <textarea id="metadata-tags" class="mt-3 w-full h-20 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-400 font-mono resize-none scrollbar-hide">${metadata.tags.join(', ')}</textarea>
                        </div>

                        <!--다운로드 -->
                        <div class="flex gap-3">
                            <button id="btn-download-metadata" class="flex-1 bg-slate-700 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2">
                                <i data-lucide="download" class="w-4 h-4"></i> 메타데이터 다운로드 (TXT)
                            </button>
                        </div>
                    </div>
                ` : `
                    <div class="text-center py-8 text-slate-500">
                        <i data-lucide="info" class="w-10 h-10 mx-auto mb-3 opacity-50"></i>
                        <p class="text-sm">대본을 기반으로 YouTube 업로드용 메타데이터를 자동 생성합니다.</p>
                        <p class="text-xs mt-1">제목 5개, 설명, 태그가 생성됩니다.</p>
                    </div>
                `}
            </div>
            `;
    }

    static renderThumbnailPanel() {
        const thumbnail = AppState.thumbnail || {
            prompts: [],
            generatedImages: []
        };

        return `
            <div class="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-6 mt-6">
                <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                        <div class="p-3 bg-purple-500/20 rounded-xl text-purple-400">
                            <i data-lucide="image" class="w-6 h-6"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-white">🎨 썸네일 생성</h2>
                            <p class="text-sm text-slate-400">YouTube 썸네일 프롬프트 및 이미지 생성</p>
                        </div>
                    </div>
                    <button id="btn-generate-thumbnail-prompts" class="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-purple-600/20 transition flex items-center gap-2">
                        <i data-lucide="sparkles" class="w-4 h-4"></i> 프롬프트 생성
                    </button>
                </div>

                ${thumbnail.prompts.length > 0 ? `
                    <div class="space-y-4">
                        <!--프롬프트 목록 -->
                        ${thumbnail.prompts.map((prompt, i) => {
            const generatedImage = thumbnail.generatedImages.find(img => img.promptIndex === i);
            return `
                                <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                                    <div class="flex items-start gap-4">
                                        <div class="flex-1">
                                            <label class="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 block">프롬프트 ${i + 1}</label>
                                            <textarea id="thumbnail-prompt-${i}" class="w-full h-20 bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 resize-none scrollbar-hide">${prompt}</textarea>
                                            <div class="flex gap-2 mt-2">
                                                <button class="btn-generate-thumbnail flex-1 bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1" data-index="${i}">
                                                    <i data-lucide="wand-2" class="w-3 h-3"></i> 이미지 생성
                                                </button>
                                                <button class="btn-copy-thumbnail-prompt bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition" data-index="${i}">
                                                    <i data-lucide="copy" class="w-3 h-3"></i>
                                                </button>
                                            </div>
                                        </div>
                                        ${generatedImage ? `
                                            <div class="w-48 h-27">
                                                <img src="${generatedImage.url}" class="w-full h-full object-cover rounded-lg border border-purple-500/30 shadow-lg" alt="Thumbnail ${i + 1}">
                                                <button class="btn-download-thumbnail w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded text-xs font-bold transition flex items-center justify-center gap-1" data-url="${generatedImage.url}">
                                                    <i data-lucide="download" class="w-3 h-3"></i> 다운로드
                                                </button>
                                            </div>
                                        ` : `
                                            <div class="w-48 h-27 bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center">
                                                <div class="text-center text-slate-600 text-xs">
                                                    <i data-lucide="image-off" class="w-8 h-8 mx-auto mb-1"></i>
                                                    <p>미생성</p>
                                                </div>
                                            </div>
                                        `}
                                    </div>
                                </div>
                            `;
        }).join('')}

                        <!--전체 다운로드 -->
                        <div class="flex gap-3">
                            <button id="btn-download-all-thumbnail-prompts" class="flex-1 bg-slate-700 hover:bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2">
                                <i data-lucide="file-text" class="w-4 h-4"></i> 프롬프트 다운로드 (TXT)
                            </button>
                        </div>
                    </div>
                ` : `
                    <div class="text-center py-8 text-slate-500">
                        <i data-lucide="image-off" class="w-10 h-10 mx-auto mb-3 opacity-50"></i>
                        <p class="text-sm">대본을 기반으로 YouTube 썸네일 프롬프트를 자동 생성합니다.</p>
                        <p class="text-xs mt-1">다양한 스타일의 프롬프트 4개가 생성됩니다.</p>
                    </div>
                `}
            </div>
            `;
    }

    static showTimelinePreview(includedScenes) {
        let totalDuration = 0;
        let timelineHTML = `
            <div class="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-h-[80vh] overflow-y-auto w-full max-w-2xl mx-auto shadow-2xl">
                <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <i data-lucide="clock" class="w-5 h-5 text-purple-400"></i>
                    타임라인 미리보기
                </h3>
                <div class="space-y-2">
        `;

        includedScenes.forEach((scene, index) => {
            const hasVisual = !!(scene.videoUrl || scene.generatedUrl);
            const hasAudio = !!scene.audioUrl;
            const statusColor = (hasVisual && hasAudio) ? 'green' : (hasVisual || hasAudio) ? 'yellow' : 'red';

            const duration = parseFloat(scene.duration || scene.audioDuration || 5);
            const startTime = totalDuration;
            totalDuration += duration;

            timelineHTML += `
                <div class="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    <div class="flex-shrink-0 w-12 h-12 bg-${statusColor}-500/20 rounded flex items-center justify-center">
                        <span class="text-${statusColor}-400 font-bold">#${scene.sceneId}</span>
                    </div>
                    <div class="flex-1">
                        <div class="text-sm text-white font-medium">${scene.originalScript?.substring(0, 40) || 'No script'}...</div>
                        <div class="text-xs text-slate-500 mt-1">
                            ${startTime.toFixed(1)}s - ${totalDuration.toFixed(1)}s (${duration.toFixed(1)}s)
                        </div>
                    </div>
                </div>
            `;
        });

        timelineHTML += `
                </div>
                <div class="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
                    <div class="text-sm text-slate-400">
                        총 ${includedScenes.length}개 장면
                    </div>
                    <div class="text-lg font-bold text-purple-400">
                        전체 시간: ${totalDuration.toFixed(1)}초 (${(totalDuration / 60).toFixed(1)}분)
                    </div>
                </div>
            </div>
            `;

        // 커스텀 다이얼로그 표시
        const dialog = document.createElement('div');
        dialog.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
        dialog.innerHTML = `
            <div class="max-w-2xl w-full mx-4">
                ${timelineHTML}
        <button onclick="this.closest('.fixed').remove()" class="mt-4 w-full bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition">
            닫기
        </button>
            </div>
            `;
        document.body.appendChild(dialog);
    }
}
