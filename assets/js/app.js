// ================================================================
// APP - Main Application Entry Point
// ================================================================

import { AppState } from './state.js';
import { CONFIG } from './config.js';
import './lightbox.js';
import './utils.js';
import './cache.js';

// Import all modules
import { DashboardModule } from './modules/DashboardModule.js';
import { ProjectModule } from './modules/ProjectModule.js';
import { TrendModule } from './modules/TrendModule.js';
import { YoutubeModule } from './modules/YoutubeModule.js';
import { ScriptModule } from './modules/ScriptModule.js';
import { ImageModule } from './modules/ImageModule.js';
import { MotionModule } from './modules/MotionModule.js';
import { TTSModule } from './modules/TTSModule.js';
import { VideoModule } from './modules/VideoModule.js';
import { ShortsModule } from './modules/ShortsModule.js';
import { ShortsEditModule } from './modules/ShortsEditModule.js';
import { BatchVrewModule } from './modules/BatchVrewModule.js';
import { AudioSegmentationModule } from './modules/AudioSegmentationModule.js';
import { IntegratedWorkflowModule } from './modules/IntegratedWorkflowModule.js';
import { VrewAutoFillModule } from './modules/VrewAutoFillModule.js';
import { SettingsModule } from './modules/SettingsModule.js';
import { projectService } from './services/ProjectService.js';
import { CharacterLibraryModule } from './modules/CharacterLibraryModule.js';

// ================================================================
// APP CONTROLLER
// ================================================================

class App {
    constructor() {
        console.log("🚀 App Initializing...");
        this.modules = [
            // Phase 1: Planning
            { phase: 1, mod: new DashboardModule() },
            { phase: 1, mod: new TrendModule() },
            { phase: 1, mod: new YoutubeModule() },
            { phase: 1, mod: new ScriptModule() },

            // Phase 2: Build
            { phase: 2, mod: new TTSModule() },
            { phase: 2, mod: new AudioSegmentationModule() },
            { phase: 2, mod: new ImageModule() },

            // Phase 4: Design & Polish
            { phase: 4, mod: new VideoModule() },
            { phase: 4, mod: new ShortsModule() },
            { phase: 4, mod: new ShortsEditModule() },
            { phase: 4, mod: new VrewAutoFillModule() },

            // Phase 5: Management
            { phase: 5, mod: new ProjectModule() },
            { phase: 5, mod: new SettingsModule() }
        ];
        this.currentModuleId = 'dashboard';
        this.init();
    }

    init() {
        projectService.init(); // Initialize Project Service
        AppState.setProjectService(projectService); // Connect State to Service
        AppState.loadAutomation(); // Load saved automation settings

        // Initialize Character Library
        CharacterLibraryModule.init();
        window.CharacterLibrary = CharacterLibraryModule;

        // localStorage에서 이전 작업 복원
        const restored = AppState.loadFromLocalStorage();
        if (restored && AppState.scenes.length > 0) {
            console.log('✅ 이전 작업 복원됨 - 계속 작업할 수 있습니다');
        }

        this.renderNav();
        this.route(this.currentModuleId);
    }

    renderNav() {
        const nav = document.getElementById('main-nav');
        let html = '';
        let lastPhase = null;

        const phaseNames = {
            1: "Phase 1: 기획 및 설계",
            2: "Phase 2: 구현 및 개발",
            3: "Phase 3: 문제 해결",
            4: "Phase 4: 디자인 및 최적화",
            5: "Phase 5: 문서화 및 종료"
        };

        this.modules.forEach(item => {
            const mod = item.mod;
            const phase = item.phase;

            // Phase Header
            if (phase !== lastPhase) {
                html += `<div class="phase-label">${phaseNames[phase] || `Phase ${phase}`}</div>`;
                lastPhase = phase;
            }

            const isActive = this.currentModuleId === mod.id;
            const baseClass = "flex items-center gap-4 px-6 py-3.5 rounded-xl transition-all duration-300 relative overflow-hidden group w-full text-left mb-1 mx-2 w-[calc(100%-1rem)]";
            const activeClass = "nav-active-glow text-blue-400 border border-blue-500/30";
            const inactiveClass = "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent";

            html += `
                <button onclick="app.route('${mod.id}')" class="${baseClass} ${isActive ? activeClass : inactiveClass}">
                    ${isActive ? `<div class="absolute left-0 top-0 w-1 h-full bg-blue-500 shadow-[0_0_15px_#3b82f6]"></div>` : ''}
                    <i data-lucide="${mod.icon}" class="w-4 h-4 ${isActive ? 'text-blue-400' : 'group-hover:scale-110'} transition-transform"></i>
                    <span class="font-bold text-[13px] tracking-wide">${mod.name}</span>
                    ${isActive ? `<i data-lucide="chevron-right" class="w-3 h-3 ml-auto opacity-50"></i>` : ''}
                </button>
            `;
        });

        nav.innerHTML = html;
        lucide.createIcons();
    }

