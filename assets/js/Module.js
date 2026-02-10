// ================================================================
// MODULE - Base Class for All Modules
// ================================================================

import { getGuide, hasGuide } from './guides.js';

export class Module {
    constructor(id, name, icon, desc) {
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.desc = desc;
    }

    render() { return ''; }
    onMount() { }
    onUnmount() { }

    // Helper method to refresh the current module
    refreshModule() {
        if (window.app && window.app.currentModuleId === this.id) {
            window.app.route(this.id);
        }
    }

    // ================================================================
    // USER GUIDE SYSTEM
    // ================================================================

    /**
     * Render guide button HTML
     * @returns {string} HTML for guide button
     */
    renderGuideButton() {
        if (!hasGuide(this.id)) {
            return ''; // No guide button if no guide exists
        }

        return `
            <button
                id="btn-show-guide-${this.id}"
                class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg transition-all duration-200 border border-blue-500/30 hover:border-blue-400/50"
                title="사용 가이드 보기"
            >
                <i data-lucide="help-circle" class="w-4 h-4"></i>
                <span>사용 가이드</span>
            </button>
        `;
    }

    /**
     * Show guide modal for this module
     */
    showGuideModal() {
        const guide = getGuide(this.id);
        if (!guide) {
            console.warn(`No guide found for module: ${this.id}`);
            return;
        }

        // Create modal HTML
        const modalHTML = `
            <div id="guide-modal-overlay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div class="bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden border border-slate-600/50">
                    <!-- Header -->
                    <div class="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-slate-600/50 p-6">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="p-2 bg-blue-500/20 rounded-lg">
                                    <i data-lucide="book-open" class="w-6 h-6 text-blue-300"></i>
                                </div>
                                <h2 class="text-2xl font-bold text-white">${guide.title}</h2>
                            </div>
                            <button
                                id="btn-close-guide"
                                class="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                                title="닫기"
                            >
                                <i data-lucide="x" class="w-6 h-6 text-slate-300"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="p-6 overflow-y-auto max-h-[calc(80vh-100px)] space-y-6">
                        ${guide.sections.map(section => this.renderGuideSection(section)).join('')}
                    </div>
                </div>
            </div>
        `;

        // Insert modal into DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Initialize Lucide icons for modal
        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Add event listeners
        document.getElementById('btn-close-guide').addEventListener('click', () => this.closeGuideModal());
        document.getElementById('guide-modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'guide-modal-overlay') {
                this.closeGuideModal();
            }
        });

        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeGuideModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * Render a guide section
     * @param {Object} section - Section object with heading, type, items
     * @returns {string} HTML for section
     */
    renderGuideSection(section) {
        let icon = 'info';
        let iconColor = 'text-blue-400';
        let bgColor = 'bg-blue-500/10';
        let borderColor = 'border-blue-500/30';

        if (section.type === 'steps') {
            icon = 'list-ordered';
            iconColor = 'text-green-400';
            bgColor = 'bg-green-500/10';
            borderColor = 'border-green-500/30';
        } else if (section.type === 'settings') {
            icon = 'settings';
            iconColor = 'text-yellow-400';
            bgColor = 'bg-yellow-500/10';
            borderColor = 'border-yellow-500/30';
        } else if (section.type === 'tips') {
            icon = 'lightbulb';
            iconColor = 'text-purple-400';
            bgColor = 'bg-purple-500/10';
            borderColor = 'border-purple-500/30';
        }

        return `
            <div class="bg-slate-700/30 rounded-xl p-5 border ${borderColor}">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 ${bgColor} rounded-lg">
                        <i data-lucide="${icon}" class="w-5 h-5 ${iconColor}"></i>
                    </div>
                    <h3 class="text-xl font-bold text-white">${section.heading}</h3>
                </div>
                <ul class="space-y-2.5">
                    ${section.items.map(item => `
                        <li class="flex items-start gap-3 text-slate-300">
                            <span class="text-slate-400 mt-1">•</span>
                            <span class="flex-1">${item}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Close guide modal
     */
    closeGuideModal() {
        const modal = document.getElementById('guide-modal-overlay');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Setup guide button event listener (call in onMount)
     */
    setupGuideButton() {
        const guideBtn = document.getElementById(`btn-show-guide-${this.id}`);
        if (guideBtn) {
            guideBtn.addEventListener('click', () => this.showGuideModal());
        }
    }
}
