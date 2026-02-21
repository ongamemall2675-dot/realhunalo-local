// ================================================================
// CONFIG - API Endpoints & Global Settings
// ================================================================

// 동적 API Base URL 설정
// localhost에서 접속하면 포트 8000 사용
// 외부 도메인에서 접속하면 /api 상대 경로 사용 (Cloudflare 터널 통해 백엔드 접근)
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;

    // localhost 또는 127.0.0.1이면 명시적으로 8000 포트 사용
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        const url = 'http://localhost:8000';
        console.log('[Config] API Base URL (Local):', url);
        return url;
    }

    // 외부 도메인 (alo.hyehwa72.org 등)에서는 빈 문자열 반환 (상대 경로)
    console.log('[Config] API Base URL (Remote): Relative Path');
    return '';
};

export const API_BASE_URL = getApiBaseUrl();

export const CONFIG = {
    endpoints: {
        script: `${API_BASE_URL}/api/generate-script`,
        image: `${API_BASE_URL}/api/generate-image`,
        motion: `${API_BASE_URL}/api/generate-motion`,
        motionPrompt: `${API_BASE_URL}/api/generate-motion-prompt`,
        tts: `${API_BASE_URL}/api/generate-tts`,
        video: `${API_BASE_URL}/api/generate-video`,
        upload: `${API_BASE_URL}/api/upload-asset`,
        shortsAnalyze: `${API_BASE_URL}/api/shorts/analyze-project`,
        shortsCreate: `${API_BASE_URL}/api/shorts/create/script`, // or /create/highlight based on context
        shortsCreateScript: `${API_BASE_URL}/api/shorts/create/script`,
        shortsCreateHighlight: `${API_BASE_URL}/api/shorts/create/highlight`,
        segmentAudio: `${API_BASE_URL}/api/segment-audio`,
        tasks: `${API_BASE_URL}/api/tasks`,
        imagePromptsBatch: `${API_BASE_URL}/api/generate-image-prompts-batch`,
        batchVrew: `${API_BASE_URL}/api/batch-vrew-from-folder`,
        batchVrewFromLists: `${API_BASE_URL}/api/batch-vrew-from-lists`,
        motionPromptsBatch: `${API_BASE_URL}/api/generate-motion-prompts-batch`,
        youtubeMetadata: `${API_BASE_URL}/api/youtube/metadata`,
        scriptSegment: `${API_BASE_URL}/api/script/segment`,
        thumbnailPrompts: `${API_BASE_URL}/api/youtube/thumbnail/prompts`,
        thumbnailImage: `${API_BASE_URL}/api/youtube/thumbnail/image`,
        videoSettings: `${API_BASE_URL}/api/video/settings`,
        videoStatus: `${API_BASE_URL}/api/video/status`,
        transcribeWhisper: `${API_BASE_URL}/api/transcribe-whisper`, // Added missing endpoint
        checkSavedKeys: `${API_BASE_URL}/api/check-saved-keys`, // Added missing endpoint
        testAiModel: `${API_BASE_URL}/api/test-ai-model`, // Added missing endpoint
        saveApiKey: `${API_BASE_URL}/api/save-api-key`, // Added missing endpoint
        saveYoutubeKey: `${API_BASE_URL}/api/save-youtube-key`, // Added missing endpoint
        googleDriveStatus: `${API_BASE_URL}/api/google-drive/status`, // Added missing endpoint
        googleDriveAuthUrl: `${API_BASE_URL}/api/google-drive/auth-url`, // Added missing endpoint
        ttsValidate: `${API_BASE_URL}/api/tts/validate`, // Added missing endpoint
        exportVrew: `${API_BASE_URL}/api/export-vrew`,
        importVrew: `${API_BASE_URL}/api/import-vrew`
    }
};

console.log('[Config] Configuration loaded:', CONFIG);