    async route(moduleId) {
        const item = this.modules.find(m => m.mod.id === moduleId);
        if (!item) return;
        const mod = item.mod;

        // Call onUnmount on previous module (with proper module structure)
        const previousItem = this.modules.find(m => m.mod.id === this.currentModuleId);
        if (previousItem && previousItem.mod && typeof previousItem.mod.onUnmount === 'function') {
            previousItem.mod.onUnmount();
        }

        this.currentModuleId = moduleId;
        AppState.currentModule = moduleId;

        const header = document.getElementById('module-header');
        const main = document.getElementById('main-content');

        header.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="p-3 rounded-xl bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/20">
                    <i data-lucide="${mod.icon}" class="w-6 h-6"></i>
                </div>
                <div>
                    <h1 class="text-2xl font-black tracking-tight">${mod.name}</h1>
                    <p class="text-sm text-slate-500">${mod.desc}</p>
                </div>
            </div>
        `;

        // Handle both async and sync render methods
        try {
            const content = mod.render();
            main.innerHTML = content instanceof Promise ? await content : content;
        } catch (e) {
            console.error(`[Route] render() 실패 (${moduleId}):`, e);
            main.innerHTML = `<div class="text-red-400 p-8">렌더링 오류: ${e.message}</div>`;
        }

        // Call onMount if exists
        try {
            if (typeof mod.onMount === 'function') {
                mod.onMount();
            }
        } catch (e) {
            console.error(`[Route] onMount() 실패 (${moduleId}):`, e);
        }

        this.renderNav();
        lucide.createIcons();
    }

    getModule(moduleId) {
        const item = this.modules.find(m => m.mod.id === moduleId);
        return item ? item.mod : null;
    }
}

// ================================================================
// GLOBAL INITIALIZATION
// ================================================================

// Create global app instance
const app = new App();
window.app = app;

// Expose AppState and CONFIG globally for console and inline handlers
window.STATE = AppState;
window.CONFIG = CONFIG;

// Global helper functions for inline handlers
// Generic asset drop handler for all modules
window.handleAssetDrop = async (event, dropZone) => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove('border-blue-500', 'ring-2', 'ring-blue-500/50');

    const sceneId = dropZone.getAttribute('data-scene-id');
    const dropType = dropZone.getAttribute('data-drop-type') || 'image'; // 'image' or 'video'
    const files = event.dataTransfer.files;

    if (files.length === 0) return;

    const file = files[0];
    const originalContent = dropZone.innerHTML;
    dropZone.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-black/50 text-white"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>`;
    lucide.createIcons();

    try {
        const formData = new FormData();
        formData.append('data', file);

        const uploadUrl = "http://localhost:8000/api/upload-asset";

        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        const result = await response.json();
        const assetUrl = result.url;

        const scene = AppState.getScenes().find(s => s.sceneId == sceneId);
        if (!scene) throw new Error('Scene not found');

        // Update scene based on file type
        if (file.type.startsWith('video/')) {
            scene.videoUrl = assetUrl;
            scene.preferredVisual = 'video';
            dropZone.innerHTML = `<video src="${assetUrl}" class="w-full h-full object-cover" controls></video>`;

            // Add MOTION badge for video
            const badge = document.createElement('div');
            badge.className = 'absolute top-2 left-2 bg-blue-600/80 text-white text-[9px] px-2 py-0.5 rounded font-bold';
            badge.textContent = 'MOTION';
            dropZone.appendChild(badge);
        } else if (file.type.startsWith('image/')) {
            scene.generatedUrl = assetUrl;
            dropZone.innerHTML = `<img src="${assetUrl}" class="w-full h-full object-cover">`;

            // Add READY badge for image (if in ImageModule)
            if (dropType === 'image') {
                const badge = document.createElement('div');
                badge.className = 'absolute top-2 right-2 bg-green-600/80 text-white text-[9px] px-2 py-0.5 rounded font-bold';
                badge.textContent = 'READY';
                dropZone.appendChild(badge);
            } else {
                // Add IMAGE badge for VideoModule
                const badge = document.createElement('div');
                badge.className = 'absolute top-2 left-2 bg-green-600/80 text-white text-[9px] px-2 py-0.5 rounded font-bold';
                badge.textContent = 'IMAGE';
                dropZone.appendChild(badge);
            }
        }

        // Show download button if in ImageModule
        if (dropType === 'image') {
            const downBtn = document.getElementById(`btn-down-${sceneId}`);
            if (downBtn) downBtn.classList.remove('hidden');
        }

        // Refresh module to update UI
        if (window.app) {
            const currentModuleId = window.app.currentModuleId;
            setTimeout(() => {
                if (window.app.currentModuleId === currentModuleId) {
                    window.app.route(currentModuleId);
                }
            }, 500);
        }

    } catch (e) {
        console.error(e);
        alert("업로드 실패: " + e.message);
        dropZone.innerHTML = originalContent;
        lucide.createIcons();
    }
};

// Video asset drop handler for VideoModule (legacy, keeping for compatibility)
window.handleVideoAssetDrop = async (event, dropZone) => {
    event.preventDefault();
    dropZone.classList.remove('border-blue-500');

    const sceneId = dropZone.getAttribute('data-scene-id');
    const files = event.dataTransfer.files;

    if (files.length === 0) return;

    const file = files[0];
    const originalContent = dropZone.innerHTML;
    dropZone.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-black/50 text-white"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>`;
    lucide.createIcons();

    try {
        const formData = new FormData();
        formData.append('data', file); // n8n binary property name

        // Helper to get config if not globally available in this scope (it is imported in app.js module but not window)
        // We need to access CONFIG.endpoints.upload. Since CONFIG is module scoped, we might need to expose it or hardcode for now.
        // Better: user AppState or window.app config if available. 
        // Let's assume the module import in app.js makes it available to the class but not window functions.
        // Setup a temporary fix: hardcode or fetch from window.app.config if we expose it.
        // Actually, we can just use the URL directly or update Config to be global.
        // Let's rely on the hardcoded URL matching config.js or try to expose CONFIG on window.
        // For safety/speed, I will use the URL directly here or we expose CONFIG in app.js init.

        // Let's check config.js again.. it exports CONFIG.
        // In app.js: import { CONFIG } from './config.js';
        // We can expose it: window.CONFIG = CONFIG;

        // Wait, I can't modify the import in this replace block easily. 
        // I'll just use the URL string for now to match what I wrote in config.js.
        const uploadUrl = "http://localhost:8000/api/upload-asset";

        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        const result = await response.json();
        const assetUrl = result.url;

        const scenes = AppState.getScenes();
        const scene = scenes.find(s => s.sceneId == sceneId);
        if (!scene) throw new Error('Scene not found');

        if (file.type.startsWith('video/')) {
            scene.videoUrl = assetUrl;
            scene.preferredVisual = 'video';
        } else if (file.type.startsWith('image/')) {
            scene.generatedUrl = assetUrl;
            scene.preferredVisual = 'image';
        }

        AppState.setScenes(scenes);
        AppState.saveToLocalStorage();

        // UI 리프레시 (VideoModule인 경우)
        if (window.app && window.app.currentModule === 'video') {
            window.app.getModule('video').refreshModule();
        } else {
            // 다른 모듈에서 드랍했을 경우의 기본 처리
            if (file.type.startsWith('video/')) {
                dropZone.innerHTML = `<video src="${assetUrl}" class="w-full h-full object-cover" controls></video>`;
            } else if (file.type.startsWith('image/')) {
                dropZone.innerHTML = `<img src="${assetUrl}" class="w-full h-full object-cover">`;
            }
        }

    } catch (e) {
        console.error(e);
        alert("업로드 실패: " + e.message);
        dropZone.innerHTML = originalContent;
    }
};

window.handleVideoFileSelect = (event, sceneId) => {
    // Similar logic needed here if file input is used, but for now user focused on drop.
    // Let's reuse the logic if possible or just warn.
    alert("드래그 앤 드롭을 이용해주세요.");
};

console.log("✅ RealHunalo Studio Initialized (Modular)");
