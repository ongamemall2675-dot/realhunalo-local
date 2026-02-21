// ================================================================
// VIDEO MODULE - 최종 편집실
// TTS → Vrew 워크플로우 호환
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { API_BASE_URL, CONFIG } from '../config.js';
import { VideoApi } from '../api/VideoApi.js';
import { VideoUI } from '../components/VideoUI.js';

export class VideoModule extends Module {
    constructor() {
        // ✅ super()를 반드시 먼저 호출해야 this에 접근 가능 (JS 파생 클래스 규칙)
        super('video', '최종 편집실', 'film', '시각/청각 자산 통합 및 최종 영상 생성');

        this.videoSettings = {
            resolution: '1080p',
            fps: 30,
            preset: 'medium',
            bitrate: '8M'
        };

        this.motionSettings = {
            duration: 5,
            aspectRatio: '16:9',
            model: 'bytedance/seedance-1-lite'
        };

        // 서비스 상태
        this.serviceStatus = null;
        this.pollInterval = null;
        this.startTime = null;
        this.api = new VideoApi();
    }

    async render() {
        const scenes = AppState.getScenes();
        this.loadServiceStatus();
        const isEmpty = scenes.length === 0;
        const assetStatus = isEmpty ? { hasIssues: false, missingBoth: [], missingVisuals: [], missingAudio: [], readyCount: 0, totalScenes: 0 } : VideoUI.analyzeAssetStatus(scenes);
        const readyScenes = isEmpty ? { complete: 0, partial: 0, missing: 0 } : VideoUI.countReadyScenes(scenes);
        return VideoUI.render(scenes, assetStatus, readyScenes, isEmpty);
    }


