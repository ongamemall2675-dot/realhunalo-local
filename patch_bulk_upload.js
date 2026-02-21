/**
 * BULK UPLOAD 함수 개선 버전
 * 
 * 적용 방법:
 * 1. ImageModule.js 파일을 엽니다
 * 2. processBulkUpload 함수 (약 2316줄 부근)를 찾습니다
 * 3. Line 2330-2354 부분을 아래 코드로 교체합니다
 */

// ==================== 교체할 코드 시작 ====================
// 파일 분류 및 정렬 로직 (개선된 버전)
const fileMap = new Map(); // sceneNumber -> file
const filesWithoutNumber = []; // 번호가 없는 파일들

for (const file of files) {
    console.log(`[Bulk Upload] Processing file: ${file.name}, type: ${file.type}, lastModified: ${file.lastModified}`);
    const match = file.name.match(/^(\d{3})_/);
    if (match) {
        const sceneNumber = parseInt(match[1], 10);
        fileMap.set(sceneNumber, file);
        console.log(`[Bulk Upload] Matched scene ${sceneNumber}: ${file.name}`);
    } else {
        filesWithoutNumber.push(file);
        console.log(`[Bulk Upload] No number prefix, will sort by date: ${file.name}`);
    }
}

// 번호 없는 파일들을 생성 날짜순(오래된 것부터)으로 정렬
if (filesWithoutNumber.length > 0) {
    filesWithoutNumber.sort((a, b) => a.lastModified - b.lastModified);
    console.log(`[Bulk Upload] Sorted ${filesWithoutNumber.length} files by creation date (oldest first)`);

    // 남은 장면 번호에 순서대로 매칭
    let currentScene = 1;
    for (const file of filesWithoutNumber) {
        // 이미 fileMap에 없는 장면 번호 찾기
        while (fileMap.has(currentScene) && currentScene <= scenes.length) {
            currentScene++;
        }
        if (currentScene <= scenes.length) {
            fileMap.set(currentScene, file);
            console.log(`[Bulk Upload] Auto-assigned scene ${currentScene} to ${file.name} (by date order)`);
            currentScene++;
        } else {
            console.warn(`[Bulk Upload] No available scene for file: ${file.name}`);
        }
    }
}

if (fileMap.size === 0) {
    alert('업로드 가능한 파일이 없습니다.\\n\\n예: 001_image.png, 002_video.mp4\\n또는 번호 없는 파일 (생성 날짜순으로 자동 매칭)');
    return;
}

console.log(`[Bulk Upload] Total files ready: ${fileMap.size} (numbered: ${fileMap.size - filesWithoutNumber.length}, auto-matched: ${filesWithoutNumber.length})`);

const totalFiles = fileMap.size;
const numberedCount = fileMap.size - filesWithoutNumber.length;
const autoMatchedCount = filesWithoutNumber.length;

let confirmMsg = `${totalFiles}개의 파일을 업로드하시겠습니까?\\n\\n`;
if (numberedCount > 0) {
    confirmMsg += `• 번호 패턴 (001_): ${numberedCount}개\\n`;
}
if (autoMatchedCount > 0) {
    confirmMsg += `• 자동 매칭 (날짜순): ${autoMatchedCount}개\\n`;
}

if (!confirm(confirmMsg)) {
    return;
}
// ==================== 교체할 코드 끝 ====================

/**
 * 변경 사항 요약:
 * 
 * 1. 파일 분류 개선:
 *    - 001_ 패턴 파일: 기존대로 장면 번호에 매칭
 *    - 번호 없는 파일: filesWithoutNumber 배열에 수집
 * 
 * 2. 자동 정렬 추가:
 *    - filesWithoutNumber를 lastModified (생성 날짜) 기준으로 정렬
 *    - 가장 오래된 파일부터 장면 1, 2, 3... 순서로 자동 매칭
 * 
 * 3. 사용자 알림 개선:
 *    - 번호 패턴 파일 몇 개인지 표시
 *    - 자동 매칭 파일 몇 개인지 표시
 * 
 * 4. 로깅 강화:
 *    - 각 파일의 lastModified 시간도 로그에 표시
 *    - 자동 매칭 과정을 상세하게 기록
 */
