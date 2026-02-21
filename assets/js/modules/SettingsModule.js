// ================================================================
// SETTINGS MODULE - 설정
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG } from '../config.js';
import { getAllCacheStats, clearAllCaches } from '../cache.js';

export class SettingsModule extends Module {
    constructor() {
        super('settings', '설정', 'settings', 'API 키 관리 및 앱 설정');

        // 기본 AI 모델 설정
        this.aiModels = {
            deepseek: { name: 'DeepSeek', provider: 'DeepSeek', status: 'unchecked' },
            gemini: { name: 'Gemini Pro', provider: 'Google', status: 'unchecked' },
            openai: { name: 'GPT-4', provider: 'OpenAI', status: 'unchecked' },
            anthropic: { name: 'Claude 3', provider: 'Anthropic', status: 'unchecked' },
            perplexity: { name: 'Perplexity', provider: 'Perplexity', status: 'unchecked' }
        };

        // 로컬 저장소에서 설정 로드
        this.loadSettings();
    }

    async loadSettings() {
        const saved = localStorage.getItem('app_settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.aiModels = settings.aiModels || this.aiModels;
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }

        // 백엔드에서 저장된 API 키 상태 확인
        try {
            const response = await fetch(CONFIG.endpoints.checkSavedKeys);
            const result = await response.json();
            if (result.success) {
                // 각 모델에 saved 플래그 설정
                Object.keys(result.savedKeys).forEach(key => {
                    if (this.aiModels[key] && result.savedKeys[key]) {
                        this.aiModels[key].saved = true;
                        this.aiModels[key].apiKey = '••••••••';  // 마스킹된 키 표시
                    }
                });
            }
        } catch (e) {
            console.log('저장된 API 키 확인 실패:', e);
        }
    }

