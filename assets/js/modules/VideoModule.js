// ================================================================
// VIDEO MODULE - 최종 편집실
// TTS → Vrew 워크플로우 호환
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG } from '../config.js';

export class VideoModule extends Module {
    constructor() {
        super('video', '최종 편집실', 'film', '시각/청각 자산 통합 및 최종 영상 생성');

        // 비디오 설정 (백엔드와 동기화)
        this.videoSettings = {
            resolution: '1080p',
            fps: 30,
            preset: 'medium',
            bitrate: '8M'
        };

        // 자동 다운로드 설정
        this.autoDownload = localStorage.getItem('videoAutoDownload') === 'true' || false;

        // 편집 모드 ('auto' or 'manual')
        this.editMode = 'auto';

        // 수동 편집 설정
        this.manualEditSettings = {
            transition: 'fade', // fade, dissolve, cut, wipe
            transitionDuration: 0.5, // seconds
            sceneOrder: [] // 사용자 정의 순서
        };

        // 서비스 상태
        this.serviceStatus = null;
        this.pollInterval = null;
        this.startTime = null;
    }

    async render() {
        const scenes = AppState.getScenes();

        // 서비스 상태 조회 (비동기)
        this.loadServiceStatus();

        // 씬이 없어도 UI는 표시 (빈 상태 메시지만 다르게)
        const isEmpty = scenes.length === 0;

        // 자산 상태 분석
        const assetStatus = isEmpty ? { hasIssues: false } : this.analyzeAssetStatus(scenes);

        const sceneRows = isEmpty ? '' : scenes.map(scene => this.renderSceneRow(scene)).join('');
        const readyScenes = isEmpty ? { complete: 0, partial: 0, missing: 0 } : this.countReadyScenes(scenes);

        return `
            <div class="max-w-6xl mx-auto slide-up space-y-6">
                <div class="flex items-center gap-2">
                    <!-- User Guide Button -->
                    ${this.renderGuideButton()}

                    <!-- Reset Button -->
                    <button id="btn-reset-video" class="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 rounded-xl text-xs font-bold transition">
                        <i data-lucide="refresh-ccw" class="w-3.5 h-3.5"></i>
                        초기화
                    </button>
                </div>

                <!-- Asset Status Warning (if applicable) -->
                ${assetStatus.hasIssues ? this.renderAssetWarning(assetStatus) : ''}

            <div class="max-w-6xl mx-auto slide-up space-y-6">
                <!-- Edit Mode Selector -->
                ${this.renderEditModeSelector()}

                <!-- Video Settings Panel -->
                ${this.renderSettingsPanel()}

                <!-- Manual Edit Controls (shown only in manual mode) -->
                ${this.editMode === 'manual' ? this.renderManualEditControls() : ''}

                <!-- Status Bar -->
                <div class="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                    <div class="flex items-center gap-4">
                        <span class="text-sm font-bold text-slate-400">
                            총 <b class="text-white">${scenes.length}</b>개 씬
                        </span>
                        <span class="text-xs text-slate-500">|</span>
                        <span class="text-sm text-slate-400">
                            준비됨: <b class="text-green-400">${readyScenes.complete}</b>
                            <span class="text-slate-600 mx-1">/</span>
                            부분: <b class="text-yellow-400">${readyScenes.partial}</b>
                            <span class="text-slate-600 mx-1">/</span>
                            미완료: <b class="text-red-400">${readyScenes.missing}</b>
                        </span>
                    </div>
                    <div class="flex gap-3">
                        <button id="btn-add-scene" class="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-green-600/20 transition flex items-center gap-2">
                            <i data-lucide="plus-circle" class="w-4 h-4"></i> 씬 추가
                        </button>
                        <button id="btn-export-vrew" class="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-purple-600/20 transition flex items-center gap-2">
                            <i data-lucide="file-video" class="w-4 h-4"></i> Vrew 내보내기
                        </button>
                        <button id="btn-import-vrew" class="bg-pink-600 hover:bg-pink-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-pink-600/20 transition flex items-center gap-2">
                            <i data-lucide="file-input" class="w-4 h-4"></i> Vrew 가져오기
                        </button>
                        <button id="btn-gen-final-video" class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2" ${readyScenes.complete === 0 ? 'disabled' : ''}>
                            <i data-lucide="clapperboard" class="w-4 h-4"></i> 최종 영상 생성
                        </button>
                    </div>
                </div>

                <!-- Progress Display (Hidden by default) -->
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

                <!-- Final Video Preview (Hidden by default) -->
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

                <!-- Scene List (Detailed View) -->
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

                <!-- Metadata Generation Panel -->
                ${this.renderMetadataPanel()}

                <!-- Thumbnail Generation Panel -->
                ${this.renderThumbnailPanel()}

                <!-- Service Stats (Initially hidden) -->
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

    renderEditModeSelector() {
        return `
            <div class="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-500/30 rounded-2xl p-6">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                            <i data-lucide="wand-2" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-white">편집 모드 선택</h3>
                            <p class="text-xs text-slate-400">원하는 편집 방식을 선택하세요</p>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button id="btn-mode-auto" class="${this.editMode === 'auto' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'} px-6 py-3 rounded-xl text-sm font-bold transition flex items-center gap-2 hover:scale-105">
                            <i data-lucide="zap" class="w-4 h-4"></i>
                            <div class="text-left">
                                <div>자동 모드</div>
                                <div class="text-[10px] opacity-70">빠른 영상 생성</div>
                            </div>
                        </button>
                        <button id="btn-mode-manual" class="${this.editMode === 'manual' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'} px-6 py-3 rounded-xl text-sm font-bold transition flex items-center gap-2 hover:scale-105">
                            <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
                            <div class="text-left">
                                <div>수동 편집</div>
                                <div class="text-[10px] opacity-70">세밀한 제어</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderManualEditControls() {
        return `
            <div class="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-2xl p-6">
                <div class="flex items-center gap-3 mb-5">
                    <div class="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                        <i data-lucide="scissors" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white">⚙️ 수동 편집 컨트롤</h3>
                </div>

                <div class="grid grid-cols-4 gap-4">
                    <!-- Transition Effect -->
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">전환 효과</label>
                        <select id="manual-transition" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500">
                            <option value="cut" ${this.manualEditSettings.transition === 'cut' ? 'selected' : ''}>Cut (즉시 전환)</option>
                            <option value="fade" ${this.manualEditSettings.transition === 'fade' ? 'selected' : ''}>Fade (페이드)</option>
                            <option value="dissolve" ${this.manualEditSettings.transition === 'dissolve' ? 'selected' : ''}>Dissolve (디졸브)</option>
                            <option value="wipe" ${this.manualEditSettings.transition === 'wipe' ? 'selected' : ''}>Wipe (와이프)</option>
                            <option value="slide" ${this.manualEditSettings.transition === 'slide' ? 'selected' : ''}>Slide (슬라이드)</option>
                        </select>
                    </div>

                    <!-- Transition Duration -->
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                            전환 시간 <span class="text-purple-400">${this.manualEditSettings.transitionDuration}초</span>
                        </label>
                        <input type="range" id="manual-transition-duration" min="0" max="2" step="0.1" value="${this.manualEditSettings.transitionDuration}"
                            class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500">
                    </div>

                    <!-- Scene Order Reset -->
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">장면 순서</label>
                        <button id="btn-reset-order" class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-2 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2">
                            <i data-lucide="refresh-ccw" class="w-3.5 h-3.5"></i> 원래 순서로
                        </button>
                    </div>

                    <!-- Timeline Preview -->
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">타임라인</label>
                        <button id="btn-show-timeline" class="w-full bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2">
                            <i data-lucide="layout-list" class="w-3.5 h-3.5"></i> 미리보기
                        </button>
                    </div>
                </div>

                <div class="mt-4 p-3 bg-black/20 rounded-lg border border-purple-500/20">
                    <p class="text-xs text-slate-400">
                        <i data-lucide="info" class="w-3 h-3 inline mr-1"></i>
                        <strong class="text-purple-400">수동 편집 모드:</strong> 장면을 드래그하여 순서 변경, 지속 시간 조정, 전환 효과 적용 등이 가능합니다.
                    </p>
                </div>
            </div>
        `;
    }

    renderSettingsPanel() {
        return `
            <div class="bg-gradient-to-r from-slate-800/60 to-indigo-900/20 border border-slate-700/50 rounded-2xl p-5">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                            <i data-lucide="settings-2" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-white">영상 출력 설정</h3>
                            <p class="text-xs text-slate-500">Vrew 호환 포맷으로 출력됩니다</p>
                        </div>
                    </div>
                    <button id="btn-toggle-stats" class="text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1">
                        <i data-lucide="bar-chart-3" class="w-3 h-3"></i> 통계 보기
                    </button>
                </div>

                <div class="grid grid-cols-4 gap-4">
                    <!-- Resolution -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">해상도</label>
                        <select id="video-resolution" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="720p" ${this.videoSettings.resolution === '720p' ? 'selected' : ''}>720p (HD)</option>
                            <option value="1080p" ${this.videoSettings.resolution === '1080p' ? 'selected' : ''}>1080p (Full HD)</option>
                            <option value="4k" ${this.videoSettings.resolution === '4k' ? 'selected' : ''}>4K (Ultra HD)</option>
                            <option value="vertical" ${this.videoSettings.resolution === 'vertical' ? 'selected' : ''}>세로형 (1080×1920)</option>
                            <option value="shorts" ${this.videoSettings.resolution === 'shorts' ? 'selected' : ''}>Shorts (1080×1920)</option>
                            <option value="square" ${this.videoSettings.resolution === 'square' ? 'selected' : ''}>정사각 (1080×1080)</option>
                        </select>
                    </div>

                    <!-- FPS -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">프레임 레이트</label>
                        <select id="video-fps" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="24" ${this.videoSettings.fps === 24 ? 'selected' : ''}>24 fps (영화)</option>
                            <option value="30" ${this.videoSettings.fps === 30 ? 'selected' : ''}>30 fps (표준)</option>
                            <option value="60" ${this.videoSettings.fps === 60 ? 'selected' : ''}>60 fps (고품질)</option>
                        </select>
                    </div>

                    <!-- Preset -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">인코딩 프리셋</label>
                        <select id="video-preset" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="ultrafast" ${this.videoSettings.preset === 'ultrafast' ? 'selected' : ''}>빠름 (낮은 품질)</option>
                            <option value="medium" ${this.videoSettings.preset === 'medium' ? 'selected' : ''}>보통 (권장)</option>
                            <option value="slow" ${this.videoSettings.preset === 'slow' ? 'selected' : ''}>느림 (최고 품질)</option>
                        </select>
                    </div>

                    <!-- Bitrate -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">비트레이트</label>
                        <select id="video-bitrate" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="4M" ${this.videoSettings.bitrate === '4M' ? 'selected' : ''}>4 Mbps (작은 파일)</option>
                            <option value="8M" ${this.videoSettings.bitrate === '8M' ? 'selected' : ''}>8 Mbps (권장)</option>
                            <option value="15M" ${this.videoSettings.bitrate === '15M' ? 'selected' : ''}>15 Mbps (고품질)</option>
                            <option value="25M" ${this.videoSettings.bitrate === '25M' ? 'selected' : ''}>25 Mbps (최고 품질)</option>
                        </select>
                    </div>
                </div>

                <!-- 자막 설정 섹션 -->
                <div class="mt-6 pt-6 border-t border-slate-700/50">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                                <i data-lucide="captions" class="w-5 h-5"></i>
                            </div>
                            <h4 class="font-bold text-white">자막 설정</h4>
                        </div>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <span class="text-xs text-slate-400">자막 표시</span>
                            <input type="checkbox" id="subtitle-enabled" checked class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500">
                        </label>
                    </div>

                    <div id="subtitle-options" class="space-y-4">
                        <div class="grid grid-cols-3 gap-4">
                            <!-- 폰트 -->
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">폰트</label>
                                <select id="subtitle-font" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500">
                                    <option value="Pretendard-Vrew_700">Pretendard (기본)</option>
                                    <option value="Noto Sans KR">Noto Sans KR</option>
                                    <option value="Malgun Gothic">맑은 고딕</option>
                                    <option value="Nanum Gothic">나눔고딕</option>
                                </select>
                            </div>

                            <!-- 크기 -->
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    크기: <span id="subtitle-size-value" class="text-purple-400">100</span>
                                </label>
                                <input type="range" id="subtitle-size" min="60" max="300" value="100"
                                    class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500">
                            </div>

                            <!-- 위치 -->
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">위치</label>
                                <select id="subtitle-position" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500">
                                    <option value="bottom">하단</option>
                                    <option value="center">중앙</option>
                                    <option value="top">상단</option>
                                </select>
                            </div>
                        </div>

                        <div class="grid grid-cols-4 gap-4">
                            <!-- 텍스트 색상 -->
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">텍스트 색상</label>
                                <div class="flex gap-2">
                                    <input type="color" id="subtitle-color" value="#ffffff"
                                        class="w-12 h-9 bg-slate-900 border border-slate-700 rounded cursor-pointer">
                                    <input type="text" id="subtitle-color-text" value="#ffffff"
                                        class="flex-1 bg-slate-900 border border-slate-700 rounded px-2 text-xs text-white font-mono">
                                </div>
                            </div>

                            <!-- 외곽선 색상 -->
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">외곽선 색상</label>
                                <div class="flex gap-2">
                                    <input type="color" id="subtitle-outline-color" value="#000000"
                                        class="w-12 h-9 bg-slate-900 border border-slate-700 rounded cursor-pointer">
                                    <input type="text" id="subtitle-outline-color-text" value="#000000"
                                        class="flex-1 bg-slate-900 border border-slate-700 rounded px-2 text-xs text-white font-mono">
                                </div>
                            </div>

                            <!-- 외곽선 두께 -->
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    외곽선: <span id="subtitle-outline-width-value" class="text-purple-400">6</span>px
                                </label>
                                <input type="range" id="subtitle-outline-width" min="0" max="12" value="6"
                                    class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500">
                            </div>

                            <!-- 정렬 -->
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">정렬</label>
                                <select id="subtitle-alignment" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500">
                                    <option value="center">가운데</option>
                                    <option value="left">왼쪽</option>
                                    <option value="right">오른쪽</option>
                                </select>
                            </div>
                        </div>

                        <!-- 미리보기 -->
                        <div class="bg-gradient-to-br from-slate-100 to-slate-300 rounded-lg p-8 text-center border border-slate-400 relative overflow-hidden">
                            <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjZjFmNWY5Ii8+PHJlY3QgeD0iMjAiIHk9IjIwIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIGZpbGw9IiNmMWY1ZjkiLz48L3N2Zz4=')] opacity-30"></div>
                            <p id="subtitle-preview" class="inline-block px-4 py-2 relative z-10" style="
                                font-family: 'Pretendard-Vrew_700', sans-serif;
                                font-size: 20px;
                                color: #ffffff;
                                -webkit-text-stroke: 6px #000000;
                                paint-order: stroke fill;
                            ">미리보기 텍스트</p>
                            <p class="text-xs text-slate-600 mt-3 font-medium relative z-10">자막 스타일 실시간 미리보기 (밝은 배경에서 확인)</p>
                        </div>
                    </div>
                </div>

                <!-- 자동 다운로드 설정 -->
                <div class="mt-6 pt-6 border-t border-slate-700/50">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                <i data-lucide="download" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-white">자동 다운로드</h4>
                                <p class="text-xs text-slate-400">영상 생성 완료 시 자동으로 다운로드</p>
                            </div>
                        </div>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <span class="text-xs text-slate-400">자동 다운로드</span>
                            <input type="checkbox" id="auto-download-enabled" ${this.autoDownload ? 'checked' : ''} class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500">
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    renderMetadataPanel() {
        const script = AppState.getScript();
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
                        <!-- 제목 5개 -->
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

                        <!-- 설명 -->
                        <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                            <div class="flex justify-between items-center mb-3">
                                <label class="text-xs font-bold text-emerald-400 uppercase tracking-wider">설명 (Description)</label>
                                <button id="btn-copy-description" class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition flex items-center gap-1">
                                    <i data-lucide="copy" class="w-3 h-3"></i> 복사
                                </button>
                            </div>
                            <textarea id="metadata-description" class="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 resize-none scrollbar-hide">${metadata.description}</textarea>
                        </div>

                        <!-- 태그 -->
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

                        <!-- 다운로드 -->
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

    renderThumbnailPanel() {
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
                        <!-- 프롬프트 목록 -->
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

                        <!-- 전체 다운로드 -->
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

    renderEmpty() {
        return `
            <div class="max-w-4xl mx-auto slide-up text-center p-10 text-slate-500 border border-dashed border-slate-700 rounded-2xl">
                <i data-lucide="film" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
                <h3 class="text-lg font-bold">생성된 장면이 없습니다</h3>
                <p class="text-sm mt-2">먼저 대본 분석실에서 분석을 진행하거나, 미술/TTS 작업실에서 에셋을 생성해 주세요.</p>
            </div>
        `;
    }

    countReadyScenes(scenes) {
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

    analyzeAssetStatus(scenes) {
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

    renderAssetWarning(assetStatus) {
        /**
         * 자산 누락 경고 패널 렌더링
         */
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

    renderTimelineCards(scenes) {
        if (scenes.length === 0) {
            return `
                <div class="col-span-full text-center py-12 text-slate-500">
                    <i data-lucide="film" class="w-12 h-12 mx-auto mb-3 opacity-30"></i>
                    <p class="text-sm">씬이 없습니다</p>
                </div>
            `;
        }

        return scenes.map(scene => {
            const hasImage = !!scene.generatedUrl;
            const hasMotion = !!scene.videoUrl;
            const hasAudio = !!scene.audioUrl;
            const hasVisual = hasMotion || hasImage;

            // 완성도 계산
            const completeness = (hasVisual ? 50 : 0) + (hasAudio ? 50 : 0);
            let statusColor = 'bg-red-500/20 border-red-500/30 text-red-400';
            let statusText = '미완료';

            if (completeness === 100) {
                statusColor = 'bg-green-500/20 border-green-500/30 text-green-400';
                statusText = '완료';
            } else if (completeness > 0) {
                statusColor = 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
                statusText = '부분';
            }

            return `
                <div class="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all hover:shadow-lg hover:shadow-indigo-500/10 group">
                    <!-- Visual Preview -->
                    <div class="aspect-video bg-slate-950 relative overflow-hidden">
                        ${hasMotion
                            ? `<video src="${scene.videoUrl}" class="w-full h-full object-cover" muted
                                   onerror="this.style.display='none';this.parentElement.innerHTML+='<div class=\\"text-xs text-red-400 text-center p-4\\">Video Load Failed</div>'"></video>
                               <div class="absolute top-2 right-2 bg-blue-600/90 text-white text-[9px] px-2 py-1 rounded font-bold backdrop-blur-sm">VIDEO</div>`
                            : hasImage
                            ? `<img src="${scene.generatedUrl}" class="w-full h-full object-cover"
                                   onerror="this.style.display='none';this.parentElement.innerHTML+='<div class=\\"text-xs text-red-400 text-center p-4\\">Image Load Failed</div>'">
                               <div class="absolute top-2 right-2 bg-green-600/90 text-white text-[9px] px-2 py-1 rounded font-bold backdrop-blur-sm">IMAGE</div>`
                            : `<div class="w-full h-full flex items-center justify-center text-slate-700">
                                   <i data-lucide="image-off" class="w-12 h-12 opacity-20"></i>
                               </div>`
                        }
                        <!-- Scene Number Badge -->
                        <div class="absolute top-2 left-2 bg-slate-900/90 text-white text-xs px-2 py-1 rounded-lg font-bold backdrop-blur-sm border border-slate-700">
                            #${scene.sceneId}
                        </div>

                        <!-- Audio Indicator -->
                        ${hasAudio
                            ? `<div class="absolute bottom-2 left-2 bg-indigo-600/90 text-white text-[9px] px-2 py-1 rounded font-bold backdrop-blur-sm flex items-center gap-1">
                                   <i data-lucide="volume-2" class="w-3 h-3"></i> AUDIO
                               </div>`
                            : `<div class="absolute bottom-2 left-2 bg-red-600/90 text-white text-[9px] px-2 py-1 rounded font-bold backdrop-blur-sm flex items-center gap-1">
                                   <i data-lucide="volume-x" class="w-3 h-3"></i> NO AUDIO
                               </div>`
                        }
                    </div>

                    <!-- Card Footer -->
                    <div class="p-3 space-y-2">
                        <!-- Status Badge -->
                        <div class="flex items-center justify-between">
                            <div class="${statusColor} text-[10px] px-2 py-1 rounded border font-bold flex items-center gap-1">
                                <div class="w-1.5 h-1.5 rounded-full ${completeness === 100 ? 'bg-green-400' : completeness > 0 ? 'bg-yellow-400' : 'bg-red-400'} animate-pulse"></div>
                                ${statusText}
                            </div>
                            <div class="text-[10px] text-slate-500 font-mono">${completeness}%</div>
                        </div>

                        <!-- Script Preview -->
                        <div class="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            ${scene.originalScript || scene.script || '대본 없음'}
                        </div>

                        <!-- Quick Actions -->
                        <div class="flex gap-1 pt-1">
                            <button onclick="AppState.setActiveModule('script')" class="flex-1 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white text-[10px] px-2 py-1.5 rounded transition flex items-center justify-center gap-1">
                                <i data-lucide="edit-3" class="w-3 h-3"></i>
                            </button>
                            ${hasVisual
                                ? `<button onclick="window.openLightbox('${hasMotion ? scene.videoUrl : scene.generatedUrl}', '${hasMotion ? 'video' : 'image'}')" class="flex-1 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white text-[10px] px-2 py-1.5 rounded transition flex items-center justify-center gap-1">
                                       <i data-lucide="maximize-2" class="w-3 h-3"></i>
                                   </button>`
                                : ''
                            }
                            ${hasAudio
                                ? `<button onclick="document.querySelector('tr[data-scene-id=\\"${scene.sceneId}\\"] audio')?.play()" class="flex-1 bg-slate-800 hover:bg-green-600 text-slate-400 hover:text-white text-[10px] px-2 py-1.5 rounded transition flex items-center justify-center gap-1">
                                       <i data-lucide="play" class="w-3 h-3"></i>
                                   </button>`
                                : ''
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderSceneRow(scene) {
        const hasImage = !!scene.generatedUrl;
        const hasMotion = !!scene.videoUrl;
        const hasAudio = !!scene.audioUrl;
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
                <!-- Status Column -->
                <td class="py-4 pl-4 align-top pt-6">
                    <div class="flex flex-col items-center gap-1">
                        <i data-lucide="${statusIcon}" class="w-5 h-5 ${statusColor}"></i>
                        <span class="text-[9px] ${statusColor} font-medium">${statusText}</span>
                        <span class="text-[10px] text-slate-600 font-mono">#${scene.sceneId}</span>
                    </div>
                </td>

                <!-- Visual Asset Column -->
                <td class="py-4 px-4 align-top">
                    <div class="flex flex-col gap-3">
                        <div class="aspect-video w-48 bg-slate-900 rounded-lg overflow-hidden border border-slate-700 relative group/visual"
                             ondragover="event.preventDefault(); this.classList.add('border-blue-500', 'ring-2', 'ring-blue-500/50')"
                             ondragleave="this.classList.remove('border-blue-500', 'ring-2', 'ring-blue-500/50')"
                             ondrop="handleVideoAssetDrop(event, this)"
                             data-scene-id="${scene.sceneId}">
                            ${useMotion && hasMotion
                ? `<video src="${scene.videoUrl}" controls class="w-full h-full object-cover"
                          onerror="this.style.display='none';this.parentElement.innerHTML+='<div class=\\"text-xs text-red-400 text-center\\">Video Load Failed</div>'"></video>
                                   <div class="absolute top-2 left-2 bg-blue-600/80 text-white text-[9px] px-2 py-0.5 rounded font-bold">MOTION</div>`
                : (hasImage
                    ? `<img src="${scene.generatedUrl}" class="w-full h-full object-cover"
                           onerror="this.style.display='none';this.parentElement.innerHTML+='<div class=\\"text-xs text-red-400 text-center\\">Image Load Failed</div>'">
                                       <div class="absolute top-2 left-2 bg-green-600/80 text-white text-[9px] px-2 py-0.5 rounded font-bold">IMAGE</div>`
                    : `<div class="w-full h-full flex flex-col items-center justify-center text-xs text-slate-600 gap-2">
                                        <i data-lucide="image-plus" class="w-8 h-8 opacity-30"></i>
                                        <span>드래그하여 추가</span>
                                       </div>`)
            }
                            ${hasVisual ? `
                                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover/visual:opacity-100 transition flex items-center justify-center">
                                    <span class="text-xs text-white">클릭하여 변경</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </td>

                <!-- Audio & Subtitle Column -->
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
                             ${hasAudio ? `<audio src="${scene.audioUrl}" controls class="w-full h-6 rounded"></audio>` : ''}
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

                <!-- Options Column -->
                <td class="py-4 px-4 align-top text-right">
                    <div class="flex flex-col gap-2 items-end">
                        <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-200 transition">
                            <input type="checkbox" checked class="scene-include-check rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-0 focus:ring-offset-0" data-scene-id="${scene.sceneId}">
                            <span>포함</span>
                        </label>
                        ${scene.duration ? `<span class="text-[10px] text-slate-600">${scene.duration.toFixed(1)}s</span>` : ''}

                        ${this.editMode === 'manual' ? `
                            <div class="mt-2 space-y-2 w-full">
                                <div class="flex items-center gap-1">
                                    <button class="btn-move-up bg-slate-800 hover:bg-purple-700 text-slate-400 hover:text-white p-1 rounded transition" data-scene-id="${scene.sceneId}" title="위로 이동">
                                        <i data-lucide="arrow-up" class="w-3 h-3"></i>
                                    </button>
                                    <button class="btn-move-down bg-slate-800 hover:bg-purple-700 text-slate-400 hover:text-white p-1 rounded transition" data-scene-id="${scene.sceneId}" title="아래로 이동">
                                        <i data-lucide="arrow-down" class="w-3 h-3"></i>
                                    </button>
                                </div>
                                <input type="number" class="scene-duration-input w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                                    placeholder="시간(초)"
                                    value="${scene.customDuration || scene.duration || 5}"
                                    min="1"
                                    max="30"
                                    step="0.5"
                                    data-scene-id="${scene.sceneId}">

                                <!-- Edit Buttons -->
                                <div class="pt-2 border-t border-slate-700 space-y-1">
                                    <button class="btn-edit-script w-full bg-blue-900/30 hover:bg-blue-700 text-blue-400 hover:text-white px-2 py-1 rounded text-xs transition flex items-center justify-center gap-1" data-scene-id="${scene.sceneId}" title="대본 편집">
                                        <i data-lucide="file-text" class="w-3 h-3"></i> 대본
                                    </button>
                                    <button class="btn-edit-image w-full bg-purple-900/30 hover:bg-purple-700 text-purple-400 hover:text-white px-2 py-1 rounded text-xs transition flex items-center justify-center gap-1" data-scene-id="${scene.sceneId}" title="이미지 편집">
                                        <i data-lucide="image" class="w-3 h-3"></i> 이미지
                                    </button>
                                    <button class="btn-edit-audio w-full bg-green-900/30 hover:bg-green-700 text-green-400 hover:text-white px-2 py-1 rounded text-xs transition flex items-center justify-center gap-1" data-scene-id="${scene.sceneId}" title="오디오 편집">
                                        <i data-lucide="mic" class="w-3 h-3"></i> 오디오
                                    </button>
                                    <button class="btn-delete-scene w-full bg-red-900/30 hover:bg-red-700 text-red-400 hover:text-white px-2 py-1 rounded text-xs transition flex items-center justify-center gap-1" data-scene-id="${scene.sceneId}" title="씬 삭제">
                                        <i data-lucide="trash-2" class="w-3 h-3"></i> 삭제
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    initializeSubtitleSettings() {
        console.log('[VideoModule] 자막 설정 초기화 시작...');

        // 자막 활성화/비활성화 토글
        const subtitleEnabled = document.getElementById('subtitle-enabled');
        const subtitleOptions = document.getElementById('subtitle-options');

        console.log('[VideoModule] 자막 설정 요소:', {
            subtitleEnabled: !!subtitleEnabled,
            subtitleOptions: !!subtitleOptions
        });

        if (subtitleEnabled && subtitleOptions) {
            subtitleEnabled.addEventListener('change', (e) => {
                console.log('[VideoModule] 자막 토글:', e.target.checked);
                if (e.target.checked) {
                    subtitleOptions.classList.remove('opacity-50', 'pointer-events-none');
                } else {
                    subtitleOptions.classList.add('opacity-50', 'pointer-events-none');
                }
                this.updateSubtitlePreview();
            });
            console.log('[VideoModule] ✅ 자막 토글 이벤트 리스너 등록됨');
        } else {
            console.warn('[VideoModule] ⚠️ 자막 설정 요소를 찾을 수 없습니다!');
        }

        // 자막 크기 슬라이더
        const subtitleSize = document.getElementById('subtitle-size');
        const subtitleSizeValue = document.getElementById('subtitle-size-value');
        if (subtitleSize && subtitleSizeValue) {
            subtitleSize.addEventListener('input', (e) => {
                subtitleSizeValue.textContent = e.target.value;
                this.updateSubtitlePreview();
            });
        }

        // 외곽선 두께 슬라이더
        const outlineWidth = document.getElementById('subtitle-outline-width');
        const outlineWidthValue = document.getElementById('subtitle-outline-width-value');
        if (outlineWidth && outlineWidthValue) {
            outlineWidth.addEventListener('input', (e) => {
                outlineWidthValue.textContent = e.target.value;
                this.updateSubtitlePreview();
            });
        }

        // 색상 선택기 동기화
        const subtitleColor = document.getElementById('subtitle-color');
        const subtitleColorText = document.getElementById('subtitle-color-text');
        if (subtitleColor && subtitleColorText) {
            subtitleColor.addEventListener('input', (e) => {
                subtitleColorText.value = e.target.value;
                this.updateSubtitlePreview();
            });
            subtitleColorText.addEventListener('input', (e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    subtitleColor.value = e.target.value;
                    this.updateSubtitlePreview();
                }
            });
        }

        const outlineColor = document.getElementById('subtitle-outline-color');
        const outlineColorText = document.getElementById('subtitle-outline-color-text');
        if (outlineColor && outlineColorText) {
            outlineColor.addEventListener('input', (e) => {
                outlineColorText.value = e.target.value;
                this.updateSubtitlePreview();
            });
            outlineColorText.addEventListener('input', (e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    outlineColor.value = e.target.value;
                    this.updateSubtitlePreview();
                }
            });
        }

        // 기타 설정 변경 시 미리보기 업데이트
        ['subtitle-font', 'subtitle-position', 'subtitle-alignment'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    console.log(`[VideoModule] ${id} 변경됨`);
                    this.updateSubtitlePreview();
                });
                console.log(`[VideoModule] ✅ ${id} 이벤트 리스너 등록됨`);
            } else {
                console.warn(`[VideoModule] ⚠️ ${id} 요소를 찾을 수 없습니다!`);
            }
        });

