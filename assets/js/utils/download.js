/**
 * Download Helper Utility
 * JSZip을 사용한 파일 다운로드 헬퍼
 */

export class DownloadHelper {
    /**
     * 단일 파일 다운로드
     * @param {string} url - 다운로드할 파일 URL
     * @param {string} filename - 저장할 파일명
     */
    static downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /**
     * JSON 데이터를 파일로 다운로드
     * @param {Object|Array} data - JSON 데이터
     * @param {string} filename - 저장할 파일명
     */
    static downloadJSON(data, filename) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        this.downloadFile(url, filename);
        URL.revokeObjectURL(url);
    }

    /**
     * 여러 파일을 ZIP으로 묶어서 다운로드
     * @param {Array} files - 파일 배열 [{filename, url?, content?}]
     * @param {string} zipFilename - ZIP 파일명
     */
    static async downloadAsZip(files, zipFilename) {
        // JSZip이 로드되어 있는지 확인
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip 라이브러리가 로드되지 않았습니다.');
        }

        const zip = new JSZip();

        for (const file of files) {
            if (file.url) {
                // URL에서 파일 가져오기
                try {
                    const response = await fetch(file.url);
                    const blob = await response.blob();
                    zip.file(file.filename, blob);
                } catch (error) {
                    console.error(`Failed to fetch ${file.filename}:`, error);
                }
            } else if (file.content) {
                // 직접 컨텐츠 추가
                zip.file(file.filename, file.content);
            }
        }

        // ZIP 생성 및 다운로드
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipUrl = URL.createObjectURL(zipBlob);
        this.downloadFile(zipUrl, zipFilename);
        URL.revokeObjectURL(zipUrl);
    }

    /**
     * 텍스트 파일 다운로드
     * @param {string} text - 텍스트 내용
     * @param {string} filename - 저장할 파일명
     */
    static downloadText(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        this.downloadFile(url, filename);
        URL.revokeObjectURL(url);
    }
}
