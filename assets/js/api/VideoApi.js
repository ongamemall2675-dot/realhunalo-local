import { CONFIG } from '../config.js';

/**
 * Video API Wrapper
 * 최종 편집실에서 백엔드와 통신하는 모든 Fetch 로직을 캡슐화한 클래스입니다.
 */
export class VideoApi {
    /**
     * 비디오 설정 조회
     */
    static async fetchSettings() {
        const response = await fetch(CONFIG.endpoints.videoSettings);
        if (!response.ok) throw new Error('Failed to load video settings');
        return await response.json();
    }

    /**
     * 비디오 설정 업데이트
     */
    static async updateSettings(settings) {
        const response = await fetch(CONFIG.endpoints.videoSettings, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (!response.ok) throw new Error('Failed to update video settings');
        return await response.json();
    }

    /**
     * 서비스 상태 조회 (진행 통계 등)
     */
    static async fetchServiceStatus() {
        const response = await fetch(CONFIG.endpoints.videoStatus);
        if (!response.ok) throw new Error('Failed to load video service status');
        return await response.json();
    }

    /**
     * 최종 영상 생성 시작
     */
    static async generateFinalVideo(timelineData) {
        const response = await fetch(CONFIG.endpoints.video, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(timelineData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to start video generation: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Vrew 프로젝트 내보내기 시작
     */
    static async exportToVrew(timelineData) {
        const response = await fetch(CONFIG.endpoints.exportVrew, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(timelineData)
        });

        if (!response.ok) throw new Error('Failed to start Vrew export');
        return await response.json();
    }

    /**
     * Vrew 프로젝트 가져오기
     */
    static async importFromVrew(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(CONFIG.endpoints.importVrew, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to import VREW file');
        }

        return await response.json();
    }

    /**
     * 특정 Task 상태 조회
     */
    static async getTaskStatus(taskId) {
        const response = await fetch(`${CONFIG.endpoints.tasks}/${taskId}`);
        if (!response.ok) throw new Error('Task not found');
        return await response.json();
    }

    /**
     * YouTube 메타데이터 자동 생성
     */
    static async generateMetadata(script) {
        const response = await fetch(CONFIG.endpoints.youtubeMetadata, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script })
        });

        const data = await response.json();
        return { ok: response.ok, data };
    }

    /**
     * YouTube 썸네일 프롬프트 자동 생성
     */
    static async generateThumbnailPrompts(script) {
        const response = await fetch(CONFIG.endpoints.thumbnailPrompts, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script })
        });

        const data = await response.json();
        return { ok: response.ok, data };
    }

    /**
     * 썸네일 이미지 생성
     */
    static async generateThumbnailImage(prompt, aspectRatio = '16:9') {
        const response = await fetch(CONFIG.endpoints.thumbnailImage, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, aspectRatio })
        });

        const data = await response.json();
        return { ok: response.ok, data };
    }

    /**
     * 모션 프롬프트 생성 (AI)
     */
    static async generateMotionPrompt(originalScript, imagePrompt) {
        const response = await fetch(CONFIG.endpoints.motionPrompt, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalScript, imagePrompt })
        });

        return await response.json();
    }

    /**
     * 단일 모션 생성
     */
    static async generateMotion(payload) {
        const response = await fetch(CONFIG.endpoints.motion, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        return await response.json();
    }
}