        // 초기 미리보기 업데이트
        console.log('[VideoModule] 초기 자막 미리보기 업데이트...');
        this.updateSubtitlePreview();
        console.log('[VideoModule] ✅ 자막 설정 초기화 완료');
    }

    updateSubtitlePreview() {
        const preview = document.getElementById('subtitle-preview');
        if (!preview) return;

        const enabled = document.getElementById('subtitle-enabled')?.checked;
        const font = document.getElementById('subtitle-font')?.value || 'Pretendard-Vrew_700';
        const size = document.getElementById('subtitle-size')?.value || 100;
        const color = document.getElementById('subtitle-color')?.value || '#ffffff';
        const outlineColor = document.getElementById('subtitle-outline-color')?.value || '#000000';
        const outlineWidth = document.getElementById('subtitle-outline-width')?.value || 6;
        const alignment = document.getElementById('subtitle-alignment')?.value || 'center';

        if (!enabled) {
            preview.style.opacity = '0.3';
            return;
        }

        preview.style.opacity = '1';
        preview.style.fontFamily = `'${font}', sans-serif`;
        preview.style.fontSize = `${size / 5}px`; // 미리보기용 크기 조정
        preview.style.color = color;
        preview.style.textAlign = alignment;

        // 외곽선 효과 - paint-order와 stroke 사용 (더 깔끔한 렌더링)
        const w = parseInt(outlineWidth);
        preview.style.webkitTextStroke = `${w}px ${outlineColor}`;
        preview.style.paintOrder = 'stroke fill';
        preview.style.textShadow = 'none';
    }

    getSubtitleSettings() {
        return {
            enabled: document.getElementById('subtitle-enabled')?.checked ?? true,
            fontFamily: document.getElementById('subtitle-font')?.value || 'Pretendard-Vrew_700',
            fontSize: parseInt(document.getElementById('subtitle-size')?.value) || 100,
            fontColor: document.getElementById('subtitle-color')?.value || '#ffffff',
            outlineEnabled: true,
            outlineColor: document.getElementById('subtitle-outline-color')?.value || '#000000',
            outlineWidth: parseInt(document.getElementById('subtitle-outline-width')?.value) || 6,
            position: document.getElementById('subtitle-position')?.value || 'bottom',
            yOffset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0)',
            alignment: document.getElementById('subtitle-alignment')?.value || 'center'
        };
    }

    onMount() {
        // Setup guide button
        this.setupGuideButton();

        // Reset button
        const btnResetVideo = document.getElementById('btn-reset-video');
        if (btnResetVideo) {
            btnResetVideo.addEventListener('click', () => {
                if (confirm('⚠️ 모든 작업 내용이 삭제됩니다.\n\n정말 초기화하시겠습니까?')) {
                    AppState.startNewProject();
                    location.reload();
                }
            });
        }

        // 자막 설정 초기화 및 이벤트 리스너
        this.initializeSubtitleSettings();

        // 타임라인 토글 버튼
        const btnToggleTimeline = document.getElementById('btn-toggle-timeline');
        const timelineCards = document.getElementById('timeline-cards');

        if (btnToggleTimeline && timelineCards) {
            btnToggleTimeline.addEventListener('click', () => {
                timelineCards.classList.toggle('hidden');
                const icon = btnToggleTimeline.querySelector('i');
                if (timelineCards.classList.contains('hidden')) {
                    icon.setAttribute('data-lucide', 'eye-off');
                } else {
                    icon.setAttribute('data-lucide', 'eye');
                }
                if (window.lucide) window.lucide.createIcons();
            });
        }

        // 모드 전환 버튼
        const btnModeAuto = document.getElementById('btn-mode-auto');
        const btnModeManual = document.getElementById('btn-mode-manual');

        if (btnModeAuto) {
            btnModeAuto.addEventListener('click', () => {
                this.editMode = 'auto';
                this.refreshModule();
            });
        }

        if (btnModeManual) {
            btnModeManual.addEventListener('click', () => {
                this.editMode = 'manual';
                this.refreshModule();
            });
        }

        // 씬 추가 버튼 (항상 사용 가능)
        const btnAddScene = document.getElementById('btn-add-scene');
        if (btnAddScene) {
            btnAddScene.addEventListener('click', () => this.addNewScene());
        }

        // 메타데이터 & 썸네일 리스너 (항상 사용 가능)
        this.attachMetadataAndThumbnailListeners();

        // 수동 편집 컨트롤 (수동 모드일 때만)
        if (this.editMode === 'manual') {
            this.attachManualEditListeners();
        }

        // 영상 생성 버튼
        const btnGen = document.getElementById('btn-gen-final-video');
        if (btnGen) {
            btnGen.addEventListener('click', () => this.generateFinalVideo(false));
        }

        // Auto Start Logic
        if (AppState.getAutomation('video')) {
            setTimeout(() => {
                const scenes = AppState.getScenes();
                const readyScenes = this.countReadyScenes(scenes);
                // 모든 씬이 준비되었을 때만 자동 시작 (partial/missing이 0이어야 함)
                if (readyScenes.complete > 0 && readyScenes.partial === 0 && readyScenes.missing === 0) {
                    console.log('🤖 Auto-starting final video generation...');
                    this.generateFinalVideo(true);
                } else {
                    console.log('🤖 Auto-start skipped: Scenes not ready', readyScenes);
                }
            }, 2000); // UI 렌더링 후 약간의 딜레이
        }

        // Vrew 내보내기 버튼
        const btnVrew = document.getElementById('btn-export-vrew');
        if (btnVrew) {
            btnVrew.addEventListener('click', () => this.exportToVrew());
        }

        // Vrew 가져오기 버튼
        const btnImportVrew = document.getElementById('btn-import-vrew');
        if (btnImportVrew) {
            btnImportVrew.addEventListener('click', () => this.importFromVrew());
        }

        // 설정 변경 이벤트
        ['video-resolution', 'video-fps', 'video-preset', 'video-bitrate'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.updateSettings());
            }
        });

        // 자동 다운로드 토글
        const autoDownloadToggle = document.getElementById('auto-download-enabled');
        if (autoDownloadToggle) {
            autoDownloadToggle.addEventListener('change', (e) => {
                this.autoDownload = e.target.checked;
                localStorage.setItem('videoAutoDownload', this.autoDownload);
                console.log(`🔽 자동 다운로드: ${this.autoDownload ? 'ON' : 'OFF'}`);
            });
        }

        // 통계 토글
        const btnToggleStats = document.getElementById('btn-toggle-stats');
        if (btnToggleStats) {
            btnToggleStats.addEventListener('click', () => this.toggleStats());
        }

        // 작업 취소 버튼
        const btnCancel = document.getElementById('btn-cancel-task');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => this.cancelTask());
        }

        // 백엔드 설정 로드
        this.loadSettings();
    }

    attachMetadataAndThumbnailListeners() {
        console.log('🔗 메타데이터 & 썸네일 이벤트 리스너 연결 중...');

        // 메타데이터 생성
        const btnGenerateMetadata = document.getElementById('btn-generate-metadata');
        if (btnGenerateMetadata) {
            btnGenerateMetadata.addEventListener('click', () => this.generateMetadata());
        }

        // 제목 복사 버튼
        document.querySelectorAll('[id^="btn-copy-title-"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.id.replace('btn-copy-title-', ''));
                const metadata = AppState.metadata || {};
                if (metadata.titles && metadata.titles[index]) {
                    this.copyToClipboard(metadata.titles[index]);
                }
            });
        });

        // 설명 복사 버튼
        const btnCopyDescription = document.getElementById('btn-copy-description');
        if (btnCopyDescription) {
            btnCopyDescription.addEventListener('click', () => {
                const metadata = AppState.metadata || {};
                if (metadata.description) {
                    this.copyToClipboard(metadata.description);
                }
            });
        }

        // 태그 복사 버튼
        const btnCopyTags = document.getElementById('btn-copy-tags');
        if (btnCopyTags) {
            btnCopyTags.addEventListener('click', () => {
                const metadata = AppState.metadata || {};
                if (metadata.tags) {
                    const tagsText = metadata.tags.join(', ');
                    this.copyToClipboard(tagsText);
                }
            });
        }

        // 메타데이터 다운로드
        const btnDownloadMetadata = document.getElementById('btn-download-metadata');
        if (btnDownloadMetadata) {
            btnDownloadMetadata.addEventListener('click', () => this.downloadMetadata());
        }

        // 제목 선택 라디오 버튼
        document.querySelectorAll('[name="selected-title"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const index = parseInt(e.target.value);
                const metadata = AppState.metadata || {};
                metadata.selectedTitleIndex = index;
                AppState.metadata = metadata;
            });
        });

        // 썸네일 프롬프트 생성
        const btnGenerateThumbnailPrompts = document.getElementById('btn-generate-thumbnail-prompts');
        if (btnGenerateThumbnailPrompts) {
            btnGenerateThumbnailPrompts.addEventListener('click', () => this.generateThumbnailPrompts());
        }

        // 썸네일 이미지 생성
        document.querySelectorAll('.btn-generate-thumbnail').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-index'));
                this.generateThumbnailImage(index);
            });
        });

        // 썸네일 프롬프트 복사
        document.querySelectorAll('.btn-copy-thumbnail-prompt').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-index'));
                const thumbnail = AppState.thumbnail || {};
                if (thumbnail.prompts && thumbnail.prompts[index]) {
                    this.copyToClipboard(thumbnail.prompts[index]);
                }
            });
        });

        // 썸네일 다운로드
        document.querySelectorAll('.btn-download-thumbnail').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.getAttribute('data-url');
                this.downloadThumbnail(url);
            });
        });

        // 썸네일 프롬프트 전체 다운로드
        const btnDownloadAllThumbnailPrompts = document.getElementById('btn-download-all-thumbnail-prompts');
        if (btnDownloadAllThumbnailPrompts) {
            btnDownloadAllThumbnailPrompts.addEventListener('click', () => this.downloadAllThumbnailPrompts());
        }

        console.log('✅ 메타데이터 & 썸네일 이벤트 리스너 연결 완료');
        lucide.createIcons();
    }

    attachManualEditListeners() {
        // 대본 편집 버튼
        document.querySelectorAll('.btn-edit-script').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = parseInt(btn.getAttribute('data-scene-id'));
                this.editSceneScript(sceneId);
            });
        });

        // 이미지 편집 버튼
        document.querySelectorAll('.btn-edit-image').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = parseInt(btn.getAttribute('data-scene-id'));
                this.editSceneImage(sceneId);
            });
        });

        // 오디오 편집 버튼
        document.querySelectorAll('.btn-edit-audio').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = parseInt(btn.getAttribute('data-scene-id'));
                this.editSceneAudio(sceneId);
            });
        });

        // 씬 삭제 버튼
        document.querySelectorAll('.btn-delete-scene').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = parseInt(btn.getAttribute('data-scene-id'));
                this.deleteScene(sceneId);
            });
        });

        // 전환 효과 선택
        const transitionSelect = document.getElementById('manual-transition');
        if (transitionSelect) {
            transitionSelect.addEventListener('change', (e) => {
                this.manualEditSettings.transition = e.target.value;
                console.log('✅ Transition updated:', this.manualEditSettings.transition);
            });
        }

        // 전환 시간 조정
        const transitionDuration = document.getElementById('manual-transition-duration');
        if (transitionDuration) {
            transitionDuration.addEventListener('input', (e) => {
                this.manualEditSettings.transitionDuration = parseFloat(e.target.value);
                // 라벨 업데이트
                const label = e.target.previousElementSibling;
                if (label) {
                    label.innerHTML = `전환 시간 <span class="text-purple-400">${this.manualEditSettings.transitionDuration}초</span>`;
                }
            });
        }

        // 순서 초기화
        const btnResetOrder = document.getElementById('btn-reset-order');
        if (btnResetOrder) {
            btnResetOrder.addEventListener('click', () => {
                this.manualEditSettings.sceneOrder = [];
                alert('장면 순서가 원래대로 복원되었습니다.');
                this.refreshModule();
            });
        }

        // 타임라인 미리보기
        const btnShowTimeline = document.getElementById('btn-show-timeline');
        if (btnShowTimeline) {
            btnShowTimeline.addEventListener('click', () => this.showTimelinePreview());
        }

        // 장면 이동 버튼 (위로)
        document.querySelectorAll('.btn-move-up').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = parseInt(btn.getAttribute('data-scene-id'));
                this.moveSceneUp(sceneId);
            });
        });

        // 장면 이동 버튼 (아래로)
        document.querySelectorAll('.btn-move-down').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = parseInt(btn.getAttribute('data-scene-id'));
                this.moveSceneDown(sceneId);
            });
        });

        // 장면 지속 시간 입력
        document.querySelectorAll('.scene-duration-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const sceneId = parseInt(e.target.getAttribute('data-scene-id'));
                const duration = parseFloat(e.target.value);
                this.updateSceneDuration(sceneId, duration);
            });
        });
    }

    moveSceneUp(sceneId) {
        const scenes = AppState.getScenes();
        const index = scenes.findIndex(s => s.sceneId === sceneId);

        if (index <= 0) {
            alert('첫 번째 장면은 위로 이동할 수 없습니다.');
            return;
        }

        // Swap scenes
        [scenes[index - 1], scenes[index]] = [scenes[index], scenes[index - 1]];
        AppState.setScenes(scenes);

        this.refreshModule();
    }

    moveSceneDown(sceneId) {
        const scenes = AppState.getScenes();
        const index = scenes.findIndex(s => s.sceneId === sceneId);

        if (index === -1 || index >= scenes.length - 1) {
            alert('마지막 장면은 아래로 이동할 수 없습니다.');
            return;
        }

        // Swap scenes
        [scenes[index], scenes[index + 1]] = [scenes[index + 1], scenes[index]];
        AppState.setScenes(scenes);

        this.refreshModule();
    }

    updateSceneDuration(sceneId, duration) {
        const scenes = AppState.getScenes();
        const scene = scenes.find(s => s.sceneId === sceneId);

        if (scene) {
            scene.customDuration = Math.max(1, Math.min(30, duration)); // 1-30초 제한
            AppState.setScenes(scenes);
            console.log(`✅ Scene ${sceneId} duration updated to ${scene.customDuration}s`);
        }
    }

    showTimelinePreview() {
        const scenes = AppState.getScenes();
        const includedScenes = scenes.filter(s => {
            const checkbox = document.querySelector(`.scene-include-check[data-scene-id="${s.sceneId}"]`);
            return !checkbox || checkbox.checked;
        });

        if (includedScenes.length === 0) {
            alert('포함된 장면이 없습니다.');
            return;
        }

        let totalDuration = 0;
        let timelineHTML = `
            <div class="bg-slate-900 rounded-xl p-6 max-h-96 overflow-y-auto">
                <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <i data-lucide="clock" class="w-5 h-5 text-purple-400"></i>
                    타임라인 미리보기
                </h3>
                <div class="space-y-2">
        `;

        includedScenes.forEach((scene, index) => {
            const duration = scene.customDuration || scene.duration || 5;
            const startTime = totalDuration;
            totalDuration += duration;

            const hasVisual = !!(scene.videoUrl || scene.generatedUrl);
            const hasAudio = !!scene.audioUrl;
            const statusColor = hasVisual && hasAudio ? 'green' : hasVisual || hasAudio ? 'yellow' : 'red';

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
                    <div class="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 font-mono">
                        ${this.manualEditSettings.transition}
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
        lucide.createIcons();
    }

    async loadSettings() {
        try {
            const response = await fetch('http://localhost:8000/api/video/settings');
            if (response.ok) {
                const settings = await response.json();
                this.videoSettings = {
                    resolution: settings.resolution || '1080p',
                    fps: settings.fps || 30,
                    preset: settings.preset || 'medium',
                    bitrate: settings.bitrate || '8M'
                };
                this.syncSettingsUI();
            }
        } catch (e) {
            console.warn('Failed to load video settings:', e);
        }
    }

    async loadServiceStatus() {
        try {
            const response = await fetch('http://localhost:8000/api/video/status');
            if (response.ok) {
                this.serviceStatus = await response.json();
                this.updateStatsUI();
            }
        } catch (e) {
            console.warn('Failed to load video service status:', e);
        }
    }

    syncSettingsUI() {
        const resEl = document.getElementById('video-resolution');
        const fpsEl = document.getElementById('video-fps');
        const presetEl = document.getElementById('video-preset');
        const bitrateEl = document.getElementById('video-bitrate');

        if (resEl) resEl.value = this.videoSettings.resolution;
        if (fpsEl) fpsEl.value = String(this.videoSettings.fps);
        if (presetEl) presetEl.value = this.videoSettings.preset;
        if (bitrateEl) bitrateEl.value = this.videoSettings.bitrate;
    }

    async updateSettings() {
        const resolution = document.getElementById('video-resolution')?.value;
        const fps = parseInt(document.getElementById('video-fps')?.value || '30');
        const preset = document.getElementById('video-preset')?.value;
        const bitrate = document.getElementById('video-bitrate')?.value;

        this.videoSettings = { resolution, fps, preset, bitrate };

        try {
            await fetch('http://localhost:8000/api/video/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.videoSettings)
            });
            console.log('✅ Video settings updated');
        } catch (e) {
            console.error('Failed to update video settings:', e);
        }
    }

    updateStatsUI() {
        const statsContainer = document.getElementById('video-service-stats');
        if (!statsContainer || !this.serviceStatus?.stats) return;

        const stats = this.serviceStatus.stats;

        document.getElementById('stat-total-videos').textContent = stats.totalVideos || 0;
        document.getElementById('stat-total-duration').textContent =
            stats.totalDurationSeconds ? `${Math.round(stats.totalDurationSeconds)}s` : '-';
        document.getElementById('stat-avg-process-time').textContent =
            stats.averageProcessingTimeSeconds ? `${stats.averageProcessingTimeSeconds.toFixed(1)}s` : '-';
        document.getElementById('stat-success-rate').textContent =
            stats.totalVideos > 0
                ? `${Math.round((stats.successfulVideos / stats.totalVideos) * 100)}%`
                : '-';
    }

    toggleStats() {
        const statsContainer = document.getElementById('video-service-stats');
        if (statsContainer) {
            statsContainer.classList.toggle('hidden');
            if (!statsContainer.classList.contains('hidden')) {
                this.loadServiceStatus();
            }
        }
    }

    async generateFinalVideo(auto = false) {
        const scenes = AppState.getScenes();

        if (scenes.length === 0) {
            if (!auto) alert('씬이 없습니다. 최소 1개 이상의 씬이 필요합니다.');
            return;
        }

        const readyScenes = this.countReadyScenes(scenes);

        // 자산이 없어도 경고만 하고 생성 진행
        if (readyScenes.complete === 0 && !auto) {
            if (!confirm(`⚠️ 완전히 준비된 씬이 없습니다.\n\n완료: ${readyScenes.complete}개\n부분 완료: ${readyScenes.partial}개\n빈 씬: ${readyScenes.missing}개\n\n그래도 영상을 생성하시겠습니까?\n(빠진 자산은 기본값으로 대체됩니다)`)) {
                return;
            }
        } else if (!auto && !confirm(`${scenes.length}개의 씬으로 최종 영상을 생성하시겠습니까?\n\n완료: ${readyScenes.complete}개\n부분 완료: ${readyScenes.partial}개\n빈 씬: ${readyScenes.missing}개`)) {
            return;
        }

        const timelineData = this.prepareTimelineData(scenes);

        if (!timelineData) return;

        try {
            console.log('🎬 영상 생성 시작...');
            console.log('📊 타임라인 데이터:', timelineData);

            // 진행 상황 UI 표시 (먼저 표시)
            const progressContainer = document.getElementById('task-progress-container');
            const progressTitle = document.getElementById('task-progress-title');
            const progressBar = document.getElementById('task-progress-bar');
            const progressMessage = document.getElementById('task-progress-message');
            const progressPercent = document.getElementById('task-progress-percent');

            if (progressContainer) {
                progressContainer.classList.remove('hidden');
                progressTitle.textContent = '영상 생성 준비 중...';
                progressBar.style.width = '0%';
                progressPercent.textContent = '0%';
                progressMessage.textContent = '백엔드 서버에 요청 중...';
            }

            // 사용자에게 시작 알림
            console.log('✅ 영상 생성이 시작되었습니다!');

            // 자막 설정 가져오기
            const subtitleStyle = this.getSubtitleSettings();

            // 타임라인 데이터에 자막 설정 추가
            const requestData = {
                ...timelineData,
                subtitleStyle: subtitleStyle
            };

            // 작업 시작
            console.log('📤 API 요청 전송 중...');
            const response = await fetch(CONFIG.endpoints.video, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            console.log('📥 API 응답 수신:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to start video generation: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            const taskId = result.taskId;

            console.log(`✅ Task started: ${taskId}`);
            console.log('🔄 폴링 시작...');

            // 폴링 시작
            this.pollTaskStatus(taskId, '영상 생성');

        } catch (e) {
            console.error('❌ Video Generation Error:', e);

            // 진행 상황 UI 숨기기
            const progressContainer = document.getElementById('task-progress-container');
            if (progressContainer) {
                progressContainer.classList.add('hidden');
            }

            alert(`영상 생성 실패:\n\n${e.message}\n\n백엔드 서버가 실행 중인지 확인하세요.`);
        }
    }

    async exportToVrew() {
        if (!confirm('Vrew 프로젝트 파일로 내보내시겠습니까?\n\n⚠️ TTS 타임스탬프가 Vrew 자막과 동기화됩니다.')) return;

        const scenes = AppState.getScenes();
        const timelineData = this.prepareTimelineData(scenes);

        if (!timelineData) return;

        try {
            // 자막 설정 가져오기
            const subtitleStyle = this.getSubtitleSettings();

            // 타임라인 데이터에 자막 설정 추가
            const requestData = {
                ...timelineData,
                subtitleStyle: subtitleStyle
            };

            // 작업 시작
            const response = await fetch('http://localhost:8000/api/export-vrew', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) throw new Error('Failed to start Vrew export');

            const result = await response.json();
            const taskId = result.taskId;

            console.log(`✅ Vrew task started: ${taskId}`);

            // 폴링 시작
            this.pollTaskStatus(taskId, 'Vrew 내보내기');

        } catch (e) {
            console.error('❌ Vrew Export Error:', e);
            alert(`Vrew 내보내기 실패:\n${e.message}`);
        }
    }

    async importFromVrew() {
        // 파일 선택 대화상자 생성
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.vrew';
        input.style.display = 'none';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.name.endsWith('.vrew')) {
                alert('VREW 파일(.vrew)만 가져올 수 있습니다.');
                return;
            }

            if (!confirm(`'${file.name}'을(를) 가져오시겠습니까?\n\n⚠️ 현재 작업중인 씬들이 대체됩니다.`)) {
                return;
            }

            try {
                // 파일 업로드
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('http://localhost:8000/api/import-vrew', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'Failed to import VREW file');
                }

                const result = await response.json();
                console.log('✅ VREW Import Result:', result);

                // 가져온 데이터를 AppState에 저장
                const importedScenes = result.data.standalone || [];

                // sceneId 재할당 (1부터 시작)
                importedScenes.forEach((scene, index) => {
                    scene.sceneId = index + 1;
                });

                AppState.setScenes(importedScenes);

                // UI 갱신
                this.renderTimeline();

                alert(`✅ ${result.message}\n\n가져온 씬: ${importedScenes.length}개`);

            } catch (e) {
                console.error('❌ VREW Import Error:', e);
                alert(`VREW 가져오기 실패:\n${e.message}`);
            } finally {
                document.body.removeChild(input);
            }
        };

        document.body.appendChild(input);
        input.click();
    }

    async pollTaskStatus(taskId, taskName) {
        const progressContainer = document.getElementById('task-progress-container');
        const progressTitle = document.getElementById('task-progress-title');
        const progressBar = document.getElementById('task-progress-bar');
        const progressMessage = document.getElementById('task-progress-message');
        const progressPercent = document.getElementById('task-progress-percent');
        const elapsedTimeEl = document.getElementById('task-elapsed-time');

        // 프로그레스 UI 표시
        progressContainer.classList.remove('hidden');
        progressTitle.textContent = `${taskName} 진행 중...`;
        this.startTime = Date.now();

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // 경과 시간 타이머
        const elapsedTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            if (elapsedTimeEl) {
                elapsedTimeEl.textContent = `경과 시간: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);

        this.pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`http://localhost:8000/api/tasks/${taskId}`);
                if (!response.ok) throw new Error('Task not found');

                const task = await response.json();

                // 진행률 업데이트
                progressBar.style.width = `${task.progress}%`;
                progressPercent.textContent = `${task.progress}%`;
                progressMessage.textContent = task.message;

                // 완료 확인
                if (task.status === 'completed') {
                    clearInterval(this.pollInterval);
                    clearInterval(elapsedTimer);
                    this.pollInterval = null;
                    progressContainer.classList.add('hidden');

                    if (task.result.videoUrl) {
                        this.displayVideo(task.result.videoUrl);

                        // 자동 다운로드가 활성화되어 있으면 바로 다운로드
                        if (this.autoDownload) {
                            console.log('🔽 자동 다운로드 시작...');
                            const link = document.createElement('a');
                            link.href = task.result.videoUrl;
                            link.download = `final_video_${Date.now()}.mp4`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            alert(`✅ ${taskName} 완료!\n\n영상이 자동으로 다운로드되었습니다.\n아래에서도 확인하실 수 있습니다.`);
                        } else {
                            alert(`✅ ${taskName} 완료!\n\n아래에서 확인하실 수 있습니다.`);
                        }
                    } else if (task.result.vrewUrl) {
                        // Vrew 파일 다운로드
                        const link = document.createElement('a');
                        link.href = task.result.vrewUrl;
                        link.download = `project_${Date.now()}.vrew`;
                        link.click();
                        alert(`✅ Vrew 파일 내보내기 완료!\n\n파일이 다운로드되었습니다.\nVrew에서 열어 자막 편집이 가능합니다.`);
                    }

                    // 통계 새로고침
                    this.loadServiceStatus();

                } else if (task.status === 'failed') {
                    clearInterval(this.pollInterval);
                    clearInterval(elapsedTimer);
                    this.pollInterval = null;
                    progressContainer.classList.add('hidden');

                    console.error(`❌ ${taskName} 실패:`, task.error);
                    console.error('Task 상세 정보:', task);

                    alert(`❌ ${taskName} 실패:\n\n${task.error}\n\n콘솔(F12)에서 자세한 정보를 확인하세요.`);
                }

            } catch (e) {
                clearInterval(this.pollInterval);
                clearInterval(elapsedTimer);
                this.pollInterval = null;
                progressContainer.classList.add('hidden');
                alert(`오류: ${e.message}`);
            }
        }, 2000); // 2초마다 확인
    }

    cancelTask() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;

            const progressContainer = document.getElementById('task-progress-container');
            if (progressContainer) {
                progressContainer.classList.add('hidden');
            }

            console.log('⚠️ Task polling cancelled by user');
        }
    }

    displayVideo(videoUrl) {
        const container = document.getElementById('final-video-container');
        const player = document.getElementById('final-video-player');
        const info = document.getElementById('final-video-info');
        const stats = document.getElementById('final-video-stats');
        const downloadBtn = document.getElementById('btn-download-final');

        if (container && player && info && downloadBtn) {
            player.src = videoUrl;
            player.onerror = () => {
                info.textContent = '❌ 영상 로드 실패';
                info.classList.add('text-red-400');
                console.error('Final video load error:', videoUrl);
            };
            info.textContent = `영상이 생성되었습니다.`;

            if (stats && this.startTime) {
                const processingTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
                stats.textContent = `처리 시간: ${processingTime}초 | 설정: ${this.videoSettings.resolution} / ${this.videoSettings.fps}fps`;
            }

            container.classList.remove('hidden');

            downloadBtn.onclick = () => {
                const link = document.createElement('a');
                link.href = videoUrl;
                link.download = `final_video_${Date.now()}.mp4`;
                link.click();
            };

            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * 타임라인 데이터 준비 - Vrew 포맷 호환
     *
     * 출력 형식:
     * {
     *   mergedGroups: [{
     *     groupId, mergedAudio, totalDuration,
     *     scenes: [{ sceneId, visualUrl, startTime, endTime, duration, script, srtData }]
     *   }],
     *   standalone: [{ sceneId, visualUrl, audioUrl, script, duration, srtData }]
     * }
     */
    prepareTimelineData(scenes) {
        // 체크된 씬만 포함
        const includedScenes = scenes.filter(s => {
            const checkbox = document.querySelector(`.scene-include-check[data-scene-id="${s.sceneId}"]`);
            return !checkbox || checkbox.checked;
        });

        // Helper: SRT에서 duration 추출
        const getDurationFromSRT = (srtContent) => {
            if (!srtContent) return 5;

            const timeRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/g;
            const matches = [...srtContent.matchAll(timeRegex)];

            if (matches.length === 0) return 5;

            const lastMatch = matches[matches.length - 1];
            const [_, hours, minutes, seconds, milliseconds] = lastMatch;

            const totalSeconds =
                parseInt(hours) * 3600 +
                parseInt(minutes) * 60 +
                parseInt(seconds) +
                parseInt(milliseconds) / 1000;

            return Math.ceil(totalSeconds);
        };

        // Helper: Base64 체크
        const isBase64Data = (url) => {
            return url && (url.startsWith('data:image/') || url.startsWith('data:video/'));
        };

        // ================================================================
        // 타임라인 구조: 병합 그룹 + 개별 씬
        // ================================================================

        // 1. 병합 그룹별로 씬들을 분류
        const mergeGroups = {};
        const standaloneScenes = [];

        includedScenes.forEach(s => {
            if (s.mergeGroupId) {
                if (!mergeGroups[s.mergeGroupId]) {
                    mergeGroups[s.mergeGroupId] = [];
                }
                mergeGroups[s.mergeGroupId].push(s);
            } else {
                // 오디오가 없어도 standalone으로 포함
                standaloneScenes.push(s);
            }
        });

        console.log("📊 Merge groups detected:", Object.keys(mergeGroups).length);
        console.log("📊 Standalone scenes:", standaloneScenes.length);

        // 2. 타임라인 데이터 구성
        const timelineData = {
            mergedGroups: [],  // 병합된 그룹들
            standalone: [],    // 개별 씬들
            editMode: this.editMode,  // 편집 모드
            manualSettings: this.editMode === 'manual' ? {
                transition: this.manualEditSettings.transition,
                transitionDuration: this.manualEditSettings.transitionDuration
            } : null
        };

        // 병합 그룹 처리
        for (const gid in mergeGroups) {
            const group = mergeGroups[gid];
            const leader = group.find(s => s.isMergeLeader);

            if (!leader || !leader.audioUrl) continue;

            const groupData = {
                groupId: gid,
                mergedAudio: leader.audioUrl,
                totalDuration: leader.totalMergedDuration || 10,
                scenes: group.map(s => {
                    const visualUrl = s.videoUrl || s.generatedUrl || null;

                    // Skip Base64 data only
                    if (visualUrl && isBase64Data(visualUrl)) {
                        console.warn(`⚠️ Scene ${s.sceneId}: Base64 detected, skipping`);
                        return null;
                    }

                    // Warn if no visual asset but continue
                    if (!visualUrl) {
                        console.warn(`⚠️ Scene ${s.sceneId}: No visual asset (will use black screen)`);
                    }

                    const startTime = s.startTime || 0;
                    const endTime = s.endTime || (startTime + 5);
                    const duration = s.duration || (endTime - startTime) || 5;

                    // Vrew 호환: srtData 포함
                    const srtData = s.srtData || s.srt || null;

                    return {
                        sceneId: s.sceneId,
                        visualUrl: visualUrl,
                        startTime: startTime,
                        endTime: endTime,
                        duration: Math.max(duration, 1),
                        script: s.isMergeLeader ? (s.scriptForTTS || s.originalScript) : s.originalScript,
                        srtData: srtData  // Vrew 타임스탬프 동기화용
                    };
                }).filter(Boolean)
            };

            if (groupData.scenes.length > 0) {
                timelineData.mergedGroups.push(groupData);
            }
        }

        // 개별 씬 처리
        standaloneScenes.forEach(s => {
            console.log(`\n[Timeline] 씬 #${s.sceneId} 처리 중:`, {
                duration: s.duration,
                audioDuration: s.audioDuration,
                customDuration: s.customDuration,
                srtData: s.srtData ? `${s.srtData.length} chars` : 'null',
                visualUrl: s.generatedUrl ? 'present' : 'missing',
                audioUrl: s.audioUrl ? 'present' : 'missing'
            });

            const visualUrl = s.videoUrl || s.generatedUrl || null;
            const audioUrl = s.audioUrl || null;

            // Base64 데이터는 여전히 skip (백엔드에서 처리 불가)
            if (visualUrl && isBase64Data(visualUrl)) {
                console.warn(`⚠️ Scene ${s.sceneId}: Base64 visual detected, skipping`);
                return;
            }

            // 자산이 없으면 경고만 출력하고 계속 진행
            if (!visualUrl) {
                console.warn(`⚠️ Scene ${s.sceneId}: No visual asset (will use black screen)`);
            }

            if (!audioUrl) {
                console.warn(`⚠️ Scene ${s.sceneId}: No audio asset (will use silence)`);
            }

            const srtDuration = getDurationFromSRT(s.srtData);
            const explicitDuration = s.duration || s.audioDuration;

            console.log(`[Timeline] Duration 계산:`, {
                srtDuration,
                explicitDuration,
                customDuration: s.customDuration
            });

            // 수동 편집 모드에서는 customDuration 우선 사용
            const finalDuration = this.editMode === 'manual' && s.customDuration
                ? s.customDuration
                : (explicitDuration || srtDuration || 5);

            console.log(`[Timeline] 최종 Duration: ${finalDuration}초`);

            // Vrew 호환: srtData 포함
            const srtData = s.srtData || s.srt || null;

            const sceneData = {
                sceneId: s.sceneId,
                visualUrl: visualUrl,
                audioUrl: audioUrl,
                script: s.scriptForTTS || s.originalScript,
                duration: Math.max(finalDuration, 1),
                srtData: srtData  // Vrew 타임스탬프 동기화용
            };

            console.log(`[Timeline] 씬 데이터 추가:`, sceneData);

            timelineData.standalone.push(sceneData);
        });

        // 3. 유효성 검사
        const totalItems = timelineData.mergedGroups.reduce((sum, g) => sum + g.scenes.length, 0) + timelineData.standalone.length;

        if (totalItems === 0) {
            alert('생성 가능한 씬이 없습니다.\n\n체크된 씬이 있는지 확인해주세요.');
            return null;
        }

        // 자산 누락 정보는 경고만 출력 (생성은 진행)
        const missingVisuals = includedScenes.filter(s => !s.videoUrl && !s.generatedUrl).map(s => `#${s.sceneId}`);
        const missingAudio = includedScenes.filter(s => !s.audioUrl && !s.mergeGroupId).map(s => `#${s.sceneId}`);

        if (missingVisuals.length > 0 || missingAudio.length > 0) {
            console.warn('⚠️ Some scenes have missing assets:');
            if (missingVisuals.length > 0) {
                console.warn(`   - Missing visuals: ${missingVisuals.join(', ')}`);
            }
            if (missingAudio.length > 0) {
                console.warn(`   - Missing audio: ${missingAudio.join(', ')}`);
            }
            console.warn('   These will be replaced with default values (black screen / silence)');
        }

        console.log("✅ Timeline data prepared (Vrew compatible):", timelineData);
        console.log(`   - Merged groups: ${timelineData.mergedGroups.length}`);
        console.log(`   - Standalone scenes: ${timelineData.standalone.length}`);
        console.log(`   - Total items: ${totalItems}`);
        return timelineData;
    }

    // ================================================================
    // 메타데이터 생성
    // ================================================================

    async generateMetadata() {
        console.log('🎯 generateMetadata 함수 호출됨');

        const script = AppState.getScript();
        console.log('📝 스크립트:', script ? `${script.length}자` : '없음');

        if (!script || script.trim().length === 0) {
            alert('스크립트가 없습니다. 먼저 스크립트를 작성해주세요.');
            return;
        }

        const btn = document.getElementById('btn-generate-metadata');
        console.log('🔘 버튼 찾기:', btn ? '성공' : '실패');
        if (!btn) return;

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> AI 생성 중...';
        lucide.createIcons();

        try {
            console.log('📡 API 호출 시작: http://localhost:8000/api/generate-metadata');
            const response = await fetch('http://localhost:8000/api/generate-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script })
            });
            console.log('✅ API 응답 받음:', response.status);

            const data = await response.json();

            if (data.success) {
                AppState.metadata = {
                    titles: data.titles || [],
                    description: data.description || '',
                    tags: data.tags || [],
                    selectedTitleIndex: 0
                };
                console.log('✅ 메타데이터 생성 완료:', AppState.metadata);
                this.refreshModule();
            } else {
                const errorMsg = data.error || '알 수 없는 오류';
                console.error('❌ 메타데이터 생성 실패:', errorMsg);

                // API 키 관련 에러인 경우 더 자세한 안내
                if (errorMsg.includes('API 키')) {
                    alert('❌ 메타데이터 생성 실패\n\n' + errorMsg + '\n\n' +
                          '해결 방법:\n' +
                          '1. .env 파일에 AI API 키를 설정하세요\n' +
                          '   (OPENAI_API_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY 중 하나)\n' +
                          '2. 서버를 재시작하세요\n' +
                          '3. 브라우저 콘솔(F12)에서 자세한 로그를 확인하세요');
                } else {
                    alert('메타데이터 생성 실패: ' + errorMsg + '\n\n브라우저 콘솔(F12)과 서버 로그를 확인하세요.');
                }
            }
        } catch (error) {
            console.error('메타데이터 생성 오류:', error);
            alert('메타데이터 생성 중 오류가 발생했습니다.\n\n' +
                  '오류: ' + error.message + '\n\n' +
                  '브라우저 콘솔(F12)과 서버 로그를 확인하세요.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    copyToClipboard(text) {
        if (!navigator.clipboard) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('복사되었습니다!');
            return;
        }

        navigator.clipboard.writeText(text).then(() => {
            alert('복사되었습니다!');
        }).catch(err => {
            console.error('복사 실패:', err);
            alert('복사에 실패했습니다.');
        });
    }

    downloadMetadata() {
        const metadata = AppState.metadata;
        if (!metadata || !metadata.titles || metadata.titles.length === 0) {
            alert('생성된 메타데이터가 없습니다.');
            return;
        }

        let content = '='.repeat(60) + '\n';
        content += 'YouTube 메타데이터\n';
        content += '='.repeat(60) + '\n\n';

        content += '[ 제목 옵션 ]\n';
        content += '-'.repeat(60) + '\n';
        metadata.titles.forEach((title, i) => {
            const marker = (metadata.selectedTitleIndex === i) ? '★ ' : `${i + 1}. `;
            content += marker + title + '\n';
        });

        content += '\n[ 설명 ]\n';
        content += '-'.repeat(60) + '\n';
        content += metadata.description + '\n';

        content += '\n[ 태그 ]\n';
        content += '-'.repeat(60) + '\n';
        content += metadata.tags.join(', ') + '\n';

        content += '\n' + '='.repeat(60) + '\n';
        content += 'Generated by RealHunalo\n';
        content += '='.repeat(60) + '\n';

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'youtube_metadata.txt';
        a.click();
        URL.revokeObjectURL(url);

        console.log('✅ 메타데이터 다운로드 완료');
    }

    // ================================================================
    // 썸네일 생성
    // ================================================================

    async generateThumbnailPrompts() {
        console.log('🎯 generateThumbnailPrompts 함수 호출됨');

        const script = AppState.getScript();
        console.log('📝 스크립트:', script ? `${script.length}자` : '없음');

        if (!script || script.trim().length === 0) {
            alert('스크립트가 없습니다. 먼저 스크립트를 작성해주세요.');
            return;
        }

        const btn = document.getElementById('btn-generate-thumbnail-prompts');
        console.log('🔘 버튼 찾기:', btn ? '성공' : '실패');
        if (!btn) return;

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> AI 생성 중...';
        lucide.createIcons();

        try {
            console.log('📡 API 호출 시작: http://localhost:8000/api/generate-thumbnail-prompts');
            const response = await fetch('http://localhost:8000/api/generate-thumbnail-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script })
            });
            console.log('✅ API 응답 받음:', response.status);

            const data = await response.json();

            if (data.success) {
                AppState.thumbnail = {
                    prompts: data.prompts || [],
                    generatedImages: []
                };
                console.log('✅ 썸네일 프롬프트 생성 완료:', AppState.thumbnail);
                this.refreshModule();
            } else {
                const errorMsg = data.error || '알 수 없는 오류';
                console.error('❌ 썸네일 프롬프트 생성 실패:', errorMsg);

                // API 키 관련 에러인 경우 더 자세한 안내
                if (errorMsg.includes('API 키')) {
                    alert('❌ 썸네일 프롬프트 생성 실패\n\n' + errorMsg + '\n\n' +
                          '해결 방법:\n' +
                          '1. .env 파일에 AI API 키를 설정하세요\n' +
                          '   (OPENAI_API_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY 중 하나)\n' +
                          '2. 서버를 재시작하세요\n' +
                          '3. 브라우저 콘솔(F12)에서 자세한 로그를 확인하세요');
                } else {
                    alert('썸네일 프롬프트 생성 실패: ' + errorMsg + '\n\n브라우저 콘솔(F12)과 서버 로그를 확인하세요.');
                }
            }
        } catch (error) {
            console.error('썸네일 프롬프트 생성 오류:', error);
            alert('썸네일 프롬프트 생성 중 오류가 발생했습니다.\n\n' +
                  '오류: ' + error.message + '\n\n' +
                  '브라우저 콘솔(F12)과 서버 로그를 확인하세요.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    async generateThumbnailImage(index) {
        const thumbnail = AppState.thumbnail || {};
        if (!thumbnail.prompts || !thumbnail.prompts[index]) {
            alert('프롬프트가 없습니다.');
            return;
        }

        // 프롬프트 텍스트 업데이트 (사용자가 수정했을 수 있음)
        const promptTextarea = document.getElementById(`thumbnail-prompt-${index}`);
        if (promptTextarea) {
            thumbnail.prompts[index] = promptTextarea.value;
        }

        const prompt = thumbnail.prompts[index];
        const btn = document.querySelectorAll('.btn-generate-thumbnail')[index];
        if (!btn) return;

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> 생성 중...';
        lucide.createIcons();

        try {
            const response = await fetch('http://localhost:8000/api/generate-thumbnail-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    aspectRatio: '16:9'
                })
            });

            const data = await response.json();

            if (data.success) {
                // 기존 이미지 제거 (같은 인덱스)
                thumbnail.generatedImages = thumbnail.generatedImages.filter(img => img.promptIndex !== index);

                // 새 이미지 추가
                thumbnail.generatedImages.push({
                    promptIndex: index,
                    url: data.imageUrl,
                    prompt: prompt
                });

                AppState.thumbnail = thumbnail;
                console.log(`✅ 썸네일 ${index + 1} 생성 완료:`, data.imageUrl);
                this.refreshModule();
            } else {
                alert('썸네일 생성 실패: ' + (data.error || '알 수 없는 오류'));
            }
        } catch (error) {
            console.error('썸네일 생성 오류:', error);
            alert('썸네일 생성 중 오류가 발생했습니다.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    downloadThumbnail(url) {
        if (!url) {
            alert('다운로드할 이미지가 없습니다.');
            return;
        }

        const a = document.createElement('a');
        a.href = url;
        a.download = `thumbnail_${Date.now()}.png`;
        a.target = '_blank';
        a.click();

        console.log('✅ 썸네일 다운로드 시작:', url);
    }

    downloadAllThumbnailPrompts() {
        const thumbnail = AppState.thumbnail;
        if (!thumbnail || !thumbnail.prompts || thumbnail.prompts.length === 0) {
            alert('생성된 프롬프트가 없습니다.');
            return;
        }

        let content = '='.repeat(60) + '\n';
        content += 'YouTube 썸네일 프롬프트\n';
        content += '='.repeat(60) + '\n\n';

        thumbnail.prompts.forEach((prompt, i) => {
            content += `[ 프롬프트 ${i + 1} ]\n`;
            content += '-'.repeat(60) + '\n';
            content += prompt + '\n\n';
        });

        content += '='.repeat(60) + '\n';
        content += 'Generated by RealHunalo\n';
        content += '='.repeat(60) + '\n';

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'thumbnail_prompts.txt';
        a.click();
        URL.revokeObjectURL(url);

        console.log('✅ 썸네일 프롬프트 다운로드 완료');
    }

    // ================================================================
    // Manual Editing Methods
    // ================================================================

    addNewScene() {
        const scenes = AppState.getScenes();
        const newSceneId = scenes.length > 0 ? Math.max(...scenes.map(s => s.sceneId)) + 1 : 1;

        const newScene = {
            sceneId: newSceneId,
            voText: '새 장면의 대본을 입력하세요.',
            imagePrompt: '',
            generatedUrl: null,
            videoUrl: null,
            audioUrl: null,
            duration: 5.0
        };

        scenes.push(newScene);
        AppState.setScenes(scenes);
        this.refreshModule();

        console.log('[VideoModule] 새 장면 추가:', newSceneId);
        alert(`장면 #${newSceneId}이(가) 추가되었습니다. 대본, 이미지, 오디오를 편집하세요.`);
    }

    editSceneScript(sceneId) {
        const scenes = AppState.getScenes();
        const scene = scenes.find(s => s.sceneId === sceneId);

        if (!scene) {
            alert('장면을 찾을 수 없습니다.');
            return;
        }

        const newScript = prompt('대본을 입력하세요:', scene.voText || '');

        if (newScript !== null && newScript.trim() !== '') {
            scene.voText = newScript.trim();
            AppState.setScenes(scenes);
            this.refreshModule();
            console.log(`[VideoModule] 장면 #${sceneId} 대본 수정:`, newScript);
        }
    }

    async editSceneImage(sceneId) {
        const scenes = AppState.getScenes();
        const scene = scenes.find(s => s.sceneId === sceneId);

        if (!scene) {
            alert('장면을 찾을 수 없습니다.');
            return;
        }

        const choice = prompt(
            '이미지 편집 방법을 선택하세요:\n' +
            '1. URL 입력\n' +
            '2. 이미지 생성 (프롬프트 입력)\n' +
            '\n선택 (1 또는 2):',
            '1'
        );

        if (choice === '1') {
            // URL 입력
            const imageUrl = prompt('이미지 URL을 입력하세요:', scene.generatedUrl || '');
            if (imageUrl !== null && imageUrl.trim() !== '') {
                scene.generatedUrl = imageUrl.trim();
                scene.videoUrl = null; // Reset video URL
                AppState.setScenes(scenes);
                this.refreshModule();
                console.log(`[VideoModule] 장면 #${sceneId} 이미지 URL 설정:`, imageUrl);
            }
        } else if (choice === '2') {
            // 이미지 생성
            const prompt = window.prompt('이미지 생성 프롬프트를 입력하세요:', scene.imagePrompt || scene.voText || '');

            if (prompt !== null && prompt.trim() !== '') {
                try {
                    console.log(`[VideoModule] 장면 #${sceneId} 이미지 생성 중...`);

                    const response = await fetch(`${CONFIG.API_BASE}/generate/image`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: prompt.trim(),
                            model: 'black-forest-labs/flux-schnell',
                            aspect_ratio: '16:9',
                            num_outputs: 1
                        })
                    });

                    const result = await response.json();

                    if (result.success && result.imageUrl) {
                        scene.imagePrompt = prompt.trim();
                        scene.generatedUrl = result.imageUrl;
                        scene.videoUrl = null; // Reset video URL
                        AppState.setScenes(scenes);
                        this.refreshModule();
                        console.log(`[VideoModule] 장면 #${sceneId} 이미지 생성 완료`);
                        alert('이미지가 생성되었습니다!');
                    } else {
                        throw new Error(result.error || '이미지 생성 실패');
                    }
                } catch (error) {
                    console.error('[VideoModule] 이미지 생성 오류:', error);
                    alert(`이미지 생성 실패: ${error.message}`);
                }
            }
        }
    }

    async editSceneAudio(sceneId) {
        const scenes = AppState.getScenes();
        const scene = scenes.find(s => s.sceneId === sceneId);

        if (!scene) {
            alert('장면을 찾을 수 없습니다.');
            return;
        }

        const choice = prompt(
            '오디오 편집 방법을 선택하세요:\n' +
            '1. URL 입력\n' +
            '2. TTS 생성 (대본에서)\n' +
            '\n선택 (1 또는 2):',
            '1'
        );

        if (choice === '1') {
            // URL 입력
            const audioUrl = prompt('오디오 URL을 입력하세요:', scene.audioUrl || '');
            if (audioUrl !== null && audioUrl.trim() !== '') {
                scene.audioUrl = audioUrl.trim();
                AppState.setScenes(scenes);
                this.refreshModule();
                console.log(`[VideoModule] 장면 #${sceneId} 오디오 URL 설정:`, audioUrl);
            }
        } else if (choice === '2') {
            // TTS 생성
            if (!scene.voText || scene.voText.trim() === '') {
                alert('대본이 없습니다. 먼저 대본을 입력하세요.');
                return;
            }

            try {
                console.log(`[VideoModule] 장면 #${sceneId} TTS 생성 중...`);

                const response = await fetch(`${CONFIG.API_BASE}/generate/tts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: scene.voText,
                        engine: 'elevenlabs',
                        voice: 'Rachel'
                    })
                });

                const result = await response.json();

                if (result.success && result.audioUrl) {
                    scene.audioUrl = result.audioUrl;
                    scene.duration = result.duration || 5.0;
                    AppState.setScenes(scenes);
                    this.refreshModule();
                    console.log(`[VideoModule] 장면 #${sceneId} TTS 생성 완료`);
                    alert('TTS가 생성되었습니다!');
                } else {
                    throw new Error(result.error || 'TTS 생성 실패');
                }
            } catch (error) {
                console.error('[VideoModule] TTS 생성 오류:', error);
                alert(`TTS 생성 실패: ${error.message}`);
            }
        }
    }

    deleteScene(sceneId) {
        const scenes = AppState.getScenes();
        const sceneIndex = scenes.findIndex(s => s.sceneId === sceneId);

        if (sceneIndex === -1) {
            alert('장면을 찾을 수 없습니다.');
            return;
        }

        const confirmed = confirm(`장면 #${sceneId}을(를) 삭제하시겠습니까?`);

        if (confirmed) {
            scenes.splice(sceneIndex, 1);
            AppState.setScenes(scenes);
            this.refreshModule();
            console.log(`[VideoModule] 장면 #${sceneId} 삭제 완료`);
        }
    }
}
