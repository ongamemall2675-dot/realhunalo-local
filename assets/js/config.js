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
        return 'http://localhost:8000';
    }

    // 외부 도메인 (alo.hyehwa72.org 등)에서는 빈 문자열 반환 (상대 경로)
    return '';
};

export const API_BASE_URL = getApiBaseUrl();

export const CONFIG = {
    endpoints: {
        script: "/api/generate-script",
        image: "/api/generate-image",
        motion: "/api/generate-motion",
        tts: "/api/generate-tts",
        video: "/api/generate-video",
        upload: "/api/upload-asset",
        shortsAnalyze: "/api/analyze-shorts",
        shortsCreate: "/api/create-short"
    }
};
