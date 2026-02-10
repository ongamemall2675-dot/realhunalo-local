import { Module } from '../Module.js';
import { AppState } from '../state.js';

export class ProjectModule extends Module {
    constructor() {
        super('project', '프로젝트 관리', 'folder-open', '작업 중인 프로젝트 저장 및 불러오기');
        this.projects = [];
    }

    async onMount() {
        // Setup guide button
        this.setupGuideButton();

        this.renderList(); // Initial render (empty state or loading)
        await this.fetchProjects();

        // Event Delegation
        const container = document.getElementById('project-list-container');
        if (container) {
            container.addEventListener('click', (e) => {
                const target = e.target.closest('button');
                if (!target) return;

                const action = target.dataset.action;
                const id = target.dataset.id;

                if (action === 'load') this.loadProject(id);
                if (action === 'delete') this.deleteProject(id);
            });
        }

        const saveBtn = document.getElementById('btn-save-project');
        if (saveBtn) {
            // Remove old listeners by cloning (simple way)
            const newBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newBtn, saveBtn);
            newBtn.addEventListener('click', () => this.saveProject());
        }
    }

    async fetchProjects() {
        try {
            const res = await fetch('http://localhost:8000/api/projects');
            if (res.ok) {
                this.projects = await res.json();
                this.renderList();
            }
        } catch (e) {
            console.error("Failed to fetch projects:", e);
        }
    }

    render() {
        return `
            <div class="max-w-6xl mx-auto space-y-8 animate-fade-in">
                <!-- User Guide Button -->
                ${this.renderGuideButton()}

                <!-- Header Actions -->
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-3xl font-black text-white tracking-tight mb-2">My Projects</h2>
                        <p class="text-slate-400">저장된 프로젝트를 관리하고 불러옵니다.</p>
                    </div>
                    <div class="flex gap-3">
                        <button id="btn-save-project" class="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20">
                            <i data-lucide="save" class="w-5 h-5"></i>
                            <span>현재 상태 저장</span>
                        </button>
                    </div>
                </div>

                <!-- Project List Grid -->
                <div id="project-list-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- Loading State -->
                    <div class="col-span-full py-20 text-center text-slate-500">
                        <i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto mb-4"></i>
                        <p>프로젝트 목록을 불러오는 중...</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderList() {
        const container = document.getElementById('project-list-container');
        if (!container) return;

        if (this.projects.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                    <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                        <i data-lucide="folder-open" class="w-8 h-8"></i>
                    </div>
                    <h3 class="text-xl font-bold text-slate-300 mb-2">저장된 프로젝트가 없습니다</h3>
                    <p class="text-slate-500">현재 작업 중인 내용을 저장해보세요.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        container.innerHTML = this.projects.map(p => {
            const date = new Date(p.updatedAt).toLocaleString();
            const thumbnail = p.thumbnail || `https://via.placeholder.com/400x225/1e293b/475569?text=${encodeURIComponent(p.name)}`;

            return `
                <div class="group bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all hover:shadow-xl hover:shadow-blue-500/10">
                    <!-- Thumbnail -->
                    <div class="aspect-video bg-slate-900 relative overflow-hidden">
                        <img src="${thumbnail}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                        <div class="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent"></div>
                        <div class="absolute bottom-4 left-4">
                            <span class="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded border border-blue-500/30">
                                ${p.sceneCount || 0} Scenes
                            </span>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="p-5">
                        <h3 class="text-lg font-bold text-white mb-1 truncate">${p.name}</h3>
                        <p class="text-xs text-slate-500 mb-4 flex items-center gap-1">
                            <i data-lucide="clock" class="w-3 h-3"></i> ${date}
                        </p>

                        <div class="flex gap-2 mt-4">
                            <button data-action="load" data-id="${p.id}" class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition-colors">
                                <i data-lucide="upload" class="w-4 h-4"></i> 불러오기
                            </button>
                            <button data-action="delete" data-id="${p.id}" class="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    }

    async saveProject() {
        // Collect current state
        const isNew = !AppState.currentProjectId;
        let name = "Untitled Project";

        if (isNew) {
            name = prompt("새 프로젝트 이름을 입력하세요:", AppState.script.substring(0, 20) || "Untitled Project");
            if (!name) return;
        } else {
            if (!confirm("현재 프로젝트를 덮어쓰시겠습니까?")) return;
        }

        const projectData = {
            id: AppState.currentProjectId,
            name: isNew ? name : undefined,
            script: AppState.script,
            style: AppState.style,
            ratio: AppState.ratio,
            resolution: AppState.resolution,
            scenes: AppState.scenes,
            automation: AppState.automation,

            // Voice Settings
            voiceSettings: window.app.modules.find(m => m.id === 'tts')?.voiceSettings
        };

        try {
            const res = await fetch('http://localhost:8000/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: projectData })
            });

            if (res.ok) {
                const savedData = await res.json();

                // 저장 후 ID 업데이트 (신규 저장의 경우)
                if (savedData.id) {
                    AppState.setProjectId(savedData.id);
                }

                alert("프로젝트가 저장되었습니다!");
                await this.fetchProjects(); // Refresh list
            } else {
                throw new Error(await res.text());
            }
        } catch (e) {
            alert("저장 실패: " + e.message);
        }
    }

    async loadProject(id) {
        if (!confirm("현재 작업 중인 내용이 사라질 수 있습니다. 불러오시겠습니까?")) return;

        try {
            const res = await fetch(`http://localhost:8000/api/projects/${id}`);
            if (res.ok) {
                const data = await res.json();

                // Restore State
                AppState.setProjectId(data.id);
                if (data.script) AppState.setScript(data.script);
                if (data.scenes) AppState.setScenes(data.scenes);
                if (data.style) AppState.setStyle(data.style);
                if (data.ratio) AppState.setRatio(data.ratio);
                if (data.resolution) AppState.setResolution(data.resolution);
                if (data.automation) AppState.automation = data.automation;

                // Restore Voice Settings (if TTS module exists)
                if (data.voiceSettings) {
                    const ttsMod = window.app.modules.find(m => m.id === 'tts');
                    if (ttsMod) ttsMod.voiceSettings = data.voiceSettings;
                }

                alert(`"${data.name}" 프로젝트를 불러왔습니다.`);

                // Redirect to dashboard or script module
                if (window.app) window.app.route('script');
            }
        } catch (e) {
            alert("불러오기 실패: " + e.message);
        }
    }

    async deleteProject(id) {
        if (!confirm("정말 이 프로젝트를 삭제하시겠습니까? (복구 불가)")) return;

        try {
            const res = await fetch(`http://localhost:8000/api/projects/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                // If deleted project is current project, reset ID
                if (id === AppState.currentProjectId) {
                    AppState.setProjectId(null);
                }
                await this.fetchProjects();
            } else {
                throw new Error("Delete failed");
            }
        } catch (e) {
            alert("삭제 실패: " + e.message);
        }
    }
}
