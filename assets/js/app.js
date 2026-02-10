// ================================================================
// APP - Main Application Entry Point
// ================================================================

import { AppState } from './state.js';
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
import { SettingsModule } from './modules/SettingsModule.js';

// ================================================================
// APP CONTROLLER
// ================================================================

class App {
    constructor() {
        this.modules = [
            new DashboardModule(),
            new ProjectModule(),
            new TrendModule(),
            new YoutubeModule(),
            new ScriptModule(),
            new ImageModule(),
            new MotionModule(),
            new TTSModule(),
            new VideoModule(),
            new ShortsModule(),
            new ShortsEditModule(),
            new SettingsModule()
        ];
        this.currentModuleId = 'dashboard'; // Default start
        this.init();
    }

    init() {
        AppState.loadAutomation(); // Load saved automation settings

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
        nav.innerHTML = this.modules.map(mod => {
            const isActive = this.currentModuleId === mod.id;
            const baseClass = "flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-300 relative overflow-hidden group w-full text-left";
            const activeClass = "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.3)]";
            const inactiveClass = "text-slate-400 hover:bg-white/10 hover:text-white";

            return `
                <button onclick="app.route('${mod.id}')" class="${baseClass} ${isActive ? activeClass : inactiveClass}">
                    ${isActive ? `<div class="absolute left-0 top-0 w-1 h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>` : ''}
                    <i data-lucide="${mod.icon}" class="w-5 h-5 group-hover:scale-110 transition-transform"></i>
                    <span class="font-bold text-sm tracking-wide">${mod.name}</span>
                </button>
                ${(mod.id === 'dashboard' || mod.id === 'youtube') ? '<div class="h-px bg-slate-800 m-2 mx-4"></div>' : ''}
            `;
        }).join('');
        lucide.createIcons();
    }

    async route(moduleId) {
        const mod = this.modules.find(m => m.id === moduleId);
        if (!mod) return;

        // Call onUnmount on previous module
        const previousMod = this.modules.find(m => m.id === this.currentModuleId);
        if (previousMod && previousMod.onUnmount) {
            previousMod.onUnmount();
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
        const content = mod.render();
        main.innerHTML = content instanceof Promise ? await content : content;
        mod.onMount();

        this.renderNav();
        lucide.createIcons();
    }
}

// ================================================================
// GLOBAL INITIALIZATION
// ================================================================

// Create global app instance
const app = new App();
window.app = app;

// Global helper functions for inline handlers
// Generic asset drop handler for all modules
window.handleAssetDrop = async (event, dropZone) => {
    event.preventDefault();
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

        const scene = AppState.getScenes().find(s => s.sceneId == sceneId);
        if (!scene) throw new Error('Scene not found');

        if (file.type.startsWith('video/')) {
            scene.videoUrl = assetUrl;
            dropZone.innerHTML = `<video src="${assetUrl}" class="w-full h-full object-cover" controls></video>`;
        } else if (file.type.startsWith('image/')) {
            scene.generatedUrl = assetUrl;
            dropZone.innerHTML = `<img src="${assetUrl}" class="w-full h-full object-cover">`;
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
