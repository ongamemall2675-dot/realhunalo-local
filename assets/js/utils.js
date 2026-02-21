// ================================================================
// UTILS - Utility Functions
// ================================================================

import { AppState } from './state.js';

/**
 * Process items in batches with concurrency limit
 */
export async function processInBatches(items, batchSize, asyncFn, onProgress) {
    let completed = 0;
    const total = items.length;
    const results = [];

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(async (item) => {
                const result = await asyncFn(item);
                completed++;
                if (onProgress) onProgress(completed, total);
                return result;
            })
        );
        results.push(...batchResults);
    }
    return results;
}

/**
 * Handle drag-and-drop asset replacement
 */
export function handleAssetDrop(event, dropZone) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove('border-blue-500', 'bg-blue-500/10', 'border-purple-500', 'bg-purple-500/10');

    const sceneId = dropZone.getAttribute('data-scene-id');
    const dropType = dropZone.getAttribute('data-drop-type');
    const files = event.dataTransfer.files;

    if (files.length === 0) return;

    const file = files[0];
    const fileType = file.type;

    if (dropType === 'image' && !fileType.startsWith('image/')) {
        return alert('이미지 파일만 업로드 가능합니다. (JPG, PNG, WebP 등)');
    }
    if (dropType === 'video' && !fileType.startsWith('video/')) {
        return alert('동영상 파일만 업로드 가능합니다. (MP4, WebM 등)');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Data = e.target.result;
        const scene = AppState.getScenes().find(s => s.sceneId == sceneId);

        if (!scene) return console.error('Scene not found:', sceneId);

        if (dropType === 'image') {
            scene.generatedUrl = base64Data;
            const img = document.getElementById(`img-${sceneId}`);
            const placeholder = dropZone.querySelector('.image-placeholder');
            if (img && placeholder) {
                img.src = base64Data;
                img.classList.remove('hidden');
                placeholder.classList.add('hidden');
            }
            console.log(`✅ Scene ${sceneId}: Image replaced via drag-drop`);
        } else if (dropType === 'video') {
            scene.videoUrl = base64Data;
            const videoContainer = dropZone;
            videoContainer.innerHTML = `
                <video src="${base64Data}" class="w-full h-full object-cover cursor-pointer" onclick="window.openLightbox(this.src)" title="클릭하여 크게 보기"></video>
                <div class="absolute bottom-1 right-1 text-[7px] text-slate-500 bg-black/40 px-1 rounded opacity-0 group-hover/video:opacity-100 transition pointer-events-none">
                    📎 Drop to replace
                </div>
            `;
            videoContainer.setAttribute('ondragover', "event.preventDefault(); this.classList.add('border-purple-500', 'bg-purple-500/10');");
            videoContainer.setAttribute('ondragleave', "this.classList.remove('border-purple-500', 'bg-purple-500/10');");
            videoContainer.setAttribute('ondrop', 'window.handleAssetDrop(event, this)');
            console.log(`✅ Scene ${sceneId}: Video replaced via drag-drop`);
        }

        // Success feedback
        const successMsg = document.createElement('div');
        successMsg.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-bounce';
        successMsg.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 inline"></i> Scene ${sceneId} ${dropType === 'image' ? '이미지' : '동영상'} 교체 완료!`;
        document.body.appendChild(successMsg);
        if (window.lucide) lucide.createIcons();
        setTimeout(() => successMsg.remove(), 3000);
    };

    reader.onerror = () => {
        alert('파일 읽기 실패. 다시 시도해주세요.');
    };

    reader.readAsDataURL(file);
}

// Expose globally for inline handlers
window.handleAssetDrop = handleAssetDrop;
