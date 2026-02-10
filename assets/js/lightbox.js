// ================================================================
// LIGHTBOX - Image & Video Viewer
// ================================================================

const lightboxOverlay = document.getElementById('lightbox-overlay');
const lightboxContent = document.getElementById('lightbox-content');
const lightboxClose = document.getElementById('lightbox-close');

export function openLightbox(content, type = 'auto') {
    // Type을 명시적으로 지정하거나 자동 감지
    if (type === 'image' || (type === 'auto' && (content.match(/\.(jpeg|jpg|gif|png|webp)$/) || content.startsWith('data:image')))) {
        lightboxContent.innerHTML = `<img src="${content}" class="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain">`;
    } else if (type === 'video' || (type === 'auto' && content.match(/\.(mp4|webm)$/))) {
        lightboxContent.innerHTML = `<video src="${content}" controls autoplay class="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"></video>`;
    } else {
        lightboxContent.innerHTML = content;
    }

    lightboxOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

export function openVideoLightbox(src) {
    lightboxContent.innerHTML = `
        <div class="relative w-[80vw] max-w-4xl aspect-video">
            <video src="${src}" controls autoplay class="w-full h-full rounded-xl shadow-2xl bg-black"></video>
        </div>
    `;
    lightboxOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightboxOverlay.classList.add('hidden');
    lightboxContent.innerHTML = '';
    document.body.style.overflow = '';
}

// Event Listeners
if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightboxOverlay) {
    lightboxOverlay.addEventListener('click', (e) => {
        if (e.target === lightboxOverlay) closeLightbox();
    });
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lightboxOverlay.classList.contains('hidden')) closeLightbox();
});

// Expose globally
window.openLightbox = openLightbox;
window.openVideoLightbox = openVideoLightbox;
