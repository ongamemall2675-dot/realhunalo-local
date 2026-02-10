// ================================================================
// YOUTUBE MODULE - 유튜브 소재실
// 채널 분석, 키워드 조사, 효율성 판단, 틈새 키워드 발굴
// ================================================================

import { Module } from '../Module.js';
import { CONFIG } from '../config.js';

export class YoutubeModule extends Module {
    constructor() {
        super('youtube', '유튜브 소재실', 'youtube', 'YouTube API 기반 채널 분석 및 틈새 키워드 발굴');

        // 분석 로그 캐시
        this.analysisCache = this.loadCache();
    }

    loadCache() {
        try {
            const cache = localStorage.getItem('youtube_analysis_cache');
            return cache ? JSON.parse(cache) : {};
        } catch (e) {
            return {};
        }
    }

    saveCache() {
        try {
            localStorage.setItem('youtube_analysis_cache', JSON.stringify(this.analysisCache));
        } catch (e) {
            console.error('Failed to save cache:', e);
        }
    }

    render() {
        return `
            <div class="max-w-6xl mx-auto slide-up space-y-6">
                <!-- Tab Navigation -->
                <div class="flex gap-2 bg-slate-800/50 p-2 rounded-2xl border border-slate-700">
                    <button class="tab-btn active flex-1 py-3 px-6 rounded-xl text-sm font-bold transition" data-tab="channel">
                        <i data-lucide="user" class="w-4 h-4 inline mr-2"></i> 채널 분석
                    </button>
                    <button class="tab-btn flex-1 py-3 px-6 rounded-xl text-sm font-bold transition" data-tab="keyword">
                        <i data-lucide="search" class="w-4 h-4 inline mr-2"></i> 키워드 조사
                    </button>
                    <button class="tab-btn flex-1 py-3 px-6 rounded-xl text-sm font-bold transition" data-tab="niche">
                        <i data-lucide="target" class="w-4 h-4 inline mr-2"></i> 틈새 발굴
                    </button>
                </div>

                <!-- Channel Analysis Tab -->
                <div id="tab-channel" class="tab-content">
                    <div class="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
                        <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <i data-lucide="youtube" class="w-5 h-5 text-red-400"></i>
                            채널 URL 분석
                        </h3>

                        <div class="flex gap-3 mb-4">
                            <input type="text" id="channel-url"
                                class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500"
                                placeholder="채널 URL 또는 채널 ID 입력 (예: @channelname 또는 UCxxxxxxxxx)">
                            <button id="btn-analyze-channel"
                                class="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-red-600/30 transition flex items-center gap-2">
                                <i data-lucide="activity" class="w-4 h-4"></i> 분석
                            </button>
                        </div>

                        <div id="channel-result" class="hidden mt-6"></div>
                    </div>
                </div>

                <!-- Keyword Research Tab -->
                <div id="tab-keyword" class="tab-content hidden">
                    <div class="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
                        <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <i data-lucide="search" class="w-5 h-5 text-blue-400"></i>
                            키워드 검색
                        </h3>

                        <div class="grid grid-cols-2 gap-3 mb-4">
                            <input type="text" id="keyword-search"
                                class="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500"
                                placeholder="검색 키워드 입력">
                            <select id="keyword-order"
                                class="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white">
                                <option value="relevance">관련도순</option>
                                <option value="date">최신순</option>
                                <option value="viewCount">조회수순</option>
                                <option value="rating">평점순</option>
                            </select>
                        </div>

                        <button id="btn-search-keyword"
                            class="w-full bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2">
                            <i data-lucide="search" class="w-4 h-4"></i> 키워드 조사
                        </button>

                        <div id="keyword-result" class="hidden mt-6"></div>
                    </div>
                </div>

                <!-- Niche Discovery Tab -->
                <div id="tab-niche" class="tab-content hidden">
                    <div class="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
                        <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <i data-lucide="lightbulb" class="w-5 h-5 text-yellow-400"></i>
                            AI 틈새 키워드 발굴
                        </h3>

                        <div class="mb-4">
                            <label class="block text-sm font-bold text-slate-400 mb-2">주제/분야</label>
                            <input type="text" id="niche-topic"
                                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500"
                                placeholder="예: 재테크, 요리, 게임, 운동 등">
                        </div>

                        <button id="btn-discover-niche"
                            class="w-full bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-2">
                            <i data-lucide="sparkles" class="w-4 h-4"></i> AI로 틈새 키워드 찾기
                        </button>

                        <div id="niche-result" class="hidden mt-6"></div>
                    </div>
                </div>

                <!-- Analysis Log -->
                <div class="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-sm font-bold text-slate-400 flex items-center gap-2">
                            <i data-lucide="history" class="w-4 h-4"></i> 분석 로그 (캐시된 결과)
                        </h3>
                        <button id="btn-clear-cache" class="bg-slate-700 hover:bg-red-600 text-slate-300 px-3 py-1 rounded-lg text-xs font-bold transition">
                            캐시 지우기
                        </button>
                    </div>
                    <div id="cache-list" class="text-xs text-slate-500">
                        ${this.renderCacheList()}
                    </div>
                </div>
            </div>
        `;
    }

