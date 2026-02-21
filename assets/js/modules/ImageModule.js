import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG } from '../config.js';
import { processInBatches } from '../utils.js';
import { imageCache } from '../cache.js';
import { STYLE_CATEGORIES } from '../constants/ImageConstants.js';
import { ImageApi } from '../api/ImageApi.js';
import { ImageUI } from '../components/ImageUI.js';

export class ImageModule extends Module {
    constructor() {
        super('image', '미술 작업실', 'palette', '분석된 장면을 시각화합니다.');

        // 이미지 생성 설정
        this.imageSettings = {
            model: 'black-forest-labs/flux-schnell',
            aspectRatio: '16:9',
            numOutputs: 1,
            outputQuality: 90,
            style: 'stickman'
        };

        // 레퍼런스 이미지 - localStorage에서 로드
        this.referenceImages = this.loadReferenceImages();

        // 화풍 카테고리
        this.styleCategories = STYLE_CATEGORIES;

        // 클라이언트 사이드 통계
        this.stats = {
            totalGenerated: 0,
            successCount: 0,
            errorCount: 0,
            totalProcessingTime: 0
        };

        this.startTime = null;
    }

    render() {
        return ImageUI.render(AppState.getScenes(), this.stats, this.imageSettings, this.styleCategories);
    }

