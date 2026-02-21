
import { AppState } from '../state.js';

/**
 * ProjectService
 * 
 * 전역 프로젝트 상태 관리 및 자동 저장 서비스
 * - 프로젝트 생성, 저장, 불러오기, 삭제
 * - 변경 사항 감지 및 자동 저장 (Auto-Save)
 * - 전역 저장 상태 UI 업데이트
 */
export class ProjectService {
    constructor() {
        this.currentProjectId = null;
        this.isDirty = false; // 변경 사항 발생 여부
        this.lastSaved = null;
        this.autoSaveInterval = null;
        this.autoSaveDelay = 30 * 1000; // 30초

        // 싱글톤 인스턴스로 관리
        if (ProjectService.instance) {
            return ProjectService.instance;
        }
        ProjectService.instance = this;
    }

    /**
     * 서비스 초기화
     */
    init() {
        console.log("💾 ProjectService Initialized");
        this.setupAutoSave();
        this.renderGlobalStatus();
    }

    /**
     * 자동 저장 타이머 설정
     */
    setupAutoSave() {
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);

        this.autoSaveInterval = setInterval(async () => {
            if (this.currentProjectId && this.isDirty) {
                console.log("💾 Auto-saving project...");
                await this.saveProject(true); // silent mode
            }
        }, this.autoSaveDelay);
    }

    /**
     * 변경 사항 발생 알림 (AppState 등에서 호출)
     */
    notifyChange() {
        this.isDirty = true;
        this.updateStatusUI('Unsaved changes...');
    }

    /**
     * 프로젝트 목록 조회
     */
    async fetchProjects() {
        try {
            const res = await fetch('http://localhost:8000/api/projects');
            if (res.ok) {
                return await res.json();
            }
            throw new Error('Failed to fetch projects');
        } catch (e) {
            console.error("fetchProjects error:", e);
            return [];
        }
    }

    /**
     * 프로젝트 불러오기
     */
    async loadProject(id) {
        if (this.isDirty) {
            if (!confirm("저장되지 않은 변경사항이 있습니다. 무시하고 불러오시겠습니까?")) return false;
        }

        try {
            const res = await fetch(`http://localhost:8000/api/projects/${id}`);
            if (res.ok) {
                const data = await res.json();
                this._applyProjectData(data);
                this.isDirty = false;
                this.updateStatusUI(`Saved at ${new Date().toLocaleTimeString()}`);
                return true;
            }
            throw new Error(await res.text());
        } catch (e) {
            alert("프로젝트 불러오기 실패: " + e.message);
            return false;
        }
    }

    /**
     * 프로젝트 데이터 적용 (AppState 복원)
     */
    _applyProjectData(data) {
        console.log("📂 Loading project:", data.name);

        this.currentProjectId = data.id;
        this.lastSaved = new Date(data.updatedAt);
        AppState.setProjectId(data.id);

        if (data.script) AppState.setScript(data.script);
        if (data.scenes) AppState.setScenes(data.scenes);
        if (data.style) AppState.setStyle(data.style);
        if (data.ratio) AppState.setRatio(data.ratio);
        if (data.resolution) AppState.setResolution(data.resolution);
        if (data.masterCharacterPrompt) AppState.setMasterCharacterPrompt(data.masterCharacterPrompt);
        if (data.automation) AppState.automation = data.automation;

        // TTS 설정 복원
        if (data.voiceSettings) {
            const ttsMod = window.app?.modules?.find(m => m.id === 'tts');
            if (ttsMod) ttsMod.voiceSettings = data.voiceSettings;
        }

        // 전역 상태 UI 업데이트
        const projectNameEl = document.getElementById('global-project-name');
        if (projectNameEl) projectNameEl.textContent = data.name;
    }

    /**
     * 프로젝트 저장
     * @param {boolean} silent - 알림 표시 여부 (자동 저장 시 true)
     */
    async saveProject(silent = false) {
        // 1. 데이터 수집
        const isNew = !this.currentProjectId;
        let name = "Untitled Project";

        // 신규 프로젝트인데 silent 저장이면 임시 이름 사용 (또는 스킵)
        if (isNew && silent) return;

        if (isNew && !silent) {
            name = prompt("새 프로젝트 이름을 입력하세요:", AppState.script.substring(0, 20) || "Untitled Project");
            if (!name) return;
        } else if (!isNew) {
            // 기존 이름 유지 (메타데이터에서 가져오거나 DOM에서 확인)
            const projectNameEl = document.getElementById('global-project-name');
            name = projectNameEl ? projectNameEl.textContent : "Untitled Project";
        }

        const projectData = {
            id: this.currentProjectId,
            name: name,
            script: AppState.script,
            style: AppState.style,
            ratio: AppState.ratio,
            resolution: AppState.resolution,
            masterCharacterPrompt: AppState.masterCharacterPrompt,
            scenes: AppState.scenes,
            automation: AppState.automation,
            voiceSettings: window.app?.modules?.find(m => m.id === 'tts')?.voiceSettings
        };

        try {
            const res = await fetch('http://localhost:8000/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: projectData })
            });

            if (res.ok) {
                const savedData = await res.json();

                // ID 업데이트
                if (savedData.id) {
                    this.currentProjectId = savedData.id;
                    AppState.setProjectId(savedData.id);
                }

                // UI 업데이트
                this.isDirty = false;
                this.lastSaved = new Date();
                this.updateStatusUI(`Saved at ${this.lastSaved.toLocaleTimeString()}`);

                const projectNameEl = document.getElementById('global-project-name');
                if (projectNameEl) projectNameEl.textContent = savedData.name;

                if (!silent) alert("저장되었습니다!");

                // 프로젝트 목록 모듈이 열려있다면 갱신
                const projectModule = window.app?.modules?.find(m => m.id === 'project');
                if (projectModule && typeof projectModule.fetchProjects === 'function') {
                    projectModule.fetchProjects();
                }

                return true;
            }
            throw new Error(await res.text());
        } catch (e) {
            console.error("Save failed:", e);
            if (!silent) alert("저장 실패: " + e.message);
            this.updateStatusUI('Save Failed!', true);
            return false;
        }
    }

    /**
     * 프로젝트 삭제
     */
    async deleteProject(id) {
        try {
            const res = await fetch(`http://localhost:8000/api/projects/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                if (id === this.currentProjectId) {
                    this.currentProjectId = null;
                    AppState.setProjectId(null);
                    document.getElementById('global-project-name').textContent = "No Project";
                    this.updateStatusUI("");
                }
                return true;
            }
            throw new Error("Delete failed");
        } catch (e) {
            alert("삭제 실패: " + e.message);
            return false;
        }
    }

    /**
     * 상단 상태바에 UI 렌더링
     */
    renderGlobalStatus() {
        const container = document.getElementById('project-status-container');
        if (!container) return;

        // 이미 렌더링 된 경우 스킵
        if (document.getElementById('project-status-widget')) return;

        const widget = document.createElement('div');
        widget.id = 'project-status-widget';
        widget.className = 'flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700/50';
        widget.innerHTML = `
            <div class="flex flex-col items-end">
                <span id="global-project-name" class="text-xs font-bold text-white truncate max-w-[150px]">No Project</span>
                <span id="global-save-status" class="text-[10px] text-slate-400">Ready</span>
            </div>
            <button id="btn-global-save" class="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors shadow-lg shadow-blue-500/20" title="Save Project">
                <i data-lucide="save" class="w-4 h-4"></i>
            </button>
        `;

        container.appendChild(widget);

        // 이벤트 리스너
        widget.querySelector('#btn-global-save').addEventListener('click', () => this.saveProject(false));

        // 아이콘 생성
        if (window.lucide) window.lucide.createIcons();
    }

    updateStatusUI(message, isError = false) {
        const statusEl = document.getElementById('global-save-status');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = isError ? "text-[10px] text-red-400" : "text-[10px] text-slate-400";
        }
    }
}

// 전역 인스턴스 생성
export const projectService = new ProjectService();
