/**
 * REALHUNAL O Frontend 디버깅 가이드
 * 
 * 메뉴가 안 보이는 문제 해결 방법
 */

// ==========================================
// 1단계: 브라우저 개발자 도구 열기
// ==========================================
// F12 키를 누르세요

// ==========================================
// 2단계: Console 탭 확인
// ==========================================
// 빨간색 에러 메시지가 있는지 확인하세요
// 주로 다음과 같은 에러가 발생합니다:
// - "Failed to load module"
// - "Uncaught SyntaxError"
// - "Uncaught TypeError"
// - "404 Not Found"

// ==========================================
// 3단계: Network 탭 확인
// ==========================================
// 1. Network 탭 클릭
// 2. 페이지 새로고침 (Ctrl + R)
// 3. 빨간색(실패)으로 표시된 파일 확인
// 4. 특히 .js 파일이 404인지 확인

// ==========================================
// 4단계: Console에서 직접 테스트
// ==========================================
// Console 탭에서 아래 명령어를 입력하고 Enter:

console.log('=== RealHunalo Debug Info ===');
console.log('1. app 객체:', window.app);
console.log('2. 모듈 수:', window.app?.modules?.length);
console.log('3. 현재 모듈:', window.app?.currentModuleId);
console.log('4. nav 요소:', document.getElementById('main-nav'));
console.log('5. nav HTML:', document.getElementById('main-nav')?.innerHTML);

// ==========================================
// 5단계: 강제 메뉴 렌더링 시도
// ==========================================
// Console에서 아래 명령어 실행:

if (window.app) {
    window.app.renderNav();
    lucide.createIcons();
    console.log('✅ 메뉴 렌더링 시도 완료');
} else {
    console.error('❌ app 객체가 없습니다. JavaScript 로드 실패');
}

// ==========================================
// 6단계: 모듈별 체크
// ==========================================
// Console에서 실행하여 어떤 모듈이 로드 안 되었는지 확인:

const modules = [
    'DashboardModule',
    'ProjectModule',
    'TrendModule',
    'YoutubeModule',
    'ScriptModule',
    'ImageModule',
    'MotionModule',
    'TTSModule',
    'VideoModule',
    'ShortsModule'
];

modules.forEach(mod => {
    try {
        const path = `./modules/${mod}.js`;
        import(path).then(() => {
            console.log(`✅ ${mod} 로드 성공`);
        }).catch(err => {
            console.error(`❌ ${mod} 로드 실패:`, err.message);
        });
    } catch (e) {
        console.error(`❌ ${mod} import 에러:`, e.message);
    }
});

// ==========================================
// 예상되는 문제들
// ==========================================

/**
 * 문제 1: 모듈 파일 404 에러
 * 해결: 파일이 실제로 존재하는지 확인
 * 
 * 문제 2: CORS 에러
 * 해결: 서버가 localhost에서 실행 중인지 확인
 * 
 * 문제 3: JavaScript Syntax 에러
 * 해결: 최근 수정한 파일 확인 (특히 ImageModule.js)
 * 
 * 문제 4: lucide 아이콘 라이브러리 로드 실패
 * 해결: 인터넷 연결 확인
 * 
 * 문제 5: app 객체가 undefined
 * 해결: app.js가 제대로 실행되지 않음. Console 에러 확인
 */

// ==========================================
// 긴급 해결책: 최소 메뉴 수동 추가
// ==========================================
// Console에서 아래 코드 실행:

document.getElementById('main-nav').innerHTML = `
    <button onclick="location.reload()" class="flex items-center gap-4 px-6 py-3.5 rounded-xl bg-blue-500/20 text-blue-400 w-full text-left mb-1 mx-2">
        <span class="font-bold text-[13px]">🔄 새로고침</span>
    </button>
    <button onclick="alert('대본 모듈')" class="flex items-center gap-4 px-6 py-3.5 rounded-xl hover:bg-white/5 text-slate-400 w-full text-left mb-1 mx-2">
        <span class="font-bold text-[13px]">📝 대본</span>
    </button>
    <button onclick="alert('이미지 모듈')" class="flex items-center gap-4 px-6 py-3.5 rounded-xl hover:bg-white/5 text-slate-400 w-full text-left mb-1 mx-2">
        <span class="font-bold text-[13px]">🖼️ 이미지</span>
    </button>
`;

console.log('✅ 임시 메뉴 추가 완료');
