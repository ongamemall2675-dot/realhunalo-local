import { CONFIG } from '../config.js';

/**
 * Image API Wrapper
 * 미술 작업실에서 백엔드와 통신하는 모든 Fetch 로직을 캡슐화한 클래스입니다.
 */
export class ImageApi {
    /**
     * 단일 이미지 생성 API 호출
     */
    static async generateImage(prompt, settings, referenceImages = {}) {
        const payload = {
            prompt,
            settings: {
                model: settings.model,
                aspectRatio: settings.aspectRatio,
                numOutputs: settings.numOutputs
            }
        };

        if (referenceImages && Object.keys(referenceImages).length > 0) {
            payload.referenceImages = referenceImages;
        }

        const response = await fetch(CONFIG.endpoints.image, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        if (!response.ok) {
            throw new Error(`Server Error (${response.status}): ${responseText}`);
        }

        try {
            return JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Invalid JSON Response`);
        }
    }

    /**
     * 비동기 작업 폴링 (진행률 추적)
     */
    static pollTask(taskId, onProgress = () => { }) {
        return new Promise((resolve, reject) => {
            const iv = setInterval(async () => {
                try {
                    const res = await fetch(`${CONFIG.endpoints.tasks}/${taskId}`);
                    const data = await res.json();

                    if (data.status === 'completed') {
                        clearInterval(iv);
                        resolve(data.result);
                    } else if (data.status === 'failed') {
                        clearInterval(iv);
                        reject(new Error(data.error || '알 수 없는 오류'));
                    } else {
                        onProgress(data.progress || 0);
                    }
                } catch (e) {
                    clearInterval(iv);
                    reject(e);
                }
            }, 1000);
        });
    }

    /**
     * 이미지 프롬프트 일괄 생성 요청
     */
    static async generateImagePromptsBatch(scenes, settings) {
        const response = await fetch(CONFIG.endpoints.imagePromptsBatch, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scenes,
                imgSettings: settings
            })
        });

        if (!response.ok) throw new Error('이미지 프롬프트 생성 요청 실패');

        const data = await response.json();
        if (!data.taskId) throw new Error('Task ID를 받지 못했습니다');

        return data.taskId;
    }

    /**
     * 모션 프롬프트 일괄 생성 요청
     */
    static async generateMotionPromptsBatch(scenes) {
        const response = await fetch(CONFIG.endpoints.motionPromptsBatch, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scenes })
        });

        if (!response.ok) throw new Error('모션 프롬프트 생성 요청 실패');

        const data = await response.json();
        if (!data.taskId) throw new Error('Task ID를 받지 못했습니다');

        return data.taskId;
    }

    /**
     * 단일 에셋 업로드 (이미지 일괄 업로드 시 사용)
     */
    static async uploadAsset(file) {
        const form = new FormData();
        form.append('data', file);

        const response = await fetch(CONFIG.endpoints.uploadAsset || 'http://localhost:8000/api/upload-asset', {
            method: 'POST',
            body: form
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    }

    /**
     * 이미지 다운로드를 위한 Blob Fetch
     */
    static async fetchImageBlob(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.blob();
    }
}
