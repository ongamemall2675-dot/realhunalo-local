import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { projectService } from '../services/ProjectService.js';

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

        // 전역 저장 버튼은 ProjectService가 관리하므로 모듈 내 저장 버튼은 제거하거나 
        // ProjectService.saveProject()를 호출하도록 연결
        const saveBtn = document.getElementById('btn-save-project-module');
        if (saveBtn) {
            const newBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newBtn, saveBtn);
            newBtn.addEventListener('click', () => projectService.saveProject());
        }
    }

    async fetchProjects() {
        this.projects = await projectService.fetchProjects();
        this.renderList();
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
                        <button id="btn-save-project-module" class="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20">
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
            const isCurrent = p.id === projectService.currentProjectId;

            return `
                <div class="group bg-slate-800/50 border ${isCurrent ? 'border-blue-500 shadow-blue-500/20 shadow-lg' : 'border-slate-700/50'} rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all hover:shadow-xl hover:shadow-blue-500/10">
                    <!-- Thumbnail -->
                    <div class="aspect-video bg-slate-900 relative overflow-hidden">
                        <img src="${thumbnail}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                        <div class="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent"></div>
                        
                        ${isCurrent ? `
                        <div class="absolute top-4 right-4 animate-bounce">
                            <span class="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg">Current</span>
                        </div>
                        ` : ''}

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

    async loadProject(id) {
        if (await projectService.loadProject(id)) {
            // 성공 시 리다이렉트
            if (window.app) window.app.route('script');
        }
    }

    async deleteProject(id) {
        if (!confirm("정말 이 프로젝트를 삭제하시겠습니까? (복구 불가)")) return;

        if (await projectService.deleteProject(id)) {
            await this.fetchProjects(); // 목록 갱신
        }
    }
}