    saveSettings() {
        const settings = {
            aiModels: this.aiModels,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('app_settings', JSON.stringify(settings));
        console.log('✅ 설정이 저장되었습니다.');
    }

    render() {
        return `
            <div class="max-w-5xl mx-auto slide-up space-y-6">
                <!-- User Guide Button -->
                ${this.renderGuideButton()}

                <!-- AI Model Selection -->
                <div class="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 rounded-2xl p-6">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                            <i data-lucide="brain" class="w-6 h-6"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-white">AI 모델 설정</h2>
                            <p class="text-sm text-slate-400">API 키 등록 및 테스트</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${Object.entries(this.aiModels).map(([key, model]) => this.renderModelCard(key, model)).join('')}
                    </div>
                </div>

                <!-- YouTube API -->
                <div class="bg-gradient-to-r from-red-900/30 to-pink-900/30 border border-red-500/30 rounded-2xl p-6">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="p-3 bg-red-500/20 rounded-xl text-red-400">
                            <i data-lucide="youtube" class="w-6 h-6"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-white">YouTube API 설정</h2>
                            <p class="text-sm text-slate-400">채널 분석 및 키워드 조사</p>
                        </div>
                    </div>

                    <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                        <div class="flex items-center gap-3 mb-3">
                            <i data-lucide="key" class="w-4 h-4 text-slate-400"></i>
                            <span class="text-sm font-bold text-slate-300">API Key</span>
                            <span id="youtube-status" class="ml-auto text-xs px-2 py-1 rounded bg-slate-800 text-slate-400">미확인</span>
                        </div>
                        <input type="password" id="youtube-api-key"
                            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 font-mono mb-3"
                            placeholder="YouTube Data API v3 Key">
                        <div class="flex gap-2">
                            <button id="btn-test-youtube" class="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2">
                                <i data-lucide="test-tube" class="w-4 h-4"></i> API 테스트
                            </button>
                            <button id="btn-save-youtube" class="hidden flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2">
                                <i data-lucide="save" class="w-4 h-4"></i> 저장
                            </button>
                        </div>
                    </div>
                </div>

                <!-- TTS Engines -->
                <div class="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 rounded-2xl p-6">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="p-3 bg-cyan-500/20 rounded-xl text-cyan-400">
                            <i data-lucide="mic-2" class="w-6 h-6"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-white">TTS 엔진 설정</h2>
                            <p class="text-sm text-slate-400">음성 합성 서비스 검증</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <!-- ElevenLabs -->
                        <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                            <div class="flex items-center justify-between mb-3">
                                <div>
                                    <h3 class="text-sm font-bold text-white">ElevenLabs</h3>
                                    <p class="text-xs text-slate-500">고품질 AI 음성</p>
                                </div>
                                <span id="elevenlabs-status" class="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded font-bold">미확인</span>
                            </div>
                            <button id="btn-test-elevenlabs" class="w-full bg-slate-700 hover:bg-cyan-600 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5">
                                <i data-lucide="test-tube" class="w-3 h-3"></i> 엔진 테스트
                            </button>
                        </div>

                        <!-- Azure TTS -->
                        <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                            <div class="flex items-center justify-between mb-3">
                                <div>
                                    <h3 class="text-sm font-bold text-white">Azure TTS</h3>
                                    <p class="text-xs text-slate-500">Microsoft Cognitive</p>
                                </div>
                                <span id="azure-status" class="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded font-bold">미확인</span>
                            </div>
                            <button id="btn-test-azure" class="w-full bg-slate-700 hover:bg-cyan-600 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5">
                                <i data-lucide="test-tube" class="w-3 h-3"></i> 엔진 테스트
                            </button>
                        </div>
                    </div>

                    <div class="mt-4 p-3 bg-black/20 rounded-lg border border-cyan-500/20">
                        <p class="text-xs text-slate-400">
                            <i data-lucide="info" class="w-3 h-3 inline mr-1"></i>
                            TTS 엔진은 환경변수에서 API 키를 읽어옵니다. (ELEVENLABS_API_KEY, AZURE_SPEECH_KEY)
                        </p>
                    </div>
                </div>

                <!-- Google Drive -->
                <div class="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-6">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="p-3 bg-green-500/20 rounded-xl text-green-400">
                            <i data-lucide="hard-drive" class="w-6 h-6"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-white">Google Drive 연동</h2>
                            <p class="text-sm text-slate-400">클라우드 저장 및 동기화</p>
                        </div>
                    </div>

                    <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                        <button id="btn-connect-drive" class="w-full bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2">
                            <i data-lucide="cloud" class="w-5 h-5"></i> Google Drive 연결
                        </button>
                        <div id="drive-status" class="mt-3 text-xs text-slate-500 text-center">
                            연결되지 않음
                        </div>
                    </div>
                </div>

                <!-- Cache Statistics -->
                <div class="bg-gradient-to-r from-purple-900/30 to-violet-900/30 border border-purple-500/30 rounded-2xl p-6">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="p-3 bg-purple-500/20 rounded-xl text-purple-400">
                            <i data-lucide="database" class="w-6 h-6"></i>
                        </div>
                        <div class="flex-1">
                            <h2 class="text-xl font-bold text-white">캐시 관리</h2>
                            <p class="text-sm text-slate-400">API 응답 캐싱으로 성능 향상</p>
                        </div>
                        <button id="btn-clear-cache" class="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="trash-2" class="w-4 h-4"></i> 캐시 비우기
                        </button>
                    </div>

                    <div class="grid grid-cols-4 gap-4" id="cache-stats-container">
                        <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-bold text-slate-400 uppercase">Image</span>
                                <i data-lucide="image" class="w-4 h-4 text-indigo-400"></i>
                            </div>
                            <div class="text-2xl font-black text-white" id="cache-image-active">-</div>
                            <div class="text-xs text-slate-500 mt-1">활성 항목</div>
                        </div>

                        <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-bold text-slate-400 uppercase">Motion</span>
                                <i data-lucide="video" class="w-4 h-4 text-purple-400"></i>
                            </div>
                            <div class="text-2xl font-black text-white" id="cache-motion-active">-</div>
                            <div class="text-xs text-slate-500 mt-1">활성 항목</div>
                        </div>

                        <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-bold text-slate-400 uppercase">TTS</span>
                                <i data-lucide="mic-2" class="w-4 h-4 text-cyan-400"></i>
                            </div>
                            <div class="text-2xl font-black text-white" id="cache-tts-active">-</div>
                            <div class="text-xs text-slate-500 mt-1">활성 항목</div>
                        </div>

                        <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-bold text-slate-400 uppercase">AI</span>
                                <i data-lucide="brain" class="w-4 h-4 text-blue-400"></i>
                            </div>
                            <div class="text-2xl font-black text-white" id="cache-ai-active">-</div>
                            <div class="text-xs text-slate-500 mt-1">활성 항목</div>
                        </div>
                    </div>

                    <div class="mt-4 p-3 bg-black/20 rounded-lg border border-purple-500/20">
                        <p class="text-xs text-slate-400">
                            <i data-lucide="info" class="w-3 h-3 inline mr-1"></i>
                            <strong class="text-purple-400">캐시 정책:</strong> Image (1시간), Motion (2시간), TTS (30분), AI (1시간). 동일한 요청시 캐시된 결과를 즉시 반환하여 API 호출을 절약합니다.
                        </p>
                    </div>
                </div>

                <!-- Save/Reset -->
                <div class="flex gap-3">
                    <button id="btn-save-settings" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2">
                        <i data-lucide="save" class="w-5 h-5"></i> 설정 저장
                    </button>
                    <button id="btn-reset-settings" class="bg-slate-700 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2">
                        <i data-lucide="refresh-ccw" class="w-5 h-5"></i> 초기화
                    </button>
                </div>
            </div>
        `;
    }

    renderModelCard(key, model) {
        const statusColors = {
            unchecked: { bg: 'bg-slate-800', text: 'text-slate-400', label: '미확인' },
            valid: { bg: 'bg-green-900/50', text: 'text-green-400', label: '✓ 정상' },
            invalid: { bg: 'bg-red-900/50', text: 'text-red-400', label: '✗ 오류' }
        };

        const status = statusColors[model.status] || statusColors.unchecked;
        const isSaved = model.saved || false;

        return `
            <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                <div class="flex items-center justify-between mb-3">
                    <div>
                        <h3 class="text-sm font-bold text-white">${model.name}</h3>
                        <p class="text-xs text-slate-500">${model.provider}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${isSaved ? '<span class="text-[9px] px-1.5 py-0.5 bg-blue-900/50 text-blue-400 rounded font-bold">저장됨</span>' : ''}
                        <span class="${status.bg} ${status.text} text-xs px-2 py-1 rounded font-bold">${status.label}</span>
                    </div>
                </div>
                <input type="password" id="api-key-${key}"
                    class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono mb-2"
                    placeholder="API Key"
                    value="${model.apiKey || ''}">
                <div class="flex gap-2">
                    <button class="btn-test-model flex-1 bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                        data-model="${key}">
                        <i data-lucide="test-tube" class="w-3 h-3"></i> 테스트
                    </button>
                    <button class="btn-save-key hidden flex-1 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                        id="btn-save-key-${key}" data-model="${key}">
                        <i data-lucide="save" class="w-3 h-3"></i> 저장
                    </button>
                </div>
            </div>
        `;
    }

    onMount() {
        // Setup guide button
        this.setupGuideButton();

        // AI Model Test Buttons
        document.querySelectorAll('.btn-test-model').forEach(btn => {
            btn.addEventListener('click', async () => {
                const modelKey = btn.getAttribute('data-model');
                await this.testAIModel(modelKey, btn);
            });
        });

        // AI Model Save Buttons
        document.querySelectorAll('.btn-save-key').forEach(btn => {
            btn.addEventListener('click', async () => {
                const modelKey = btn.getAttribute('data-model');
                await this.saveAPIKey(modelKey, 'ai', btn);
            });
        });

        // YouTube API Test
        const btnTestYoutube = document.getElementById('btn-test-youtube');
        if (btnTestYoutube) {
            btnTestYoutube.addEventListener('click', async () => {
                await this.testYouTubeAPI(btnTestYoutube);
            });
        }

        // YouTube API Save
        const btnSaveYoutube = document.getElementById('btn-save-youtube');
        if (btnSaveYoutube) {
            btnSaveYoutube.addEventListener('click', async () => {
                await this.saveYouTubeKey(btnSaveYoutube);
            });
        }

        // TTS Engine Tests
        const btnTestElevenLabs = document.getElementById('btn-test-elevenlabs');
        if (btnTestElevenLabs) {
            btnTestElevenLabs.addEventListener('click', async () => {
                await this.testTTSEngine('elevenlabs', btnTestElevenLabs);
            });
        }

        const btnTestAzure = document.getElementById('btn-test-azure');
        if (btnTestAzure) {
            btnTestAzure.addEventListener('click', async () => {
                await this.testTTSEngine('azure', btnTestAzure);
            });
        }

        // Google Drive Connection
        const btnConnectDrive = document.getElementById('btn-connect-drive');
        if (btnConnectDrive) {
            btnConnectDrive.addEventListener('click', () => {
                this.connectGoogleDrive();
            });
        }

        // Save Settings
        const btnSave = document.getElementById('btn-save-settings');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                this.saveSettings();
                alert('✅ 설정이 저장되었습니다.');
            });
        }

        // Reset Settings
        const btnReset = document.getElementById('btn-reset-settings');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (confirm('모든 설정을 초기화하시겠습니까?')) {
                    localStorage.removeItem('app_settings');
                    location.reload();
                }
            });
        }

        // Cache management
        const btnClearCache = document.getElementById('btn-clear-cache');
        if (btnClearCache) {
            btnClearCache.addEventListener('click', () => {
                if (confirm('모든 캐시를 삭제하시겠습니까?\n\n삭제 후에는 API 호출이 다시 발생합니다.')) {
                    clearAllCaches();
                    this.updateCacheStats();
                    alert('✅ 모든 캐시가 삭제되었습니다.');
                }
            });
        }

        // Update cache stats initially and every 5 seconds
        this.updateCacheStats();
        this.cacheStatsInterval = setInterval(() => {
            this.updateCacheStats();
        }, 5000);

        // Google Drive 상태 확인
        this.checkGoogleDriveStatus();

        lucide.createIcons();
    }

    async checkGoogleDriveStatus() {
        try {
            const response = await fetch(CONFIG.endpoints.googleDriveStatus);
            const status = await response.json();

            const statusDiv = document.getElementById('drive-status');
            const connectBtn = document.getElementById('btn-connect-drive');

            if (status.authenticated) {
                statusDiv.className = 'mt-3 text-xs text-green-400 font-bold text-center';
                statusDiv.textContent = '✓ 연결됨';
                connectBtn.textContent = '연결 완료';
                connectBtn.disabled = true;
                connectBtn.className = 'w-full bg-slate-700 text-slate-400 px-4 py-3 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 cursor-not-allowed';
            } else {
                statusDiv.className = 'mt-3 text-xs text-slate-500 text-center';
                statusDiv.textContent = '연결되지 않음';
            }
        } catch (e) {
            console.error('Google Drive 상태 확인 실패:', e);
        }
    }

    async testAIModel(modelKey, btn) {
        const input = document.getElementById(`api-key-${modelKey}`);
        const apiKey = input.value.trim();

        if (!apiKey) {
            return alert('API 키를 입력해주세요.');
        }

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> 테스트 중`;
        lucide.createIcons();

        try {
            // Backend API 호출
            const response = await fetch(CONFIG.endpoints.testAiModel, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelKey,
                    apiKey: apiKey
                })
            });

            const result = await response.json();

            if (result.success) {
                this.aiModels[modelKey].status = 'valid';
                this.aiModels[modelKey].apiKey = apiKey;  // 임시 저장

                // 저장 버튼 표시
                const saveBtn = document.getElementById(`btn-save-key-${modelKey}`);
                if (saveBtn) saveBtn.classList.remove('hidden');

                alert(`✅ ${this.aiModels[modelKey].name} API 키가 유효합니다!\n\n"저장" 버튼을 눌러 영구 저장하세요.`);
            } else {
                this.aiModels[modelKey].status = 'invalid';
                alert(`❌ API 키 오류: ${result.error}`);
            }

            this.refreshModule();
        } catch (e) {
            console.error(e);
            alert(`❌ 테스트 실패: ${e.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    async testYouTubeAPI(btn) {
        const input = document.getElementById('youtube-api-key');
        const apiKey = input.value.trim();

        if (!apiKey) {
            return alert('YouTube API 키를 입력해주세요.');
        }

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 테스트 중`;
        lucide.createIcons();

        try {
            // Simple quota test - search for a popular keyword
            const testUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${apiKey}`;
            const response = await fetch(testUrl);

            if (response.ok) {
                document.getElementById('youtube-status').className = 'ml-auto text-xs px-2 py-1 rounded bg-green-900/50 text-green-400 font-bold';
                document.getElementById('youtube-status').textContent = '✓ 정상';

                // 저장 버튼 표시
                const saveBtn = document.getElementById('btn-save-youtube');
                if (saveBtn) saveBtn.classList.remove('hidden');

                alert('✅ YouTube API 키가 유효합니다!\n\n"저장" 버튼을 눌러 영구 저장하세요.');
            } else {
                throw new Error(`API 오류: ${response.status}`);
            }
        } catch (e) {
            console.error(e);
            document.getElementById('youtube-status').className = 'ml-auto text-xs px-2 py-1 rounded bg-red-900/50 text-red-400 font-bold';
            document.getElementById('youtube-status').textContent = '✗ 오류';
            alert(`❌ YouTube API 테스트 실패: ${e.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    async saveYouTubeKey(btn) {
        const input = document.getElementById('youtube-api-key');
        const apiKey = input?.value.trim();

        if (!apiKey) {
            return alert('YouTube API 키를 입력해주세요.');
        }

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 저장 중`;
        lucide.createIcons();

        try {
            const response = await fetch(CONFIG.endpoints.saveYoutubeKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: apiKey })
            });

            const result = await response.json();

            if (result.success) {
                alert('✅ YouTube API 키가 저장되었습니다!');
                btn.classList.add('hidden');
            } else {
                alert(`❌ 저장 실패: ${result.error}`);
            }
        } catch (e) {
            console.error(e);
            alert(`❌ API 키 저장 실패: ${e.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    async testTTSEngine(engine, btn) {
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> 테스트 중`;
        lucide.createIcons();

        try {
            // Backend TTS validation API 호출 (URL 수정됨)
            const response = await fetch(CONFIG.endpoints.ttsValidate, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ engine: engine })
            });

            const result = await response.json();
            const statusId = engine === 'elevenlabs' ? 'elevenlabs-status' : 'azure-status';
            const statusEl = document.getElementById(statusId);

            if (result.success && result.valid) {
                statusEl.className = 'bg-green-900/50 text-green-400 text-xs px-2 py-1 rounded font-bold';
                statusEl.textContent = '✓ 정상';
                alert(`✅ ${engine === 'elevenlabs' ? 'ElevenLabs' : 'Azure TTS'} 엔진이 정상 작동합니다!`);
            } else {
                statusEl.className = 'bg-red-900/50 text-red-400 text-xs px-2 py-1 rounded font-bold';
                statusEl.textContent = '✗ 오류';
                alert(`❌ ${engine === 'elevenlabs' ? 'ElevenLabs' : 'Azure TTS'} 테스트 실패:\n${result.error || '알 수 없는 오류'}`);
            }
        } catch (e) {
            console.error(e);
            const statusId = engine === 'elevenlabs' ? 'elevenlabs-status' : 'azure-status';
            const statusEl = document.getElementById(statusId);
            statusEl.className = 'bg-red-900/50 text-red-400 text-xs px-2 py-1 rounded font-bold';
            statusEl.textContent = '✗ 오류';
            alert(`❌ TTS 엔진 테스트 실패: ${e.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    async saveAPIKey(key, type, btn) {
        const input = document.getElementById(`api-key-${key}`);
        const apiKey = input?.value.trim();

        if (!apiKey) {
            return alert('API 키를 입력해주세요.');
        }

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> 저장 중`;
        lucide.createIcons();

        try {
            // Backend에 API 키 저장 요청
            const response = await fetch(CONFIG.endpoints.saveApiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: key,
                    type: type,
                    apiKey: apiKey
                })
            });

            const result = await response.json();

            if (result.success) {
                this.aiModels[key].saved = true;
                alert(`✅ API 키가 저장되었습니다!\n\n서버가 재시작되어도 유지됩니다.`);
                btn.classList.add('hidden');  // 저장 버튼 숨김
                this.refreshModule();
            } else {
                alert(`❌ 저장 실패: ${result.error}`);
            }
        } catch (e) {
            console.error(e);
            alert(`❌ API 키 저장 실패: ${e.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    async connectGoogleDrive() {
        try {
            // Google Drive 인증 URL 가져오기
            const response = await fetch(CONFIG.endpoints.googleDriveAuthUrl);
            const result = await response.json();

            if (result.success && result.authUrl) {
                // 새 창에서 OAuth 인증 페이지 열기
                const width = 600;
                const height = 700;
                const left = (screen.width / 2) - (width / 2);
                const top = (screen.height / 2) - (height / 2);

                window.open(
                    result.authUrl,
                    'Google Drive 인증',
                    `width=${width},height=${height},left=${left},top=${top}`
                );

                alert('✅ Google 인증 창이 열렸습니다.\n\n인증 완료 후 이 페이지로 돌아와주세요.');
            } else {
                alert(`❌ Google Drive 인증 URL 생성 실패:\n${result.error || '알 수 없는 오류'}`);
            }
        } catch (e) {
            console.error(e);
            alert(`❌ Google Drive 연결 실패: ${e.message}`);
        }
    }

    updateCacheStats() {
        const stats = getAllCacheStats();

        const imageActiveEl = document.getElementById('cache-image-active');
        const motionActiveEl = document.getElementById('cache-motion-active');
        const ttsActiveEl = document.getElementById('cache-tts-active');
        const aiActiveEl = document.getElementById('cache-ai-active');

        if (imageActiveEl) imageActiveEl.textContent = stats.image.active;
        if (motionActiveEl) motionActiveEl.textContent = stats.motion.active;
        if (ttsActiveEl) ttsActiveEl.textContent = stats.tts.active;
        if (aiActiveEl) aiActiveEl.textContent = stats.ai.active;
    }

    onUnmount() {
        // Clear cache stats update interval
        if (this.cacheStatsInterval) {
            clearInterval(this.cacheStatsInterval);
            this.cacheStatsInterval = null;
        }
    }

    refreshModule() {
        if (window.app) {
            window.app.route('settings');
        }
    }
}
