// ================================================================
// DASHBOARD MODULE - 대시보드
// 전체 서비스 상태, 통계, API 키 상태를 한눈에 표시
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG } from '../config.js';

export class DashboardModule extends Module {
    constructor() {
        super('dashboard', '대시보드', 'layout-dashboard', '전체 서비스 상태 모니터링');

        this.serviceStatus = {
            tts: null,
            image: null,
            motion: null,
            video: null
        };

        this.refreshInterval = null;
    }

    async loadAllServiceStatus() {
        try {
            // Parallel fetch all service statuses
            const [ttsStatus, videoStatus, motionStatus] = await Promise.all([
                fetch('http://localhost:8000/api/tts/status').then(r => r.json()).catch(() => null),
                fetch('http://localhost:8000/api/video/status').then(r => r.json()).catch(() => null),
                fetch('http://localhost:8000/api/motion/status').then(r => r.json()).catch(() => null)
            ]);

            this.serviceStatus = {
                tts: ttsStatus,
                video: videoStatus,
                motion: motionStatus,
                image: { service: 'image', available: true } // Image service는 Replicate 기반
            };

            this.updateDashboard();
        } catch (e) {
            console.error('Failed to load service status:', e);
        }
    }

    renderServiceCard(serviceName, status, icon, color) {
        const isAvailable = status?.available !== false;
        const stats = status?.stats || {};

        let statusBadge = isAvailable
            ? `<span class="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-lg font-bold">● 정상</span>`
            : `<span class="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg font-bold">● 오류</span>`;

        // Service-specific info
        let serviceInfo = '';
        if (serviceName === 'TTS') {
            serviceInfo = `
                <div class="text-xs text-slate-400 mt-2">
                    <div>Primary: <span class="text-${color}-400">${status?.primaryEngine || 'N/A'}</span></div>
                    <div>Engines: ${status?.availableEngines?.join(', ') || 'N/A'}</div>
                </div>
            `;
        } else if (serviceName === 'Video') {
            serviceInfo = `
                <div class="text-xs text-slate-400 mt-2">
                    <div>Resolution: ${status?.settings?.resolution || 'N/A'}</div>
                    <div>FPS: ${status?.settings?.fps || 'N/A'}</div>
                </div>
            `;
        } else if (serviceName === 'Motion') {
            serviceInfo = `
                <div class="text-xs text-slate-400 mt-2">
                    <div>Model: ${status?.model?.replace('bytedance/', '') || 'N/A'}</div>
                </div>
            `;
        } else if (serviceName === 'Image') {
            serviceInfo = `
                <div class="text-xs text-slate-400 mt-2">
                    <div>Provider: Replicate (Flux)</div>
                </div>
            `;
        }

        // Stats
        const totalJobs = stats.total_jobs || stats.totalGenerated || 0;
        const successJobs = stats.successful_jobs || stats.successCount || 0;
        const successRate = totalJobs > 0 ? ((successJobs / totalJobs) * 100).toFixed(1) : 0;
        const avgTime = stats.avg_processing_time?.toFixed(2) || stats.avgProcessingTime?.toFixed(2) || 0;

        return `
            <div class="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-${color}-500/30 rounded-2xl p-6 hover:border-${color}-500/50 transition">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="p-3 bg-${color}-500/20 rounded-xl">
                            <i data-lucide="${icon}" class="w-6 h-6 text-${color}-400"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-white">${serviceName} Service</h3>
                            <p class="text-xs text-slate-500">서비스 상태</p>
                        </div>
                    </div>
                    ${statusBadge}
                </div>

                ${serviceInfo}

                <div class="mt-4 pt-4 border-t border-slate-700/50">
                    <div class="grid grid-cols-3 gap-3 text-center">
                        <div>
                            <div class="text-xl font-bold text-${color}-400">${totalJobs}</div>
                            <div class="text-[10px] text-slate-500 uppercase">Total</div>
                        </div>
                        <div>
                            <div class="text-xl font-bold text-green-400">${successRate}%</div>
                            <div class="text-[10px] text-slate-500 uppercase">Success</div>
                        </div>
                        <div>
                            <div class="text-xl font-bold text-cyan-400">${avgTime}s</div>
                            <div class="text-[10px] text-slate-500 uppercase">Avg Time</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderAPIKeysPanel() {
        return `
            <div class="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
                <div class="flex items-center gap-3 mb-5">
                    <div class="p-2 bg-yellow-500/20 rounded-lg text-yellow-400">
                        <i data-lucide="key" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white">🔑 API 키 상태</h3>
                </div>

                <div class="space-y-3">
                    <div class="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                        <div class="flex items-center gap-2">
                            <i data-lucide="zap" class="w-4 h-4 text-purple-400"></i>
                            <span class="text-sm text-slate-300">ElevenLabs API</span>
                        </div>
                        <span id="api-status-elevenlabs" class="text-xs px-2 py-1 bg-slate-700 text-slate-400 rounded">확인 중...</span>
                    </div>

                    <div class="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                        <div class="flex items-center gap-2">
                            <i data-lucide="cloud" class="w-4 h-4 text-blue-400"></i>
                            <span class="text-sm text-slate-300">Azure TTS</span>
                        </div>
                        <span id="api-status-azure" class="text-xs px-2 py-1 bg-slate-700 text-slate-400 rounded">확인 중...</span>
                    </div>

                    <div class="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                        <div class="flex items-center gap-2">
                            <i data-lucide="image" class="w-4 h-4 text-pink-400"></i>
                            <span class="text-sm text-slate-300">Replicate API</span>
                        </div>
                        <span id="api-status-replicate" class="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">설정됨</span>
                    </div>

                    <div class="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                        <div class="flex items-center gap-2">
                            <i data-lucide="brain" class="w-4 h-4 text-green-400"></i>
                            <span class="text-sm text-slate-300">OpenAI API</span>
                        </div>
                        <span id="api-status-openai" class="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">설정됨</span>
                    </div>
                </div>

                <button id="btn-validate-keys" class="mt-4 w-full glass hover:bg-white/5 text-blue-400 px-4 py-3 rounded-2xl text-sm font-bold transition flex items-center justify-center gap-2 border border-blue-500/20">
                    <i data-lucide="refresh-cw" class="w-4 h-4"></i> API 키 검증
                </button>
            </div>
        `;
    }

    renderProjectInfo() {
        const scenes = AppState.getScenes();
        const stats = {
            totalScenes: scenes.length,
            withImages: scenes.filter(s => s.generatedUrl).length,
            withAudio: scenes.filter(s => s.audioUrl).length,
            withVideo: scenes.filter(s => s.videoUrl).length
        };

        return `
            <div class="bg-gradient-to-br from-slate-800/60 to-indigo-900/30 border border-indigo-500/30 rounded-2xl p-6">
                <div class="flex items-center gap-3 mb-5">
                    <div class="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <i data-lucide="folder" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white">📁 프로젝트 현황</h3>
                </div>

                <div class="space-y-3">
                    <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                        <span class="text-sm text-slate-400">총 장면 수</span>
                        <span class="text-lg font-bold text-white">${stats.totalScenes}개</span>
                    </div>

                    <div class="grid grid-cols-3 gap-2">
                        <div class="p-3 bg-black/20 rounded-lg text-center">
                            <div class="text-xs text-slate-500 mb-1">이미지</div>
                            <div class="text-lg font-bold text-purple-400">${stats.withImages}</div>
                        </div>
                        <div class="p-3 bg-black/20 rounded-lg text-center">
                            <div class="text-xs text-slate-500 mb-1">오디오</div>
                            <div class="text-lg font-bold text-blue-400">${stats.withAudio}</div>
                        </div>
                        <div class="p-3 bg-black/20 rounded-lg text-center">
                            <div class="text-xs text-slate-500 mb-1">비디오</div>
                            <div class="text-lg font-bold text-pink-400">${stats.withVideo}</div>
                        </div>
                    </div>

                    <div class="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                        <div class="text-xs text-indigo-300">
                            <i data-lucide="info" class="w-3 h-3 inline"></i>
                            완성도: ${stats.totalScenes > 0 ? Math.round((stats.withVideo / stats.totalScenes) * 100) : 0}%
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        return `
            <div class="max-w-7xl mx-auto slide-up space-y-6">
                <!-- Header -->
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-4xl font-black text-white tracking-tighter mb-2 italic">RealHunalo <span class="text-blue-500">STUDIO</span></h1>
                        <p class="text-sm text-slate-400 font-medium">부동산 시니어 타겟 AI 영상 콘텐츠의 핵심 허브</p>
                    </div>
                    <div class="flex gap-3">
                        <button id="btn-refresh-dashboard" class="glass hover:bg-white/5 text-white px-6 py-3 rounded-2xl text-sm font-bold transition flex items-center gap-2 border border-white/5">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i> 새로고침
                        </button>
                        <button onclick="app.route('script')" class="btn-primary-cinematic flex items-center gap-2 px-8 py-3 rounded-2xl text-sm shadow-xl">
                            <i data-lucide="plus-circle" class="w-5 h-5"></i>
                            <span>새 콘텐츠 제작</span>
                        </button>
                    </div>
                </div>

                <!-- Service Status Cards -->
                <div class="grid grid-cols-2 gap-6" id="service-cards-container">
                    ${this.renderServiceCard('TTS', this.serviceStatus.tts, 'mic-2', 'blue')}
                    ${this.renderServiceCard('Image', this.serviceStatus.image, 'palette', 'purple')}
                    ${this.renderServiceCard('Motion', this.serviceStatus.motion, 'video', 'pink')}
                    ${this.renderServiceCard('Video', this.serviceStatus.video, 'film', 'indigo')}
                </div>

                <!-- Bottom Row: API Keys & Project Info -->
                <div class="grid grid-cols-2 gap-6">
                    ${this.renderAPIKeysPanel()}
                    ${this.renderProjectInfo()}
                </div>

                <!-- System Info -->
                <div class="bg-slate-800/20 border border-slate-700/50 rounded-2xl p-6">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="p-2 bg-slate-500/20 rounded-lg text-slate-400">
                            <i data-lucide="info" class="w-5 h-5"></i>
                        </div>
                        <h3 class="text-lg font-bold text-white">ℹ️ 시스템 정보</h3>
                    </div>

                    <div class="grid grid-cols-4 gap-4 text-sm">
                        <div class="p-3 bg-slate-900/50 rounded-lg">
                            <div class="text-xs text-slate-500 mb-1">Platform</div>
                            <div class="text-slate-300 font-mono">Web App</div>
                        </div>
                        <div class="p-3 bg-slate-900/50 rounded-lg">
                            <div class="text-xs text-slate-500 mb-1">Backend</div>
                            <div class="text-slate-300 font-mono">FastAPI</div>
                        </div>
                        <div class="p-3 bg-slate-900/50 rounded-lg">
                            <div class="text-xs text-slate-500 mb-1">Server</div>
                            <div class="text-slate-300 font-mono">localhost:8000</div>
                        </div>
                        <div class="p-3 bg-slate-900/50 rounded-lg">
                            <div class="text-xs text-slate-500 mb-1">Status</div>
                            <div class="text-green-400 font-mono">● Running</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    updateDashboard() {
        const container = document.getElementById('service-cards-container');
        if (container) {
            container.innerHTML = `
                ${this.renderServiceCard('TTS', this.serviceStatus.tts, 'mic-2', 'blue')}
                ${this.renderServiceCard('Image', this.serviceStatus.image, 'palette', 'purple')}
                ${this.renderServiceCard('Motion', this.serviceStatus.motion, 'video', 'pink')}
                ${this.renderServiceCard('Video', this.serviceStatus.video, 'film', 'indigo')}
            `;
            lucide.createIcons();
        }
    }

    async validateAPIKeys() {
        try {
            const response = await fetch('http://localhost:8000/api/tts/validate', {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Validation failed');

            const result = await response.json();

            // Update ElevenLabs status
            const elevenLabsEl = document.getElementById('api-status-elevenlabs');
            if (elevenLabsEl) {
                if (result.elevenlabs?.valid) {
                    elevenLabsEl.className = 'text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded';
                    elevenLabsEl.textContent = '✓ 유효';
                } else {
                    elevenLabsEl.className = 'text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded';
                    elevenLabsEl.textContent = '✕ 오류';
                }
            }

            // Update Azure status
            const azureEl = document.getElementById('api-status-azure');
            if (azureEl) {
                if (result.azure?.valid) {
                    azureEl.className = 'text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded';
                    azureEl.textContent = '✓ 유효';
                } else {
                    azureEl.className = 'text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded';
                    azureEl.textContent = '✕ 오류';
                }
            }

            alert('API 키 검증 완료!');

        } catch (e) {
            console.error('API key validation failed:', e);
            alert('API 키 검증 실패: ' + e.message);
        }
    }

    onMount() {
        // Load initial service status
        this.loadAllServiceStatus();

        // Refresh button
        const btnRefresh = document.getElementById('btn-refresh-dashboard');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                btnRefresh.disabled = true;
                btnRefresh.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 새로고침 중...';
                lucide.createIcons();

                this.loadAllServiceStatus().then(() => {
                    btnRefresh.disabled = false;
                    btnRefresh.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i> 새로고침';
                    lucide.createIcons();
                });
            });
        }

        // Validate API keys button
        const btnValidate = document.getElementById('btn-validate-keys');
        if (btnValidate) {
            btnValidate.addEventListener('click', () => {
                btnValidate.disabled = true;
                btnValidate.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 검증 중...';
                lucide.createIcons();

                this.validateAPIKeys().then(() => {
                    btnValidate.disabled = false;
                    btnValidate.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i> API 키 검증';
                    lucide.createIcons();
                });
            });
        }

        // Auto-refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadAllServiceStatus();
        }, 30000);

        lucide.createIcons();
    }

    onUnmount() {
        // Clear refresh interval when leaving dashboard
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}