    initializeSubtitleSettings() {
        console.log('[VideoModule] 자막 및 영상 설정 초기화...');

        // 1. 영상 출력 설정 리스너 연결
        const videoSettingIds = ['video-resolution', 'video-fps', 'video-preset', 'video-bitrate'];
        videoSettingIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const key = id.replace('video-', '');
                if (this.videoSettings[key]) el.value = this.videoSettings[key];

                el.addEventListener('change', (e) => {
                    const value = key === 'fps' ? parseInt(e.target.value) : e.target.value;
                    this.videoSettings[key] = value;
                    console.log(`✅ Video setting updated: ${key} = ${value}`);
                    this.syncVideoSettings();
                });
            }
        });

        // 2. 자막 설정 리스너 연결
        const subtitleIds = [
            'subtitle-enabled', 'subtitle-font', 'subtitle-size',
            'subtitle-color', 'subtitle-outline-color',
            'subtitle-outline-width', 'subtitle-position', 'subtitle-alignment'
        ];

        subtitleIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.updateSubtitlePreview());
                el.addEventListener('change', () => this.updateSubtitlePreview());
            }
        });

        // 통계 보기 토글
        const btnToggleStats = document.getElementById('btn-toggle-stats');
        const statsPanel = document.getElementById('video-service-stats');
        if (btnToggleStats && statsPanel) {
            btnToggleStats.addEventListener('click', () => {
                statsPanel.classList.toggle('hidden');
            });
        }

        // 초기 미리보기 업데이트
        this.updateSubtitlePreview();
    }

    async syncVideoSettings() {
        try {
            await VideoApi.updateSettings(this.videoSettings);
        } catch (e) {
            console.error('Failed to sync video settings:', e);
        }
    }

    updateSubtitlePreview() {
        const preview = document.getElementById('subtitle-preview');
        if (!preview) return;

        const settings = this.getSubtitleSettings();
        if (!settings || !settings.enabled) {
            preview.style.opacity = '0.3';
            return;
        }

        preview.style.opacity = '1';
        preview.style.fontFamily = `'${settings.fontFamily}', sans-serif`;
        preview.style.fontSize = `${Math.max(12, settings.fontSize / 5)}px`; // 미리보기용 스케일링
        preview.style.color = settings.fontColor;
        preview.style.textAlign = settings.alignment;

        // 외곽선 효과
        const w = settings.outlineWidth;
        const c = settings.outlineColor;
        if (w > 0) {
            preview.style.webkitTextStroke = `${w}px ${c}`;
            preview.style.paintOrder = 'stroke fill';
            preview.style.textShadow = 'none';
        } else {
            preview.style.webkitTextStroke = '0';
            preview.style.textShadow = 'none';
        }
    }

    getSubtitleSettings() {
        const enabled = document.getElementById('subtitle-enabled')?.checked ?? false;
        if (!enabled) return { enabled: false };

        return {
            enabled: true,
            fontFamily: document.getElementById('subtitle-font')?.value || 'Malgun Gothic',
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
        console.log("🚀 VideoModule onMount started");
        try {
            // Setup guide button
            if (this.setupGuideButton) this.setupGuideButton();

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

            // 씬 추가 버튼 (항상 사용 가능)
            const btnAddScene = document.getElementById('btn-add-scene');
            if (btnAddScene) {
                btnAddScene.addEventListener('click', () => this.addNewScene());
            }

            // 메타데이터 & 썸네일 리스너 (항상 사용 가능)
            this.attachMetadataAndThumbnailListeners();

            // 영상 생성 버튼
            // 영상 생성 버튼
            const btnGen = document.getElementById('btn-gen-final-video');
            if (btnGen) {
                console.log("✅ btn-gen-final-video found, attaching listener");
                btnGen.addEventListener('click', () => {
                    console.log("🖱️ Final Video button clicked");
                    this.generateFinalVideo(false);
                });
            } else {
                console.warn("⚠️ btn-gen-final-video NOT found");
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
            // Vrew 내보내기 버튼
            const btnVrew = document.getElementById('btn-export-vrew');
            if (btnVrew) {
                console.log("✅ btn-export-vrew found, attaching listener");
                btnVrew.addEventListener('click', () => {
                    console.log("🖱️ Export Vrew button clicked");
                    this.exportToVrew();
                });
            } else {
                console.warn("⚠️ btn-export-vrew NOT found");
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
                    console.log(`🔽 자동 다운로드: ${this.autoDownload ? 'ON' : 'OFF'} `);
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
            // 저장된 최종 영상이 있으면 복원
            const savedVideoUrl = AppState.getFinalVideoUrl();
            if (savedVideoUrl) {
                console.log('🎥 저장된 최종 영상 복원:', savedVideoUrl);
                this.displayVideo(savedVideoUrl);
            }

            // 볼륨 및 음소거 이벤트 바인딩
            this.bindVolumeEvents();

            console.log("✅ VideoModule onMount completed successfully");
        } catch (e) {
            console.error("❌ VideoModule onMount failed:", e);
        }
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

        // 비디오 볼륨 슬라이더
        document.querySelectorAll('.volume-slider-video').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const sceneId = parseInt(slider.getAttribute('data-scene-id'));
                this.setVideoVolume(sceneId, parseFloat(e.target.value));
            });
        });

        // 오디오(음성) 볼륨 슬라이더
        document.querySelectorAll('.volume-slider-audio').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const sceneId = parseInt(slider.getAttribute('data-scene-id'));
                this.setAudioVolume(sceneId, parseFloat(e.target.value));
            });
        });

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

        // 영상 편집 버튼
        document.querySelectorAll('.btn-edit-video').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = parseInt(btn.getAttribute('data-scene-id'));
                this.editSceneVideo(sceneId);
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
                    label.innerHTML = `전환 시간 < span class="text-purple-400" > ${this.manualEditSettings.transitionDuration}초</span > `;
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
            console.log(`✅ Scene ${sceneId} duration updated to ${scene.customDuration} s`);
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

        VideoUI.showTimelinePreview(includedScenes);
        if (window.lucide) window.lucide.createIcons();
    }

    async loadSettings() {
        try {
            const settings = await VideoApi.fetchSettings();
            if (settings) {
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
            this.serviceStatus = await VideoApi.fetchServiceStatus();
            if (this.serviceStatus) {
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
            await VideoApi.updateSettings(this.videoSettings);
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
            stats.totalDurationSeconds ? `${Math.round(stats.totalDurationSeconds)} s` : '-';
        document.getElementById('stat-avg-process-time').textContent =
            stats.averageProcessingTimeSeconds ? `${stats.averageProcessingTimeSeconds.toFixed(1)} s` : '-';
        document.getElementById('stat-success-rate').textContent =
            stats.totalVideos > 0
                ? `${Math.round((stats.successfulVideos / stats.totalVideos) * 100)}% `
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
            if (!confirm(`⚠️ 완전히 준비된 씬이 없습니다.\n\n완료: ${readyScenes.complete} 개\n부분 완료: ${readyScenes.partial} 개\n빈 씬: ${readyScenes.missing} 개\n\n그래도 영상을 생성하시겠습니까 ?\n(빠진 자산은 기본값으로 대체됩니다)`)) {
                return;
            }
        } else if (!auto && !confirm(`${scenes.length}개의 씬으로 최종 영상을 생성하시겠습니까 ?\n\n완료: ${readyScenes.complete} 개\n부분 완료: ${readyScenes.partial} 개\n빈 씬: ${readyScenes.missing} 개`)) {
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

            // 기존 최종 영상 URL 초기화 (새 작업 시작 시)
            AppState.setFinalVideoUrl(null);

            if (progressContainer) {
                progressContainer.classList.remove('hidden');
                progressTitle.textContent = '영상 생성 준비 중...';
                progressBar.style.width = '0%';
                progressPercent.textContent = '0%';
                progressMessage.textContent = '백엔드 서버에 요청 중...';
            }

            // 사용자에게 시작 알림
            console.log('✅ 영상 생성이 시작되었습니다!');

            // 작업 시작
            console.log('📤 API 요청 전송 중...');
            const result = await VideoApi.generateFinalVideo(timelineData);
            console.log('📥 API 응답 수신 성공');
            const taskId = result.taskId;

            console.log(`✅ Task started: ${taskId} `);
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

            alert(`영상 생성 실패: \n\n${e.message} \n\n백엔드 서버가 실행 중인지 확인하세요.`);
        }
    }

    async exportToVrew() {
        if (!confirm('Vrew 프로젝트 파일로 내보내시겠습니까?\n\n⚠️ TTS 타임스탬프가 Vrew 자막과 동기화됩니다.')) return;

        const scenes = AppState.getScenes();
        const timelineData = this.prepareTimelineData(scenes);

        if (!timelineData) return;

        try {
            const result = await VideoApi.exportToVrew(timelineData);
            const taskId = result.taskId;

            console.log(`✅ Vrew task started: ${taskId} `);

            // 폴링 시작
            this.pollTaskStatus(taskId, 'Vrew 내보내기');

        } catch (e) {
            console.error('❌ Vrew Export Error:', e);
            alert(`Vrew 내보내기 실패: \n${e.message} `);
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

            if (!confirm(`'${file.name}'을(를) 가져오시겠습니까 ?\n\n⚠️ 현재 작업중인 씬들이 대체됩니다.`)) {
                return;
            }

            try {
                // 파일 업로드
                const formData = new FormData();
                formData.append('file', file);

                const result = await VideoApi.importFromVrew(file);
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

                alert(`✅ ${result.message} \n\n가져온 씬: ${importedScenes.length} 개`);

            } catch (e) {
                console.error('❌ VREW Import Error:', e);
                alert(`VREW 가져오기 실패: \n${e.message} `);
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
                elapsedTimeEl.textContent = `경과 시간: ${minutes}:${seconds.toString().padStart(2, '0')} `;
            }
        }, 1000);

        this.pollInterval = setInterval(async () => {
            try {
                const task = await VideoApi.getTaskStatus(taskId);

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
                        // 결과 저장
                        const absoluteVideoUrl = this.getAssetUrl(task.result.videoUrl);
                        AppState.setFinalVideoUrl(absoluteVideoUrl);

                        this.displayVideo(absoluteVideoUrl);

                        // 자동 다운로드 로직 제거 (사용자 요청에 의해 항상 알림만 표시)
                        alert(`✅ ${taskName} 완료!\n\n아래에서 확인하실 수 있습니다.`);

                    } else if (task.result.vrewUrl) {
                        // Vrew 파일 다운로드
                        const link = document.createElement('a');
                        link.href = this.getAssetUrl(task.result.vrewUrl);
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
            player.autoplay = false; // 자동 재생 방지
            player.pause(); // 확실하게 정지 상태 유지
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

            downloadBtn.onclick = async (e) => {
                e.stopPropagation();
                e.preventDefault();

                const originalContent = downloadBtn.innerHTML;
                downloadBtn.disabled = true;
                downloadBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 다운로드 중...';
                if (typeof lucide !== 'undefined') lucide.createIcons();

                try {
                    // 강제 다운로드 전용 API 사용 (Content-Disposition: attachment → 브라우저 재생 완전 차단)
                    const filename = videoUrl.split('/').pop().split('?')[0];
                    const downloadUrl = `${API_BASE_URL}/api/download-video/${filename}`;

                    const response = await fetch(downloadUrl);
                    if (!response.ok) throw new Error(`서버 오류: ${response.status}`);

                    const blob = await response.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = blobUrl;
                    a.download = `final_video_${Date.now()}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        window.URL.revokeObjectURL(blobUrl);
                        document.body.removeChild(a);
                    }, 2000);

                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = originalContent;
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                } catch (error) {
                    console.error('Download error:', error);
                    alert('다운로드에 실패했습니다. 백엔드 서버가 실행 중인지 확인해주세요.');
                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = originalContent;
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
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
            mergedGroups: [],
            standalone: []
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
                    // 우선순위에 따른 시각 자산 결정
                    let visualUrl = null;
                    if (s.preferredVisual === 'video' && s.videoUrl) {
                        visualUrl = s.videoUrl;
                    } else if (s.preferredVisual === 'image' && s.generatedUrl) {
                        visualUrl = s.generatedUrl;
                    } else {
                        // 기본값
                        visualUrl = s.videoUrl || s.generatedUrl || null;
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
                        audioUrl: s.audioUrl || null,
                        videoVolume: s.videoVolume !== undefined ? s.videoVolume : 1.0,
                        audioVolume: s.audioVolume !== undefined ? s.audioVolume : 1.0,
                        videoUrl: s.videoUrl || null, // Vrew 호환성: 원본 영상 URL 명시
                        isVideo: !!(s.videoUrl && s.preferredVisual === 'video'),
                        startTime: startTime,
                        endTime: endTime,
                        duration: Math.max(duration, 1),
                        script: s.isMergeLeader ? (s.scriptForTTS || s.originalScript) : s.originalScript,
                        srtData: srtData,  // Vrew 타임스탬프 동기화용
                        audioPath: s.audioPath || null
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

            // 우선순위에 따른 시각 자산 결정
            let visualUrl = null;
            if (s.preferredVisual === 'video' && s.videoUrl) {
                visualUrl = s.videoUrl;
            } else if (s.preferredVisual === 'image' && s.generatedUrl) {
                visualUrl = s.generatedUrl;
            } else {
                // 기본값
                visualUrl = s.videoUrl || s.generatedUrl || null;
            }

            const audioUrl = s.audioUrl || null;

            // Base64 데이터는 여전히 skip (백엔드에서 처리 불가)
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

            const finalDuration = explicitDuration || srtDuration || 5;

            console.log(`[Timeline] 최종 Duration: ${finalDuration}초`);

            // Vrew 호환: srtData 포함
            const srtData = s.srtData || s.srt || null;

            const sceneData = {
                sceneId: s.sceneId,
                visualUrl: visualUrl,
                audioUrl: audioUrl,
                videoVolume: s.videoVolume !== undefined ? s.videoVolume : 1.0,
                audioVolume: s.audioVolume !== undefined ? s.audioVolume : 1.0,
                videoUrl: s.videoUrl || null, // Vrew 호환성: 원본 영상 URL 명시
                isVideo: !!(s.videoUrl && s.preferredVisual === 'video'),
                script: s.scriptForTTS || s.originalScript,
                duration: Math.max(finalDuration, 1),
                srtData: srtData,  // Vrew 타임스탬프 동기화용
                audioPath: s.audioPath || null
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
            console.log(`📡 API 호출 시작: ${CONFIG.endpoints.youtubeMetadata}`);
            const response = await fetch(CONFIG.endpoints.youtubeMetadata, {
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
            console.log(`📡 API 호출 시작: ${CONFIG.endpoints.thumbnailPrompts}`);
            const response = await fetch(CONFIG.endpoints.thumbnailPrompts, {
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
            const response = await fetch(CONFIG.endpoints.thumbnailImage, {
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
                // scene.videoUrl = null; // Removed: Allow both to coexist
                if (!scene.preferredVisual) scene.preferredVisual = 'image'; // Default to image if set
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

                    const response = await fetch(`${CONFIG.endpoints.image}`, {
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
                        // scene.videoUrl = null; // Removed: Allow both to coexist
                        if (!scene.preferredVisual) scene.preferredVisual = 'image';
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

    async editSceneVideo(sceneId) {
        const scenes = AppState.getScenes();
        const scene = scenes.find(s => s.sceneId === sceneId);

        if (!scene) {
            alert('장면을 찾을 수 없습니다.');
            return;
        }

        const videoUrl = prompt('영상 URL을 입력하거나 파일을 드래그앤드롭 하세요:', scene.videoUrl || '');
        if (videoUrl !== null && videoUrl.trim() !== '') {
            scene.videoUrl = videoUrl.trim();
            scene.preferredVisual = 'video'; // Default to video if set manually
            AppState.setScenes(scenes);
            this.refreshModule();
            console.log(`[VideoModule] 장면 #${sceneId} 영상 URL 설정:`, videoUrl);
        }
    }

    setPreferredVisual(sceneId, type) {
        const scenes = AppState.getScenes();
        const scene = scenes.find(s => s.sceneId === sceneId);

        if (!scene) return;

        scene.preferredVisual = type;
        AppState.setScenes(scenes);
        this.refreshModule();
        console.log(`[VideoModule] 장면 #${sceneId} 우선 자산 설정:`, type);
    }

    setVideoVolume(sceneId, volume) {
        const scenes = AppState.getScenes();
        const scene = scenes.find(s => s.sceneId === sceneId);

        if (!scene) return;

        scene.videoVolume = volume;
        // 슬라이더 조작 시 매번 전체 리프레시하면 무거울 수 있으므로, 값만 업데이트 후 로그
        console.log(`[VideoModule] 장면 #${sceneId} 비디오 볼륨 설정:`, volume);

        // UI에 숫자를 보여주기 위해 라벨만 업데이트 (성능 최적화 버전)
        const label = document.querySelector(`tr[data-scene-id="${sceneId}"] .volume-slider-video + div span`) ||
            document.querySelector(`tr[data-scene-id="${sceneId}"] .volume-slider-video`).previousElementSibling.lastElementChild;
        if (label) {
            label.textContent = `${Math.round(volume * 100)}%`;
        }

        // AppState에 반영
        AppState.saveToLocalStorage();
    }

    setAudioVolume(sceneId, volume) {
        const scenes = AppState.getScenes();
        const scene = scenes.find(s => s.sceneId === sceneId);

        if (!scene) return;

        scene.audioVolume = volume;
        console.log(`[VideoModule] 장면 #${sceneId} 음성 볼륨 설정:`, volume);

        // UI 라벨 업데이트
        const label = document.querySelector(`tr[data-scene-id="${sceneId}"] .volume-slider-audio`).previousElementSibling.lastElementChild;
        if (label) {
            label.textContent = `${Math.round(volume * 100)}%`;
        }

        AppState.saveToLocalStorage();
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

                const response = await fetch(`${CONFIG.endpoints.tts}`, {
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


    async generateMotion(sceneId) {
        const scenes = AppState.getScenes();
        const scene = scenes.find(s => s.sceneId === sceneId);

        if (!scene || !scene.generatedUrl) {
            alert('이미지가 없어서 모션을 생성할 수 없습니다.');
            return;
        }

        const btn = document.getElementById(`btn-gen-motion-${sceneId}`);
        const originalContent = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i>';
            lucide.createIcons();
        }

        try {
            console.log(`[VideoModule] Generating motion for scene #${sceneId}`);

            // 모션 프롬프트가 없으면 AI 생성 시도
            if (!scene.motionPrompt) {
                console.log(`[VideoModule] Generating motion prompt for scene #${sceneId}...`);

                // 버튼 상태 업데이트 (사용자 피드백)
                if (btn) btn.innerHTML = '<i data-lucide="sparkles" class="w-3 h-3 animate-spin"></i>';

                try {
                    const promptResponse = await fetch(CONFIG.endpoints.motionPrompt, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            originalScript: scene.originalScript || scene.script || '',
                            imagePrompt: scene.imagePrompt || ''
                        })
                    });

                    const promptResult = await promptResponse.json();

                    if (promptResult.success && promptResult.motionPrompt) {
                        scene.motionPrompt = promptResult.motionPrompt;
                        console.log(`✅ Generated motion prompt: ${scene.motionPrompt}`);
                    } else {
                        console.warn('⚠️ Failed to generate motion prompt, using default.');
                        scene.motionPrompt = "Slow cinematic camera movement, high quality";
                    }
                } catch (e) {
                    console.error('❌ Motion prompt API error:', e);
                    scene.motionPrompt = "Slow cinematic camera movement, high quality";
                }

                // 생성된 프롬프트 저장
                AppState.setScenes(scenes);

                // 버튼 상태 복구 (모션 생성 중 상태로)
                if (btn) btn.innerHTML = '<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i>';
            }

            const result = await VideoApi.generateMotion({
                sceneId: sceneId,
                imageUrl: scene.generatedUrl,
                motionPrompt: scene.motionPrompt,
                duration: this.motionSettings.duration || 5,
                aspectRatio: this.motionSettings.aspectRatio || '16:9',
                model: this.motionSettings.model
            });

            if (result.success && result.videoUrl) {
                scene.videoUrl = result.videoUrl;
                scene.preferredVisual = 'video'; // 자동으로 비디오 선호로 변경
                AppState.setScenes(scenes);
                this.refreshModule();
                console.log(`✅ Motion generated for scene #${sceneId}:`, result.videoUrl);
                alert('모션 비디오가 생성되었습니다!');
            } else {
                throw new Error(result.error || '모션 생성 실패');
            }

        } catch (error) {
            console.error('Motion generation error:', error);
            alert(`모션 생성 실패: ${error.message}`);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalContent;
                lucide.createIcons();
            }
        }
    }

    bindVolumeEvents() {
        // 비디오 볼륨 슬라이더
        document.querySelectorAll('.volume-slider-video').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const sceneId = parseInt(e.target.dataset.sceneId);
                const volume = parseFloat(e.target.value);
                this.setVideoVolume(sceneId, volume);

                // 음소거 버튼 아이콘 업데이트
                const muteBtn = document.querySelector(`.btn-mute-video[data-scene-id="${sceneId}"]`);
                if (muteBtn) {
                    const icon = muteBtn.querySelector('i');
                    if (volume === 0) {
                        icon.setAttribute('data-lucide', 'volume-x');
                        muteBtn.title = '음소거 해제';
                    } else {
                        icon.setAttribute('data-lucide', 'volume-2');
                        muteBtn.title = '음소거';
                    }
                    if (window.lucide) window.lucide.createIcons();
                }
            });
        });

        // 비디오 음소거 버튼
        document.querySelectorAll('.btn-mute-video').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sceneId = parseInt(e.currentTarget.dataset.sceneId);
                const scenes = AppState.getScenes();
                const scene = scenes.find(s => s.sceneId === sceneId);
                if (scene) {
                    const slider = document.querySelector(`.volume-slider-video[data-scene-id="${sceneId}"]`);
                    if (scene.videoVolume > 0) {
                        // 음소거 설정
                        scene._prevVideoVolume = scene.videoVolume; // 이전 볼륨 저장
                        this.setVideoVolume(sceneId, 0);
                        if (slider) slider.value = 0;
                    } else {
                        // 음소거 해제
                        const prevVol = scene._prevVideoVolume || 1.0;
                        this.setVideoVolume(sceneId, prevVol);
                        if (slider) slider.value = prevVol;
                    }
                }
            });
        });

        // 오디오 볼륨 슬라이더
        document.querySelectorAll('.volume-slider-audio').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const sceneId = parseInt(e.target.dataset.sceneId);
                const volume = parseFloat(e.target.value);
                this.setAudioVolume(sceneId, volume);

                // 음소거 버튼 아이콘 업데이트
                const muteBtn = document.querySelector(`.btn-mute-audio[data-scene-id="${sceneId}"]`);
                if (muteBtn) {
                    const icon = muteBtn.querySelector('i');
                    if (volume === 0) {
                        icon.setAttribute('data-lucide', 'mic-off');
                        muteBtn.title = '음소거 해제';
                    } else {
                        icon.setAttribute('data-lucide', 'mic');
                        muteBtn.title = '음소거';
                    }
                    if (window.lucide) window.lucide.createIcons();
                }
            });
        });

        // 오디오 음소거 버튼
        document.querySelectorAll('.btn-mute-audio').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sceneId = parseInt(e.currentTarget.dataset.sceneId);
                const scenes = AppState.getScenes();
                const scene = scenes.find(s => s.sceneId === sceneId);
                if (scene) {
                    const slider = document.querySelector(`.volume-slider-audio[data-scene-id="${sceneId}"]`);
                    if (scene.audioVolume > 0) {
                        // 음소거 설정
                        scene._prevAudioVolume = scene.audioVolume;
                        this.setAudioVolume(sceneId, 0);
                        if (slider) slider.value = 0;
                    } else {
                        // 음소거 해제
                        const prevVol = scene._prevAudioVolume || 1.0;
                        this.setAudioVolume(sceneId, prevVol);
                        if (slider) slider.value = prevVol;
                    }
                }
            });
        });
    }
}