    onMount() {
        const self = this;

        // Reset button
        const btnResetImage = document.getElementById('btn-reset-image');
        if (btnResetImage) {
            btnResetImage.addEventListener('click', () => {
                if (confirm('⚠️ 모든 작업 내용이 삭제됩니다.\n\n정말 초기화하시겠습니까?')) {
                    AppState.startNewProject();
                    location.reload();
                }
            });
        }

        // Settings event listeners
        ['image-model', 'image-aspect-ratio', 'image-num-outputs', 'image-quality', 'image-style'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.updateSettings());
            }
        });

        // Style selector - show/hide style info
        const styleSelector = document.getElementById('image-style');
        if (styleSelector) {
            styleSelector.addEventListener('change', (e) => {
                const styleInfo = document.getElementById('style-info');
                const styleNamePreview = document.getElementById('style-name-preview');
                const styleDescPreview = document.getElementById('style-desc-preview');
                const stylePromptPreview = document.getElementById('style-prompt-preview');
                const selectedStyle = e.target.value;

                if (selectedStyle === 'none') {
                    styleInfo.classList.add('hidden');
                } else {
                    styleInfo.classList.remove('hidden');
                    const style = this.styleCategories[selectedStyle];
                    if (style) {
                        styleNamePreview.textContent = style.name;
                        styleDescPreview.textContent = style.description;
                        stylePromptPreview.textContent = style.prompt;
                    }
                }

                this.updateSettings();
            });
        }

        // Stats toggle
        const btnToggleStats = document.getElementById('btn-toggle-stats');
        if (btnToggleStats) {
            btnToggleStats.addEventListener('click', () => this.toggleStats());
        }

        // Clear Cache Button
        const btnClearCache = document.getElementById('btn-clear-cache');
        if (btnClearCache) {
            btnClearCache.addEventListener('click', () => {
                if (confirm('이미지 캐시를 모두 비우시겠습니까?')) {
                    imageCache.clear();
                    alert('캐시가 삭제되었습니다.');
                }
            });
        }

        // 마스터 캐릭터
        const masterCharSection = document.getElementById('master-character-section');
        if (masterCharSection) {
            masterCharSection.addEventListener('click', (e) => {
                const generateBtn = e.target.closest('.btn-generate-master-ref');
                if (generateBtn) {
                    const idx = generateBtn.getAttribute('data-char-idx');
                    this.generateMasterCharImage(idx, generateBtn);
                }

                const applyBtn = e.target.closest('.btn-apply-subject-ref');
                if (applyBtn) {
                    const idx = applyBtn.getAttribute('data-char-idx');
                    this.applyMasterCharToSubjectRef(idx);
                }

                const downloadBtn = e.target.closest('.btn-download-master-char');
                if (downloadBtn) {
                    const idx = downloadBtn.getAttribute('data-char-idx');
                    this.downloadMasterCharImage(idx);
                }
            });
        }

        // 레퍼런스 업로드
        this.setupReferenceImageUpload('subject');
        this.setupReferenceImageUpload('scene');
        this.setupReferenceImageUpload('style');
        this.restoreReferenceImagesUI();

        // Standalone image generation
        const btnStandaloneGen = document.getElementById('btn-standalone-generate-image');
        if (btnStandaloneGen) {
            btnStandaloneGen.addEventListener('click', async () => {
                const promptInput = document.getElementById('standalone-image-prompt');
                const prompt = promptInput?.value.trim();

                if (!prompt) return alert('이미지 프롬프트를 입력해주세요.');

                btnStandaloneGen.disabled = true;
                const originalText = btnStandaloneGen.innerHTML;
                const startTime = Date.now();
                btnStandaloneGen.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 생성 중...`;
                if (window.lucide) window.lucide.createIcons();

                try {
                    const styledPrompt = this.applyStyleToPrompt(prompt);
                    const result = await ImageApi.generateImage(styledPrompt, this.imageSettings);
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

                    if (result.success && result.imageUrl) {
                        const imageResult = document.getElementById('standalone-image-result');
                        const imagePreview = document.getElementById('standalone-image-preview');
                        const imageInfo = document.getElementById('standalone-image-info');
                        const btnDownload = document.getElementById('btn-standalone-download-image');

                        imageResult.classList.remove('hidden');
                        imagePreview.src = result.imageUrl;
                        imageInfo.textContent = `모델: ${result.model || 'unknown'} · ${elapsed}초`;

                        btnDownload.onclick = () => {
                            const link = document.createElement('a');
                            link.href = result.imageUrl;
                            link.download = `standalone_image_${Date.now()}.png`;
                            link.click();
                        };

                        if (window.lucide) window.lucide.createIcons();
                    } else {
                        throw new Error(result.error || '이미지 생성 실패');
                    }
                } catch (e) {
                    console.error(e);
                    alert(`❌ 이미지 생성 실패\n\n${e.message}`);
                } finally {
                    btnStandaloneGen.disabled = false;
                    btnStandaloneGen.innerHTML = originalText;
                    if (window.lucide) window.lucide.createIcons();
                }
            });
        }

        // Manual scene add
        const btnAddManual = document.getElementById('btn-add-manual-scene');
        if (btnAddManual) {
            btnAddManual.addEventListener('click', () => {
                const scriptInput = document.getElementById('manual-scene-script');
                const promptInput = document.getElementById('manual-scene-prompt');

                const script = scriptInput?.value.trim();
                if (!script) return alert('대본을 입력해주세요.');

                const prompt = promptInput?.value.trim();
                const currentScenes = AppState.getScenes();
                const newId = currentScenes.length > 0 ? Math.max(...currentScenes.map(s => s.sceneId)) + 1 : 1;

                const newScene = {
                    sceneId: newId,
                    originalScript: script,
                    scriptForTTS: script,
                    imagePrompt: prompt || '',
                    motionPrompt: '',
                    generatedUrl: null,
                    videoUrl: null,
                    audioUrl: null,
                    srtData: null
                };

                AppState.setScenes([...currentScenes, newScene]);
                scriptInput.value = '';
                promptInput.value = '';
                alert(`장면 #${newId}이 추가되었습니다.`);

                if (window.app) window.app.route('image');
            });
        }

        // Script/prompt sync
        document.querySelectorAll('.scene-script-edit').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                const sceneId = e.target.getAttribute('data-scene-id');
                const scene = AppState.getScenes().find(s => s.sceneId == sceneId);
                if (scene) {
                    scene.originalScript = e.target.value;
                    scene.scriptForTTS = e.target.value;
                }
            });
        });

        document.querySelectorAll('.scene-prompt-edit').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                const sceneId = e.target.getAttribute('data-scene-id');
                const scene = AppState.getScenes().find(s => s.sceneId == sceneId);
                if (scene) scene.imagePrompt = e.target.value;
            });
        });

        document.querySelectorAll('.scene-motion-prompt-edit').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                const sceneId = e.target.getAttribute('data-scene-id');
                const scene = AppState.getScenes().find(s => s.sceneId == sceneId);
                if (scene) scene.motionPrompt = e.target.value;
            });
        });

        // Delete scene
        document.querySelectorAll('.btn-delete-scene').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = parseInt(btn.getAttribute('data-id'));
                if (!confirm(`장면 #${sceneId}을 삭제하시겠습니까?`)) return;

                const currentScenes = AppState.getScenes();
                const updatedScenes = currentScenes.filter(s => s.sceneId !== sceneId);
                AppState.setScenes(updatedScenes);

                if (window.app) window.app.route('image');
            });
        });

        // Generate single image Core
        const generateItem = async (btn, attemptNum = 1, maxAttempts = 1, bypassCache = false) => {
            const sceneId = btn.getAttribute('data-id');
            const scenes = AppState.getScenes();
            const scene = scenes.find(s => s.sceneId == sceneId);
            const img = document.getElementById(`img-${sceneId}`);
            const placeholder = img.parentElement.querySelector('.image-placeholder');
            const loading = img.parentElement.querySelector('.loading-overlay');
            const downBtn = document.getElementById(`btn-down-${sceneId}`);

            btn.disabled = true;
            const attemptText = maxAttempts > 1 ? ` (${attemptNum}/${maxAttempts})` : '';
            btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> 생성 중${attemptText}`;
            loading.classList.remove('hidden');
            if (window.lucide) window.lucide.createIcons();

            const startTime = Date.now();

            try {
                const result = {};
                let fromCache = false;

                const cacheKey = imageCache.generateKey('image', {
                    prompt: scene.imagePrompt,
                    model: this.imageSettings.model,
                    aspectRatio: this.imageSettings.aspectRatio
                });

                const cachedResult = bypassCache ? null : imageCache.get(cacheKey);

                if (cachedResult) {
                    Object.assign(result, cachedResult);
                    fromCache = true;
                    console.log(`📦 Using cached image for scene #${sceneId}`);
                } else {
                    const styledPrompt = this.applyStyleToPrompt(scene.imagePrompt);
                    const referenceImages = {};
                    if (this.referenceImages.subject) referenceImages.subject = this.referenceImages.subject;
                    if (this.referenceImages.scene) referenceImages.scene = this.referenceImages.scene;
                    if (this.referenceImages.style) referenceImages.style = this.referenceImages.style;

                    const apiResult = await ImageApi.generateImage(styledPrompt, this.imageSettings, referenceImages);
                    Object.assign(result, apiResult);

                    if (result.imageUrl) {
                        imageCache.set(cacheKey, result);
                    }
                }

                if (result.imageUrl) {
                    img.src = result.imageUrl;
                    img.classList.remove('hidden');
                    placeholder.classList.add('hidden');
                    downBtn.classList.remove('hidden');
                    scene.generatedUrl = result.imageUrl;
                    scene.imageError = null;

                    AppState.setScenes([...scenes]);

                    const elapsed = fromCache ? '0.0' : (result.processingTime || ((Date.now() - startTime) / 1000).toFixed(1));
                    const displayElapsed = fromCache ? `${elapsed}s (cached)` : `${elapsed}s`;

                    this.stats.totalGenerated++;
                    this.stats.successCount++;
                    if (!fromCache) {
                        this.stats.totalProcessingTime += parseFloat(elapsed);
                    }
                    this.updateStatsUI();

                    const originalHTML = btn.innerHTML;
                    const icon = fromCache ? 'database' : 'check-circle';
                    btn.innerHTML = `<i data-lucide="${icon}" class="w-3.5 h-3.5"></i> ${displayElapsed}`;
                    btn.classList.add(fromCache ? 'bg-cyan-600' : 'bg-green-600');
                    btn.classList.remove('bg-indigo-600');
                    if (window.lucide) window.lucide.createIcons();

                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.classList.remove('bg-green-600', 'bg-cyan-600');
                        btn.classList.add('bg-indigo-600');
                        if (window.lucide) window.lucide.createIcons();
                    }, 2000);

                    return { success: true };
                } else {
                    throw new Error("No image URL in response");
                }

            } catch (e) {
                console.error(`[Scene #${sceneId}] Attempt ${attemptNum}/${maxAttempts} failed:`, e.message);
                const errorMessage = e.message || '알 수 없는 오류';
                scene.imageError = errorMessage;

                AppState.setScenes([...scenes]);

                const isNetworkError = e.message && (
                    e.message.includes('Failed to fetch') ||
                    e.message.includes('NetworkError') ||
                    e.message.includes('timeout')
                );

                return {
                    success: false,
                    error: errorMessage,
                    retryable: isNetworkError
                };
            } finally {
                loading.classList.add('hidden');
            }
        };

        const generateItemWithRetry = async (btn, maxAttempts = 3, bypassCache = false) => {
            const sceneId = btn.getAttribute('data-id');
            let lastError = null;
            let isRetryable = true;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const result = await generateItem(btn, attempt, maxAttempts, bypassCache);

                if (result.success) {
                    btn.disabled = false;
                    btn.innerHTML = `<i data-lucide="wand-2" class="w-3.5 h-3.5"></i> 생성`;
                    if (window.lucide) window.lucide.createIcons();
                    return { success: true };
                }

                lastError = result.error;
                isRetryable = result.retryable !== false;

                if (!isRetryable) break;

                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            const failedScenes = AppState.getScenes();
            const scene = failedScenes.find(s => s.sceneId == sceneId);
            if (scene) {
                scene.imageError = lastError;
                AppState.setScenes([...failedScenes]);
            }

            btn.disabled = false;
            btn.classList.remove('bg-indigo-600');
            btn.classList.add('bg-red-900');
            btn.innerHTML = `<i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> 재시도`;
            if (window.lucide) window.lucide.createIcons();

            this.stats.totalGenerated++;
            this.stats.errorCount++;
            this.updateStatsUI();

            return { success: false, error: lastError };
        };

        document.querySelectorAll('.btn-gen-image').forEach(btn => {
            btn.addEventListener('click', async () => {
                const result = await generateItemWithRetry(btn, 3, true);
                if (!result.success) {
                    let helpText = '\n\n💡 해결 방법:\n';
                    const errorLower = result.error.toLowerCase();

                    if (errorLower.includes('api 키') || errorLower.includes('인증')) {
                        helpText += '• 설정 메뉴에서 Replicate API 키를 확인하세요.\n• API 키가 유효한지 테스트해보세요.';
                    } else if (errorLower.includes('한도') || errorLower.includes('rate limit')) {
                        helpText += '• API 사용 한도가 초과되었습니다.\n• 몇 분 후 다시 시도하거나, 다른 API 키를 사용하세요.';
                    } else if (errorLower.includes('네트워크') || errorLower.includes('연결')) {
                        helpText += '• 인터넷 연결을 확인하세요.\n• VPN을 사용 중이라면 잠시 끄고 시도해보세요.';
                    } else if (errorLower.includes('timeout') || errorLower.includes('시간 초과')) {
                        helpText += '• 네트워크가 느리거나 서버가 혼잡합니다.\n• 잠시 후 다시 시도하세요.';
                    } else {
                        helpText += '• 빨간색 "재시도" 버튼을 클릭하여 다시 생성하세요.\n• 문제가 계속되면 프롬프트를 수정해보세요.';
                    }

                    alert(`❌ 이미지 생성 실패 (3회 시도)\n\n${result.error}${helpText}`);
                }
            });
        });

        // 캐릭터 라이브러리 모달 열기
        const btnOpenCharLibrary = document.getElementById('btn-open-char-library');
        if (btnOpenCharLibrary) {
            btnOpenCharLibrary.addEventListener('click', () => {
                if (window.CharacterLibrary) {
                    window.CharacterLibrary.openModal();
                } else {
                    alert('캐릭터 라이브러리 모듈을 불러올 수 없습니다.');
                }
            });
        }

        // 이미지 다운로드 (이벤트 위임 사용 - 동적 생성된 버튼 대응)
        document.body.addEventListener('click', async (e) => {
            const sceneId = btn.getAttribute('data-id');
            const scenes = AppState.getScenes();
            const scene = scenes.find(s => s.sceneId == sceneId);
            if (!scene) return;

            const isVideoMode = scene.videoUrl && scene.preferredVisual === 'video';
            const downloadUrl = isVideoMode ? scene.videoUrl : (scene.generatedUrl || document.getElementById(`img-${sceneId}`)?.src);

            if (!downloadUrl) return;

            let safeScript = 'asset';
            if (scene.originalScript) {
                safeScript = scene.originalScript
                    .replace(/[/:*?"<>|\\\n]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 50);
            }

            const padId = String(sceneId).padStart(3, '0');
            const extension = isVideoMode ? 'mp4' : 'jpeg';
            const filename = `${padId}_${safeScript}.${extension}`;

            try {
                btn.disabled = true;
                const blob = await ImageApi.fetchImageBlob(downloadUrl);
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Download error:', error);
                alert(`${isVideoMode ? '영상' : '이미지'} 다운로드에 실패했습니다.`);
            } finally {
                btn.disabled = false;
            }
        });


        // 통합 프롬프트 일괄 생성
        const btnGenAllPromptsCombined = document.getElementById('btn-gen-all-prompts-combined');
        if (btnGenAllPromptsCombined) {
            btnGenAllPromptsCombined.addEventListener('click', async () => {
                const scenes = AppState.getScenes();
                if (scenes.length === 0) return alert('생성할 장면이 없습니다.');

                if (!confirm(`총 ${scenes.length}개 장면의 이미지/모션 프롬프트를 일괄 생성합니다.\n계속하시겠습니까?`)) return;

                const btn = btnGenAllPromptsCombined;
                const resetBtn = () => {
                    btn.disabled = false;
                    btn.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i> 이미지·모션 프롬프트 일괄 생성`;
                    if (window.lucide) window.lucide.createIcons();
                };

                btn.disabled = true;

                try {
                    // Phase 1: Image Prompts
                    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> [1/2] 이미지 프롬프트 생성 중...`;
                    if (window.lucide) window.lucide.createIcons();

                    const selectedStyleKey = this.imageSettings.style;
                    const styleInfo = (selectedStyleKey && selectedStyleKey !== 'none' && STYLE_CATEGORIES[selectedStyleKey])
                        ? {
                            key: selectedStyleKey,
                            name: STYLE_CATEGORIES[selectedStyleKey].name,
                            prompt: STYLE_CATEGORIES[selectedStyleKey].prompt,
                            description: STYLE_CATEGORIES[selectedStyleKey].description
                        } : null;

                    let json_profile = null;
                    const masterChars = AppState.getMasterCharacterPrompt();
                    if (Array.isArray(masterChars) && masterChars.length > 0) {
                        if (masterChars[0].json_profile) {
                            json_profile = masterChars.length === 1 ? masterChars[0].json_profile : masterChars.map(c => c.json_profile);
                        }
                    }

                    const imgTaskId = await ImageApi.generateImagePromptsBatch(
                        scenes.map(s => ({ sceneId: s.sceneId, script: s.originalScript })),
                        { ...this.imageSettings, stylePrompt: styleInfo, json_profile }
                    );

                    const imgResult = await ImageApi.pollTask(imgTaskId, (pct) => {
                        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> [1/2] 이미지 프롬프트 ${pct}%`;
                        if (window.lucide) window.lucide.createIcons();
                    });

                    (imgResult?.prompts || []).forEach(p => {
                        const scene = scenes.find(s => s.sceneId === p.sceneId);
                        if (scene) scene.imagePrompt = p.imagePrompt;
                    });
                    AppState.setScenes([...scenes]);

                    // Phase 2: Motion Prompts
                    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> [2/2] 모션 프롬프트 생성 중...`;
                    if (window.lucide) window.lucide.createIcons();

                    const motionTaskId = await ImageApi.generateMotionPromptsBatch(
                        scenes.map(s => ({ sceneId: s.sceneId, script: s.originalScript, imagePrompt: s.imagePrompt || '' }))
                    );

                    const motionResult = await ImageApi.pollTask(motionTaskId, (pct) => {
                        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> [2/2] 모션 프롬프트 ${pct}%`;
                        if (window.lucide) window.lucide.createIcons();
                    });

                    (motionResult?.prompts || []).forEach(p => {
                        const scene = scenes.find(s => s.sceneId === p.sceneId);
                        if (scene) scene.motionPrompt = p.motionPrompt;
                    });
                    AppState.setScenes([...scenes]);

                    // 결과 요약 배너를 UI에 표시 (alert 대신)
                    const imgCount = imgResult?.prompts?.length || 0;
                    const motCount = motionResult?.prompts?.length || 0;
                    const bannerEl = document.createElement('div');
                    bannerEl.className = `flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold mb-4 ${imgCount > 0 ? 'bg-green-900/30 border-green-500/40 text-green-400' : 'bg-red-900/30 border-red-500/40 text-red-400'
                        }`;
                    bannerEl.innerHTML = `
                        <i data-lucide="${imgCount > 0 ? 'check-circle' : 'alert-triangle'}" class="w-4 h-4 flex-shrink-0"></i>
                        <span>이미지 프롬프트 <b>${imgCount}/${scenes.length}자</b> | 모션 프롬프트 <b>${motCount}/${scenes.length}자</b> 완료</span>
                        <button class="ml-auto text-slate-400 hover:text-white text-xs underline" onclick="this.parentElement.remove()">닫기</button>
                    `;
                    const statusBar = document.querySelector('.flex.justify-between.items-center.bg-slate-800');
                    if (statusBar) statusBar.parentElement.insertBefore(bannerEl, statusBar);
                    if (window.lucide) window.lucide.createIcons();
                    if (window.app) window.app.route('image');
                } catch (e) {
                    console.error('프롬프트 생성 오류:', e);
                    alert(`프롬프트 생성 실패: ${e.message}`);
                } finally {
                    resetBtn();
                }
            });
        }

        // Batch generate Images
        const btnGenAll = document.getElementById('btn-gen-all');
        const runBatchGeneration = async (auto = false) => {
            const btns = Array.from(document.querySelectorAll('.btn-gen-image'));
            const total = btns.length;
            if (total === 0) return;

            if (!auto && !confirm(`총 ${total}개 이미지를 병렬 생성합니다.\n계속하시겠습니까?`)) return;

            this.showBatchProgress();
            this.startTime = Date.now();

            const progressContainer = document.getElementById('batch-progress-container');
            const progressBar = document.getElementById('batch-progress-bar');
            const progressPercent = document.getElementById('batch-progress-percent');
            const progressMessage = document.getElementById('batch-progress-message');
            const elapsedTimeEl = document.getElementById('batch-elapsed-time');

            const elapsedTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                if (elapsedTimeEl) elapsedTimeEl.textContent = `경과 시간: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            }, 1000);

            if (btnGenAll) btnGenAll.disabled = true;
            let completed = 0;
            let successCount = 0;
            let failedScenes = [];

            const updateProgress = (count, total, succeeded) => {
                completed = count;
                const percent = Math.round((count / total) * 100);
                progressBar.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                progressMessage.textContent = `${count}/${total}개 완료 (성공: ${succeeded}, 실패: ${count - succeeded})`;
            };

            updateProgress(0, total, 0);

            await processInBatches(btns, 10, async (btn) => {
                const result = await generateItemWithRetry(btn, 3);
                if (result.success) successCount++;
                else failedScenes.push({ sceneId: btn.getAttribute('data-id'), error: result.error });
                updateProgress(++completed, total, successCount);
            }, () => { });

            clearInterval(elapsedTimer);
            if (btnGenAll) btnGenAll.disabled = false;
            progressContainer.classList.add('hidden');
            if (window.lucide) window.lucide.createIcons();

            const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);

            if (failedScenes.length === 0) {
                if (!auto) alert(`✅ 일괄 생성 완료! (${successCount}/${total})`);
                else if (window.app) window.app.route('tts');
            } else {
                alert(`⚠️ 일부 실패 (${successCount}/${total} 성공)\n실패: ${failedScenes.map(f => f.sceneId).join(', ')}`);
            }
        };

        if (btnGenAll) btnGenAll.addEventListener('click', () => runBatchGeneration(false));

        if (AppState.getAutomation('image')) {
            setTimeout(() => {
                const scenes = AppState.getScenes();
                if (scenes.length > 0 && scenes.some(s => !s.generatedUrl)) runBatchGeneration(true);
            }, 1000);
        }

        // Batch download images/videos
        const btnDownAll = document.getElementById('btn-down-all');
        if (btnDownAll) {
            btnDownAll.addEventListener('click', async () => {
                const scenes = AppState.getScenes();
                const generated = scenes.filter(s => s.generatedUrl || (s.videoUrl && s.preferredVisual === 'video'));

                if (generated.length === 0) return alert("먼저 이미지나 영상을 생성/업로드해 주세요.");

                const originalText = btnDownAll.innerHTML;
                btnDownAll.disabled = true;
                btnDownAll.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 준비 중...`;
                if (window.lucide) window.lucide.createIcons();

                try {
                    for (let i = 0; i < generated.length; i++) {
                        const s = generated[i];
                        btnDownAll.innerHTML = `<i data-lucide="download" class="w-4 h-4"></i> 다운로드 중 (${i + 1}/${generated.length})`;

                        const isVideo = s.videoUrl && s.preferredVisual === 'video';
                        const downloadUrl = isVideo ? s.videoUrl : s.generatedUrl;
                        const extension = isVideo ? 'mp4' : 'jpeg';

                        const safeScript = s.originalScript ? s.originalScript.replace(/[/:*?"<>|\\\n]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 50) : 'asset';
                        const padId = String(s.sceneId).padStart(3, '0');
                        const filename = `${padId}_${safeScript}.${extension}`;

                        try {
                            const blob = await ImageApi.fetchImageBlob(downloadUrl);
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            window.URL.revokeObjectURL(url);
                        } catch (err) {
                            console.error(`[Scene ${s.sceneId}] 다운로드 실패:`, err);
                        }

                        if (i < generated.length - 1) await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    alert(`✅ 총 ${generated.length}개의 에셋이 다운로드되었습니다.`);
                } finally {
                    btnDownAll.disabled = false;
                    btnDownAll.innerHTML = originalText;
                }
            });
        }

        const btnDownImagePrompts = document.getElementById('btn-down-image-prompts');
        if (btnDownImagePrompts) {
            btnDownImagePrompts.addEventListener('click', () => {
                const scenesWithPrompts = AppState.getScenes().filter(s => s.imagePrompt);
                if (scenesWithPrompts.length === 0) return alert("이미지 프롬프트가 없습니다.");

                const style = this.imageSettings.style;
                const styleInfo = (style && style !== 'none' && this.styleCategories[style]) ? this.styleCategories[style].prompt : null;
                const masterChars = AppState.getMasterCharacterPrompt() || [];

                const exportData = {
                    stylePrompt: styleInfo,
                    masterCharacters: masterChars,
                    scenes: scenesWithPrompts.map(s => ({
                        sceneId: s.sceneId,
                        script: s.originalScript,
                        imagePrompt: s.imagePrompt
                    }))
                };

                const jsonContent = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `image_prompts_${Date.now()}.json`;
                link.click();
                URL.revokeObjectURL(url);

                alert(`✅ 프롬프트 다운로드 완료!`);
            });
        }

        const btnDownMotionPrompts = document.getElementById('btn-down-motion-prompts');
        if (btnDownMotionPrompts) {
            btnDownMotionPrompts.addEventListener('click', () => {
                const scenesWithPrompts = AppState.getScenes().filter(s => s.motionPrompt);
                if (scenesWithPrompts.length === 0) return alert("모션 프롬프트가 없습니다.");

                const exportData = {
                    metadata: {
                        projectName: AppState.projectName || 'Untitled',
                        exportedAt: new Date().toISOString(),
                        totalScenes: scenesWithPrompts.length
                    },
                    scenes: scenesWithPrompts.map(scene => ({
                        sceneId: scene.sceneId,
                        script: scene.originalScript,
                        motionPrompt: scene.motionPrompt
                    }))
                };

                const jsonContent = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `motion_prompts_${Date.now()}.json`;
                link.click();
                URL.revokeObjectURL(url);
                alert(`✅ 모션 프롬프트 JSON 다운로드 완료!`);
            });
        }

        // Bulk Upload
        const bulkMenu = document.getElementById('bulk-upload-menu');
        const btnBulkUpload = document.getElementById('btn-bulk-upload');
        if (btnBulkUpload && bulkMenu) {
            btnBulkUpload.addEventListener('click', (e) => {
                e.stopPropagation();
                bulkMenu.classList.toggle('hidden');
            });
            document.addEventListener('click', () => bulkMenu.classList.add('hidden'));
        }

        document.getElementById('btn-bulk-files')?.addEventListener('click', () => { bulkMenu.classList.add('hidden'); document.getElementById('bulk-files-input').click(); });
        document.getElementById('btn-bulk-folder')?.addEventListener('click', () => { bulkMenu.classList.add('hidden'); document.getElementById('bulk-folder-input').click(); });

        const handleBulkUpload = async (fileList) => {
            const scenes = AppState.getScenes();
            if (scenes.length === 0) return alert('장면이 없습니다.');

            const imageFiles = [...fileList].filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
            if (imageFiles.length === 0) return alert('이미지 또는 영상 파일이 없습니다.');

            imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

            const usedSceneIdx = new Set();
            const pairs = [];

            for (const file of imageFiles) {
                const nums = file.name.match(/\d+/g);
                if (!nums) continue;
                for (const numStr of nums) {
                    const n = parseInt(numStr, 10);
                    for (const idx of [n - 1, n]) {
                        if (idx >= 0 && idx < scenes.length && !usedSceneIdx.has(idx)) {
                            pairs.push({ file, scene: scenes[idx], sceneIdx: idx, method: '번호 매칭' });
                            usedSceneIdx.add(idx);
                            break;
                        }
                    }
                    if (pairs.find(p => p.file === file)) break;
                }
            }

            let seqCursor = 0;
            for (const file of imageFiles) {
                if (pairs.find(p => p.file === file)) continue;
                while (seqCursor < scenes.length && usedSceneIdx.has(seqCursor)) seqCursor++;
                if (seqCursor < scenes.length) {
                    pairs.push({ file, scene: scenes[seqCursor], sceneIdx: seqCursor, method: '순서 매칭' });
                    usedSceneIdx.add(seqCursor);
                    seqCursor++;
                }
            }

            if (pairs.length === 0) return alert('매칭된 장면이 없습니다.');
            pairs.sort((a, b) => a.sceneIdx - b.sceneIdx);

            if (!confirm(`총 ${pairs.length}개 이미지를 장면에 배정합니다.\n계속하시겠습니까?`)) return;

            btnBulkUpload.disabled = true;
            let done = 0;
            const total = pairs.length;

            const uploadErrors = [];
            for (const { file, scene } of pairs) {
                try {
                    const result = await ImageApi.uploadAsset(file);
                    if (file.type.startsWith('video/')) {
                        scene.videoUrl = result.url;
                        scene.preferredVisual = 'video';
                        scene.generatedUrl = null;
                        scene.imageError = null;
                    } else {
                        scene.generatedUrl = result.url;
                        scene.preferredVisual = 'image';
                        scene.videoUrl = null;
                        scene.imageError = null;
                    }
                } catch (e) {
                    uploadErrors.push(`${file.name}: ${e.message}`);
                }
                done++;
                btnBulkUpload.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 업로드 중 ${done}/${total}`;
                if (window.lucide) window.lucide.createIcons();
            }

            AppState.setScenes([...scenes]);
            if (window.app) window.app.route('image');

            btnBulkUpload.disabled = false;
            btnBulkUpload.innerHTML = `<i data-lucide="upload-cloud" class="w-4 h-4"></i> 이미지 일괄 업로드 <i data-lucide="chevron-down" class="w-3 h-3"></i>`;
            if (window.lucide) window.lucide.createIcons();

            const errMsg = uploadErrors.length > 0 ? `\n\n⚠️ 실패:\n${uploadErrors.join('\n')}` : '';
            alert(`✅ ${done - uploadErrors.length}개 업로드 완료!${errMsg}`);
        };

        document.getElementById('bulk-files-input')?.addEventListener('change', (e) => handleBulkUpload(e.target.files));
        document.getElementById('bulk-folder-input')?.addEventListener('change', (e) => handleBulkUpload(e.target.files));
        window._handleBulkDrop = handleBulkUpload;

        this._cleanupBulkDrag = () => {
            window._handleBulkDrop = null;
        };

        if (window.lucide) window.lucide.createIcons();
    }

    onUnmount() {
        if (this._cleanupBulkDrag) {
            this._cleanupBulkDrag();
            this._cleanupBulkDrag = null;
        }
    }

    updateSettings() {
        const model = document.getElementById('image-model')?.value;
        const aspectRatio = document.getElementById('image-aspect-ratio')?.value;
        const numOutputs = parseInt(document.getElementById('image-num-outputs')?.value || '1');
        const outputQuality = parseInt(document.getElementById('image-quality')?.value || '90');
        const style = document.getElementById('image-style')?.value || 'none';

        this.imageSettings = { model, aspectRatio, numOutputs, outputQuality, style };
        console.log('✅ Image settings updated:', this.imageSettings);
    }

    applyStyleToPrompt(originalPrompt) {
        const style = this.imageSettings.style;
        if (!style || style === 'none') return originalPrompt;
        const styleInfo = this.styleCategories[style];
        if (!styleInfo) return originalPrompt;
        return `${styleInfo.prompt}, ${originalPrompt}`;
    }

    toggleStats() {
        const statsPanel = document.getElementById('image-stats-panel');
        if (statsPanel) statsPanel.classList.toggle('hidden');
    }

    showBatchProgress() {
        const progressContainer = document.getElementById('batch-progress-container');
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
            if (window.lucide) window.lucide.createIcons();
        }
    }

    updateStatsUI() {
        document.getElementById('stat-total-generated').textContent = this.stats.totalGenerated;
        document.getElementById('stat-success-count').textContent = this.stats.successCount;
        document.getElementById('stat-error-count').textContent = this.stats.errorCount;
        const avgTime = this.stats.totalGenerated > 0 ? (this.stats.totalProcessingTime / this.stats.totalGenerated).toFixed(1) : '-';
        document.getElementById('stat-avg-time').textContent = avgTime;
    }

    setupReferenceImageUpload(type) {
        const preview = document.getElementById(`ref-${type}-preview`);
        const input = document.getElementById(`ref-${type}-input`);
        const img = document.getElementById(`ref-${type}-img`);
        const clearBtn = document.getElementById(`btn-clear-${type}`);

        if (!preview || !input || !img) return;

        const handleFile = (file) => {
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                img.src = base64;
                img.classList.remove('hidden');
                clearBtn.classList.remove('hidden');
                this.referenceImages[type] = base64;
                this.saveReferenceImages();
            };
            reader.readAsDataURL(file);
        };

        preview.addEventListener('click', (e) => { if (!e.target.closest('button')) input.click(); });
        input.addEventListener('change', (e) => handleFile(e.target.files[0]));

        preview.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); preview.classList.add('ring-2', 'ring-blue-500'); });
        preview.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
        preview.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); if (e.target === preview) preview.classList.remove('ring-2', 'ring-blue-500'); });
        preview.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation(); preview.classList.remove('ring-2', 'ring-blue-500');
            if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                img.src = '';
                img.classList.add('hidden');
                clearBtn.classList.add('hidden');
                input.value = '';
                this.referenceImages[type] = null;
                this.saveReferenceImages();
            });
        }
    }

    async generateMasterCharImage(idx, btnElement) {
        const charPrompts = AppState.getMasterCharacterPrompt();
        if (!charPrompts || !charPrompts[idx]) return alert('캐릭터 프롬프트를 찾을 수 없습니다.');
        const char = charPrompts[idx];

        btnElement.disabled = true;
        const originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> 생성 중...`;
        if (window.lucide) window.lucide.createIcons();

        const resultContainer = document.getElementById(`master-char-result-${idx}`);
        const resultImg = document.getElementById(`master-char-img-${idx}`);
        const resultLoading = document.getElementById(`master-char-loading-${idx}`);

        if (resultContainer) resultContainer.classList.remove('hidden');
        if (resultLoading) resultLoading.classList.remove('hidden');

        try {
            const apiResult = await ImageApi.generateImage(char.description, { ...this.imageSettings, aspectRatio: '1:1' });
            if (apiResult.success && apiResult.imageUrl) {
                if (resultImg) resultImg.src = apiResult.imageUrl;
                this.generatedMasterChars = this.generatedMasterChars || {};
                this.generatedMasterChars[idx] = apiResult.imageUrl;
            } else {
                throw new Error(apiResult.error || '생성 실패');
            }
        } catch (error) {
            alert(`❌ 생성 실패: ${error.message}`);
            if (resultContainer && !resultImg.src) resultContainer.classList.add('hidden');
        } finally {
            if (resultLoading) resultLoading.classList.add('hidden');
            btnElement.disabled = false;
            btnElement.innerHTML = originalHTML;
            if (window.lucide) window.lucide.createIcons();
        }
    }

    applyMasterCharToSubjectRef(idx) {
        if (!this.generatedMasterChars || !this.generatedMasterChars[idx]) return alert('먼저 이미지를 생성해주세요.');
        const imageUrl = this.generatedMasterChars[idx];
        const img = document.getElementById('ref-subject-img');
        const clearBtn = document.getElementById('btn-clear-subject');

        if (img) {
            img.src = imageUrl;
            img.classList.remove('hidden');
            if (clearBtn) clearBtn.classList.remove('hidden');
        }

        this.referenceImages.subject = imageUrl;
        this.saveReferenceImages();
        alert('✅ 캐릭터 이미지가 피사체 참조로 등록되었습니다.');
    }

    downloadMasterCharImage(idx) {
        if (!this.generatedMasterChars || !this.generatedMasterChars[idx]) return alert('이미지를 생성해주세요.');
        const imageUrl = this.generatedMasterChars[idx];
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `master_char_${Date.now()}.png`;
        link.click();
    }

    loadReferenceImages() {
        try {
            const saved = localStorage.getItem('referenceImages');
            if (saved) return JSON.parse(saved);
        } catch (error) { console.error('Failed to load references', error); }
        return { subject: null, scene: null, style: null };
    }

    saveReferenceImages() {
        try {
            localStorage.setItem('referenceImages', JSON.stringify(this.referenceImages));
        } catch (error) { }
    }

    restoreReferenceImagesUI() {
        ['subject', 'scene', 'style'].forEach(type => {
            const imageUrl = this.referenceImages[type];
            if (imageUrl) {
                const img = document.getElementById(`ref-${type}-img`);
                const clearBtn = document.getElementById(`btn-clear-${type}`);
                if (img) { img.src = imageUrl; img.classList.remove('hidden'); }
                if (clearBtn) clearBtn.classList.remove('hidden');
            }
        });
    }
}