    renderCacheList() {
        const entries = Object.entries(this.analysisCache);
        if (entries.length === 0) {
            return '<p class="text-center py-4">저장된 분석 결과가 없습니다.</p>';
        }

        return `
            <div class="space-y-2">
                ${entries.map(([key, data]) => `
                    <div class="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg">
                        <div>
                            <span class="font-mono text-slate-300">${key}</span>
                            <span class="text-slate-600 ml-2">${new Date(data.timestamp).toLocaleString('ko-KR')}</span>
                        </div>
                        <span class="text-green-400 text-xs">✓ 캐시됨</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    onMount() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });

        // Channel analysis
        const btnAnalyzeChannel = document.getElementById('btn-analyze-channel');
        const channelUrlInput = document.getElementById('channel-url');

        if (btnAnalyzeChannel) {
            btnAnalyzeChannel.addEventListener('click', () => this.analyzeChannel());
        }

        if (channelUrlInput) {
            channelUrlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.analyzeChannel();
            });
        }

        // Keyword search
        const btnSearchKeyword = document.getElementById('btn-search-keyword');
        const keywordInput = document.getElementById('keyword-search');

        if (btnSearchKeyword) {
            btnSearchKeyword.addEventListener('click', () => this.searchKeyword());
        }

        if (keywordInput) {
            keywordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchKeyword();
            });
        }

        // Niche discovery
        const btnDiscoverNiche = document.getElementById('btn-discover-niche');
        if (btnDiscoverNiche) {
            btnDiscoverNiche.addEventListener('click', () => this.discoverNiche());
        }

        // Clear cache
        const btnClearCache = document.getElementById('btn-clear-cache');
        if (btnClearCache) {
            btnClearCache.addEventListener('click', () => {
                if (confirm('모든 분석 로그를 삭제하시겠습니까?')) {
                    this.analysisCache = {};
                    this.saveCache();
                    this.refreshModule();
                }
            });
        }

        lucide.createIcons();
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active', 'bg-blue-600', 'text-white');
                btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('active', 'bg-blue-600', 'text-white');
                btn.classList.add('text-slate-400');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            const contentId = content.id.replace('tab-', '');
            if (contentId === tabName) {
                content.classList.remove('hidden');
            } else {
                content.classList.add('hidden');
            }
        });

        lucide.createIcons();
    }

    async analyzeChannel() {
        const input = document.getElementById('channel-url');
        const result = document.getElementById('channel-result');
        const btn = document.getElementById('btn-analyze-channel');

        let channelInput = input.value.trim();
        if (!channelInput) {
            return alert('채널 URL 또는 ID를 입력해주세요.');
        }

        // Extract channel ID from URL
        const channelId = this.extractChannelId(channelInput);

        // Check cache
        const cacheKey = `channel_${channelId}`;
        if (this.analysisCache[cacheKey] && Date.now() - this.analysisCache[cacheKey].timestamp < 3600000) {
            console.log('✅ Using cached data for', channelId);
            this.renderChannelResult(this.analysisCache[cacheKey].data);
            return;
        }

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 분석 중`;
        lucide.createIcons();

        try {
            const response = await fetch('http://localhost:8000/api/youtube/analyze-channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || '채널 분석 실패');
            }

            // Cache result
            this.analysisCache[cacheKey] = {
                data: data,
                timestamp: Date.now()
            };
            this.saveCache();

            this.renderChannelResult(data);

        } catch (e) {
            console.error(e);
            result.innerHTML = `
                <div class="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-center">
                    <i data-lucide="alert-circle" class="w-8 h-8 text-red-400 mx-auto mb-2"></i>
                    <p class="text-red-400 font-bold">분석 실패</p>
                    <p class="text-sm text-slate-400 mt-1">${e.message}</p>
                </div>
            `;
            result.classList.remove('hidden');
            lucide.createIcons();
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    extractChannelId(input) {
        // Handle various YouTube URL formats
        if (input.includes('youtube.com/channel/')) {
            return input.split('youtube.com/channel/')[1].split(/[?/]/)[0];
        } else if (input.includes('youtube.com/@')) {
            return input.split('@')[1].split(/[?/]/)[0];
        } else if (input.includes('youtube.com/c/')) {
            return input.split('youtube.com/c/')[1].split(/[?/]/)[0];
        } else if (input.startsWith('@')) {
            return input;
        } else if (input.startsWith('UC') && input.length === 24) {
            return input;
        }
        return input;
    }

    renderChannelResult(data) {
        const result = document.getElementById('channel-result');
        const channel = data.channel;
        const videos = data.recentVideos || [];
        const efficiency = data.efficiency || {};

        result.innerHTML = `
            <!-- Channel Info -->
            <div class="bg-gradient-to-r from-red-900/20 to-pink-900/20 border border-red-500/20 rounded-xl p-6 mb-4">
                <div class="flex items-start gap-4">
                    <img src="${channel.thumbnail}" class="w-20 h-20 rounded-full border-2 border-red-500/50">
                    <div class="flex-1">
                        <h3 class="text-xl font-bold text-white">${channel.title}</h3>
                        <p class="text-sm text-slate-400 mt-1 line-clamp-2">${channel.description || '설명 없음'}</p>
                        <div class="flex gap-4 mt-3 text-sm">
                            <span class="text-slate-300">
                                <i data-lucide="users" class="w-4 h-4 inline"></i>
                                <b class="text-red-400">${this.formatNumber(channel.subscriberCount)}</b> 구독자
                            </span>
                            <span class="text-slate-300">
                                <i data-lucide="eye" class="w-4 h-4 inline"></i>
                                <b class="text-blue-400">${this.formatNumber(channel.viewCount)}</b> 조회수
                            </span>
                            <span class="text-slate-300">
                                <i data-lucide="video" class="w-4 h-4 inline"></i>
                                <b class="text-green-400">${this.formatNumber(channel.videoCount)}</b> 영상
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Efficiency Metrics -->
            <div class="grid grid-cols-3 gap-4 mb-4">
                <div class="bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold ${this.getEfficiencyColor(efficiency.avgViewsPerSub)}">${efficiency.avgViewsPerSub?.toFixed(1)}%</div>
                    <div class="text-xs text-slate-500 mt-1">조회수/구독자</div>
                </div>
                <div class="bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold ${this.getEfficiencyColor(efficiency.avgLikesPerView)}">${efficiency.avgLikesPerView?.toFixed(1)}%</div>
                    <div class="text-xs text-slate-500 mt-1">좋아요/조회수</div>
                </div>
                <div class="bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold ${this.getScoreColor(efficiency.efficiencyScore)}">${efficiency.efficiencyScore?.toFixed(0)}/100</div>
                    <div class="text-xs text-slate-500 mt-1">효율성 점수</div>
                </div>
            </div>

            <!-- Recent Videos -->
            <div class="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                <h4 class="text-sm font-bold text-white mb-3">최근 영상 (${videos.length}개)</h4>
                <div class="space-y-2 max-h-96 overflow-y-auto">
                    ${videos.map(video => this.renderVideoCard(video, channel.subscriberCount)).join('')}
                </div>
            </div>
        `;

        result.classList.remove('hidden');
        lucide.createIcons();
    }

    renderVideoCard(video, subscriberCount) {
        const viewsPerSub = ((video.viewCount / subscriberCount) * 100).toFixed(1);
        const likesPerView = ((video.likeCount / video.viewCount) * 100).toFixed(1);

        return `
            <div class="flex gap-3 bg-slate-800/50 p-3 rounded-lg hover:bg-slate-800 transition">
                <img src="${video.thumbnail}" class="w-32 h-20 rounded object-cover flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <h5 class="text-sm font-bold text-white line-clamp-2">${video.title}</h5>
                    <div class="flex gap-3 mt-2 text-xs text-slate-400">
                        <span><i data-lucide="eye" class="w-3 h-3 inline"></i> ${this.formatNumber(video.viewCount)}</span>
                        <span><i data-lucide="thumbs-up" class="w-3 h-3 inline"></i> ${this.formatNumber(video.likeCount)}</span>
                        <span><i data-lucide="message-circle" class="w-3 h-3 inline"></i> ${this.formatNumber(video.commentCount)}</span>
                    </div>
                    <div class="flex gap-2 mt-1">
                        <span class="text-[10px] px-2 py-0.5 rounded ${this.getEfficiencyBadgeColor(parseFloat(viewsPerSub))}">${viewsPerSub}% 도달률</span>
                        <span class="text-[10px] px-2 py-0.5 rounded ${this.getEfficiencyBadgeColor(parseFloat(likesPerView))}">${likesPerView}% 참여율</span>
                    </div>
                </div>
            </div>
        `;
    }

    async searchKeyword() {
        const keywordInput = document.getElementById('keyword-search');
        const orderSelect = document.getElementById('keyword-order');
        const result = document.getElementById('keyword-result');
        const btn = document.getElementById('btn-search-keyword');

        const keyword = keywordInput.value.trim();
        const order = orderSelect.value;

        if (!keyword) {
            return alert('검색 키워드를 입력해주세요.');
        }

        const cacheKey = `keyword_${keyword}_${order}`;
        if (this.analysisCache[cacheKey] && Date.now() - this.analysisCache[cacheKey].timestamp < 1800000) {
            console.log('✅ Using cached data for keyword:', keyword);
            this.renderKeywordResult(this.analysisCache[cacheKey].data);
            return;
        }

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 검색 중`;
        lucide.createIcons();

        try {
            const response = await fetch('http://localhost:8000/api/youtube/search-keyword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, order, maxResults: 20 })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || '검색 실패');
            }

            this.analysisCache[cacheKey] = {
                data: data,
                timestamp: Date.now()
            };
            this.saveCache();

            this.renderKeywordResult(data);

        } catch (e) {
            console.error(e);
            alert(`키워드 검색 실패: ${e.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    renderKeywordResult(data) {
        const result = document.getElementById('keyword-result');
        const videos = data.videos || [];

        result.innerHTML = `
            <div class="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                <h4 class="text-sm font-bold text-white mb-3">검색 결과 (${videos.length}개)</h4>
                <div class="space-y-2 max-h-[500px] overflow-y-auto">
                    ${videos.map(video => `
                        <div class="flex gap-3 bg-slate-800/50 p-3 rounded-lg hover:bg-slate-800 transition">
                            <img src="${video.thumbnail}" class="w-40 h-24 rounded object-cover flex-shrink-0">
                            <div class="flex-1">
                                <h5 class="text-sm font-bold text-white line-clamp-2">${video.title}</h5>
                                <p class="text-xs text-slate-500 mt-1">${video.channelTitle}</p>
                                <div class="flex gap-3 mt-2 text-xs text-slate-400">
                                    <span><i data-lucide="eye" class="w-3 h-3 inline"></i> ${this.formatNumber(video.viewCount)}</span>
                                    <span><i data-lucide="calendar" class="w-3 h-3 inline"></i> ${video.publishedAt}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        result.classList.remove('hidden');
        lucide.createIcons();
    }

    async discoverNiche() {
        const topicInput = document.getElementById('niche-topic');
        const result = document.getElementById('niche-result');
        const btn = document.getElementById('btn-discover-niche');

        const topic = topicInput.value.trim();

        if (!topic) {
            return alert('주제를 입력해주세요.');
        }

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> AI 분석 중`;
        lucide.createIcons();

        try {
            const response = await fetch('http://localhost:8000/api/youtube/discover-niche', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || '틈새 발굴 실패');
            }

            result.innerHTML = `
                <div class="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-xl p-6">
                    <h4 class="text-lg font-bold text-white mb-4">
                        <i data-lucide="target" class="w-5 h-5 inline mr-2 text-purple-400"></i>
                        "${topic}" 틈새 키워드 추천
                    </h4>
                    <div class="grid grid-cols-2 gap-3">
                        ${(data.keywords || []).map(kw => `
                            <div class="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-purple-500/50 transition cursor-pointer"
                                 onclick="document.getElementById('keyword-search').value='${kw}'; window.app.route('youtube'); setTimeout(() => document.querySelector('[data-tab=keyword]').click(), 100);">
                                <div class="flex items-center gap-2">
                                    <i data-lucide="chevron-right" class="w-4 h-4 text-purple-400"></i>
                                    <span class="text-sm font-bold text-white">${kw}</span>
                                </div>
                                <p class="text-xs text-slate-500 mt-1">클릭하여 검색</p>
                            </div>
                        `).join('')}
                    </div>
                    ${data.analysis ? `
                        <div class="mt-4 p-4 bg-black/20 rounded-lg border border-purple-500/20">
                            <p class="text-xs text-slate-300 leading-relaxed">${data.analysis}</p>
                        </div>
                    ` : ''}
                </div>
            `;

            result.classList.remove('hidden');
            lucide.createIcons();

        } catch (e) {
            console.error(e);
            alert(`틈새 발굴 실패: ${e.message}\n\n설정에서 AI API 키를 확인하세요.`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num?.toString() || '0';
    }

    getEfficiencyColor(value) {
        if (!value) return 'text-slate-400';
        if (value >= 10) return 'text-green-400';
        if (value >= 5) return 'text-yellow-400';
        return 'text-red-400';
    }

    getScoreColor(score) {
        if (!score) return 'text-slate-400';
        if (score >= 70) return 'text-green-400';
        if (score >= 40) return 'text-yellow-400';
        return 'text-red-400';
    }

    getEfficiencyBadgeColor(value) {
        if (value >= 10) return 'bg-green-900/50 text-green-400 border border-green-500/30';
        if (value >= 5) return 'bg-yellow-900/50 text-yellow-400 border border-yellow-500/30';
        return 'bg-red-900/50 text-red-400 border border-red-500/30';
    }

    refreshModule() {
        if (window.app) {
            window.app.route('youtube');
        }
    }
}
