// ================================================================
// IMAGE MODULE - 미술 작업실
// VideoModule과 동일한 수준의 UI/UX
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG } from '../config.js';
import { processInBatches } from '../utils.js';
import { imageCache } from '../cache.js';

// 화풍 카테고리 정의
const STYLE_CATEGORIES = {
    stickman: {
        name: '스틱맨 (졸라맨)',
        prompt: 'simple stickman style, minimalist stick figure, blue shirt, red tie, clean lines, 2D flat design',
        description: '심플한 스틱맨 캐릭터, 파란 셔츠와 빨간 넥타이'
    },
    animation: {
        name: '애니메이션',
        prompt: 'anime style, animation, cel shaded, vibrant colors',
        description: '일본 애니메이션 스타일, 밝고 선명한 색감'
    },
    european_graphic_novel: {
        name: '유럽풍 그래픽 노블',
        prompt: 'European graphic novel style, bande dessinée, ligne claire, ink and watercolor',
        description: '유럽 만화 스타일, 명확한 선과 수채화 기법'
    },
    hand_drawn: {
        name: '손그림 스타일',
        prompt: 'hand drawn sketch style, pencil drawing, rough sketch, artistic',
        description: '자연스러운 손그림 느낌, 스케치 터치'
    },
    cinematic_photorealistic: {
        name: '시네마틱 실사',
        prompt: 'cinematic photorealistic, film photography, dramatic lighting, depth of field',
        description: '영화 같은 실사 스타일, 극적인 조명과 구도'
    },
    kdrama_realistic: {
        name: 'K-드라마 실사',
        prompt: 'Korean drama style, soft romantic lighting, emotional atmosphere, modern Korean aesthetic',
        description: '한국 드라마 특유의 감성적이고 따뜻한 실사 스타일'
    },
    noir: {
        name: '느와르',
        prompt: 'film noir style, high contrast, dramatic shadows, black and white, vintage detective',
        description: '흑백 영화 스타일, 강렬한 명암 대비'
    },
    webtoon: {
        name: '웹툰',
        prompt: 'Korean webtoon style, digital comic, clean lines, vibrant colors, modern illustration',
        description: '한국 웹툰 스타일, 깔끔한 선과 밝은 색감'
    },
    '3d_animation': {
        name: '3D 애니메이션',
        prompt: '3D animation style, Pixar style, CGI, smooth rendering, cartoon 3D',
        description: '픽사 스타일의 3D 애니메이션, 부드러운 렌더링'
    },
    claymation: {
        name: '클레이 애니메이션',
        prompt: 'claymation style, stop motion, clay models, tactile texture, handcrafted',
        description: '점토 인형 스톱모션 스타일, 수작업 질감'
    },
    fairy_tale_illustration: {
        name: '동화 일러스트',
        prompt: 'fairy tale illustration, storybook art, whimsical, soft colors, children book style',
        description: '동화책 일러스트 스타일, 환상적이고 부드러운 색감'
    },
    wool_felt_doll: {
        name: '동화 양모인형',
        prompt: 'wool felt doll style, needle felting, soft fuzzy texture, handmade crafts',
        description: '양모 펠트 인형 스타일, 따뜻하고 포근한 질감'
    },
    diorama: {
        name: '디오라마',
        prompt: 'diorama style, miniature scene, tilt-shift photography, tiny detailed model',
        description: '미니어처 모형 디오라마, 틸트 시프트 효과'
    },
    emotional_historical_illustration: {
        name: '감성 사극 일러스트',
        prompt: 'emotional Korean historical drama illustration, traditional hanbok, soft brush strokes, nostalgic atmosphere',
        description: '한국 사극 감성 일러스트, 전통 한복과 서정적 분위기'
    },
    web_novel_signature: {
        name: '웹소설 시그니쳐',
        prompt: 'web novel cover illustration, fantasy romance style, detailed character art, dramatic composition',
        description: '웹소설 표지 스타일, 판타지 로맨스 감성'
    },
    oriental_folklore_illustration: {
        name: '동양 설화 일러스트',
        prompt: 'oriental folklore illustration, Asian mythology, traditional ink painting elements, mystical atmosphere',
        description: '동양 설화 일러스트, 수묵화 요소와 신비로운 분위기'
    },
    ghibli: {
        name: '지브리',
        prompt: 'Studio Ghibli style, Miyazaki inspired, hand painted animation, whimsical nature, nostalgic',
        description: '지브리 스튜디오 애니메이션 스타일, 따뜻하고 향수적'
    },
    vintage: {
        name: '빈티지',
        prompt: 'vintage style, retro aesthetic, aged paper texture, faded colors, nostalgic',
        description: '복고풍 스타일, 오래된 종이 질감과 바랜 색감'
    },
    watercolor: {
        name: '수채화',
        prompt: 'watercolor painting, soft blending, fluid strokes, gentle colors, artistic',
        description: '수채화 기법, 부드러운 번짐과 은은한 색감'
    },
    illustration: {
        name: '일러스트',
        prompt: 'digital illustration, modern art style, clean and polished, professional artwork',
        description: '현대적 디지털 일러스트, 깔끔하고 세련됨'
    },
    flat_vector: {
        name: '플랫 벡터',
        prompt: 'flat vector style, minimal design, geometric shapes, solid colors, modern graphic design',
        description: '플랫 디자인 벡터 스타일, 미니멀하고 기하학적'
    },
    oil_painting: {
        name: '유화',
        prompt: 'oil painting style, thick brush strokes, rich texture, classical art, impasto technique',
        description: '유화 기법, 두꺼운 붓터치와 풍부한 질감'
    },
    pencil_drawing: {
        name: '연필그림',
        prompt: 'pencil drawing, graphite sketch, detailed shading, realistic pencil art, black and white',
        description: '연필 스케치 스타일, 섬세한 음영 표현'
    },
    pixel_art: {
        name: '픽셀아트',
        prompt: 'pixel art style, 8-bit retro, blocky pixels, video game aesthetic, nostalgic gaming',
        description: '픽셀 아트 스타일, 8비트 레트로 게임 감성'
    },
    low_poly: {
        name: '로우폴리',
        prompt: 'low poly 3D style, geometric facets, minimal polygons, modern 3D art, angular shapes',
        description: '로우 폴리곤 3D 스타일, 각진 기하학적 면'
    },
    origami: {
        name: '오리가미',
        prompt: 'origami paper craft style, folded paper art, geometric paper sculpture, clean edges',
        description: '종이접기 스타일, 기하학적 종이 조각'
    },
    comic_book: {
        name: '만화책',
        prompt: 'comic book style, bold outlines, halftone dots, speech bubbles, superhero aesthetic',
        description: '미국 코믹북 스타일, 강렬한 외곽선과 망점'
    },
    neon_punk: {
        name: '네온펑크',
        prompt: 'neon punk style, cyberpunk aesthetic, glowing neon lights, futuristic urban, vibrant electric colors',
        description: '네온 사이버펑크 스타일, 미래적 도시와 형광색'
    },
    '3d_model': {
        name: '3D 모델',
        prompt: '3D render, photorealistic 3D model, clean rendering, studio lighting, product visualization',
        description: '사실적 3D 렌더링, 스튜디오 조명'
    },
    craft_clay: {
        name: '공예/점토',
        prompt: 'clay craft style, ceramic pottery, handmade clay sculpture, artisan crafts, tactile texture',
        description: '점토 공예 스타일, 도자기와 수공예 질감'
    }
};

export class ImageModule extends Module {
    constructor() {
        super('image', '미술 작업실', 'palette', '분석된 장면을 시각화합니다.');

        // 이미지 생성 설정
        this.imageSettings = {
            model: 'black-forest-labs/flux-schnell',
            aspectRatio: '16:9',
            numOutputs: 1,
            outputQuality: 90,
            style: 'stickman' // 화풍 선택 (기본값: stickman - 파란 셔츠, 빨간 넥타이)
        };

        // 레퍼런스 이미지 (Whisk 스타일) - localStorage에서 로드
        this.referenceImages = this.loadReferenceImages();

        // 화풍 카테고리 (클래스 인스턴스에서 접근 가능하도록)
        this.styleCategories = STYLE_CATEGORIES;

        // 통계 (클라이언트 사이드)
        this.stats = {
            totalGenerated: 0,
            successCount: 0,
            errorCount: 0,
            totalProcessingTime: 0
        };

        this.startTime = null;
    }

    render() {
        const scenes = AppState.getScenes();
        const readyScenes = this.countSceneStatus(scenes);

        const standalonePanel = this.renderStandalonePanel();
        const manualAddPanel = this.renderManualAddPanel();

        if (scenes.length === 0) {
            return `
                <div class="max-w-4xl mx-auto slide-up space-y-6">
                    ${standalonePanel}
                    ${manualAddPanel}
                    
                    <div class="text-center p-10 text-slate-500 border border-dashed border-slate-700 rounded-2xl">
                        <i data-lucide="image" class="w-12 h-12 mx-auto mb-4 opacity-50"></i>
                        <h3 class="text-lg font-bold">장면이 없습니다</h3>
                        <p class="text-sm mt-2">위에서 장면을 수동으로 추가하거나, 대본 분석실에서 분석을 진행하세요.</p>
                    </div>
                </div>
            `;
        }

        const sceneRows = scenes.map(scene => this.renderSceneRow(scene)).join('');

        return `
            <div class="max-w-7xl mx-auto slide-up space-y-6">
                <div class="flex items-center gap-2">
                    <!-- User Guide Button -->
                    ${this.renderGuideButton()}

                    <!-- Reset Button -->
                    <button id="btn-reset-image" class="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 rounded-xl text-xs font-bold transition">
                        <i data-lucide="refresh-ccw" class="w-3.5 h-3.5"></i>
                        초기화
                    </button>
                </div>

                <!-- Retroactive Style Change Panel -->
                <div class="bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/30 rounded-2xl p-5">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                                <i data-lucide="palette" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-white">화풍 변경 (이미 생성된 프롬프트)</h3>
                                <p class="text-xs text-slate-500">모든 이미지 프롬프트의 스타일을 일괄 변경합니다</p>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-end gap-3">
                        <div class="flex-1">
                            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">새로운 화풍 선택</label>
                            <select id="retroactive-style-selector" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                                <option value="none">기본 (스타일 없음)</option>
                                <optgroup label="애니메이션">
                                    <option value="animation">애니메이션</option>
                                    <option value="ghibli">지브리</option>
                                    <option value="3d_animation">3D 애니메이션</option>
                                    <option value="claymation">클레이 애니메이션</option>
                                    <option value="webtoon">웹툰</option>
                                </optgroup>
                                <optgroup label="사실적">
                                    <option value="cinematic_photorealistic">시네마틱 실사</option>
                                    <option value="kdrama_realistic">K-드라마 실사</option>
                                    <option value="noir">느와르</option>
                                </optgroup>
                                <optgroup label="일러스트">
                                    <option value="european_graphic_novel">유럽풍 그래픽 노블</option>
                                    <option value="hand_drawn">손그림 스타일</option>
                                    <option value="fairy_tale_illustration">동화 일러스트</option>
                                    <option value="emotional_historical_illustration">감성 사극 일러스트</option>
                                    <option value="web_novel_signature">웹소설 시그니쳐</option>
                                    <option value="oriental_folklore_illustration">동양 설화 일러스트</option>
                                    <option value="illustration">일러스트</option>
                                </optgroup>
                                <optgroup label="회화">
                                    <option value="watercolor">수채화</option>
                                    <option value="oil_painting">유화</option>
                                    <option value="pencil_drawing">연필그림</option>
                                    <option value="vintage">빈티지</option>
                                </optgroup>
                                <optgroup label="디자인">
                                    <option value="flat_vector">플랫 벡터</option>
                                    <option value="pixel_art">픽셀아트</option>
                                    <option value="low_poly">로우폴리</option>
                                    <option value="origami">오리가미</option>
                                    <option value="comic_book">만화책</option>
                                    <option value="neon_punk">네온펑크</option>
                                </optgroup>
                                <optgroup label="공예">
                                    <option value="wool_felt_doll">동화 양모인형</option>
                                    <option value="diorama">디오라마</option>
                                    <option value="craft_clay">공예/점토</option>
                                    <option value="3d_model">3D 모델</option>
                                </optgroup>
                            </select>
                        </div>
                        <button id="btn-apply-retroactive-style" class="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold shadow-lg shadow-purple-600/20 transition flex items-center gap-2">
                            <i data-lucide="wand-2" class="w-4 h-4"></i>
                            스타일 적용 (프롬프트 재생성)
                        </button>
                    </div>

                    <div class="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
                        <i data-lucide="alert-triangle" class="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0"></i>
                        <p class="text-xs text-yellow-300/90">
                            <strong>주의:</strong> 모든 씬의 이미지 프롬프트가 새로운 스타일로 재생성됩니다.
                            이미 생성된 이미지는 변경되지 않으며, 새로 생성해야 적용됩니다.
                        </p>
                    </div>
                </div>

                <!-- Settings Panel -->
                ${this.renderSettingsPanel()}

                <!-- Status Bar -->
                <div class="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                    <div class="flex items-center gap-4">
                        <span class="text-sm font-bold text-slate-400">
                            총 <b class="text-white">${scenes.length}</b>개 장면
                        </span>
                        <span class="text-xs text-slate-500">|</span>
                        <span class="text-sm text-slate-400">
                            완료: <b class="text-green-400">${readyScenes.complete}</b>
                            <span class="text-slate-600 mx-1">/</span>
                            대기: <b class="text-yellow-400">${readyScenes.pending}</b>
                            <span class="text-slate-600 mx-1">/</span>
                            오류: <b class="text-red-400">${readyScenes.error}</b>
                        </span>
                    </div>
                    <div class="flex gap-3">
                        <button id="btn-gen-all" class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2">
                            <i data-lucide="play" class="w-4 h-4"></i> 전체 일괄 생성
                        </button>
                        <button id="btn-down-all" class="bg-slate-700 hover:bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="download-cloud" class="w-4 h-4"></i> 일괄 다운로드
                        </button>
                        <button id="btn-down-prompts" class="bg-slate-700 hover:bg-purple-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="file-text" class="w-4 h-4"></i> 프롬프트 다운로드
                        </button>
                    </div>
                </div>

                <!-- Progress Display (Hidden by default) -->
                <div id="batch-progress-container" class="hidden bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700 rounded-2xl p-6 shadow-2xl">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="relative">
                                <i data-lucide="loader-2" class="w-6 h-6 text-indigo-400 animate-spin"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white">일괄 이미지 생성 중...</h3>
                                <p id="batch-elapsed-time" class="text-xs text-slate-500">경과 시간: 0:00</p>
                            </div>
                        </div>
                        <div id="batch-progress-percent" class="text-3xl font-black text-indigo-400">0%</div>
                    </div>
                    <div class="mb-3">
                        <div class="w-full bg-slate-900 rounded-full h-3 overflow-hidden">
                            <div id="batch-progress-bar" class="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-600 transition-all duration-500 relative" style="width: 0%">
                                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                            </div>
                        </div>
                        <p id="batch-progress-message" class="text-sm text-slate-400 mt-3 font-medium">준비 중...</p>
                    </div>
                </div>

                <!-- Scene List -->
                <div class="bg-slate-800/20 border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl">
                    <table class="w-full text-left table-fixed">
                        <thead class="bg-slate-900/60 border-b border-slate-700">
                            <tr>
                                <th class="py-4 pl-6 text-[10px] font-black text-slate-500 uppercase tracking-widest w-16">상태</th>
                                <th class="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-1/4">대본(한글)</th>
                                <th class="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-1/3">이미지 프롬프트</th>
                                <th class="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">미리보기</th>
                                <th class="py-4 pr-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest w-28">액션</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sceneRows}
                        </tbody>
                    </table>
                </div>

                <!-- Stats Panel (Initially hidden) -->
                <div id="image-stats-panel" class="hidden bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4">
                    <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Image Generation Stats</h4>
                    <div class="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <div id="stat-total-generated" class="text-2xl font-bold text-white">${this.stats.totalGenerated}</div>
                            <div class="text-[10px] text-slate-500">총 생성</div>
                        </div>
                        <div>
                            <div id="stat-success-count" class="text-2xl font-bold text-green-400">${this.stats.successCount}</div>
                            <div class="text-[10px] text-slate-500">성공</div>
                        </div>
                        <div>
                            <div id="stat-error-count" class="text-2xl font-bold text-red-400">${this.stats.errorCount}</div>
                            <div class="text-[10px] text-slate-500">오류</div>
                        </div>
                        <div>
                            <div id="stat-avg-time" class="text-2xl font-bold text-blue-400">${this.stats.totalProcessingTime > 0 ? (this.stats.totalProcessingTime / this.stats.totalGenerated).toFixed(1) : '-'}</div>
                            <div class="text-[10px] text-slate-500">평균 시간(s)</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderSettingsPanel() {
        return `
            <div class="bg-gradient-to-r from-slate-800/60 to-purple-900/20 border border-slate-700/50 rounded-2xl p-5">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                            <i data-lucide="settings-2" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-white">이미지 생성 설정</h3>
                            <p class="text-xs text-slate-500">Flux 모델 사용 (Replicate API)</p>
                        </div>
                    </div>
                    <button id="btn-toggle-stats" class="text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1">
                        <i data-lucide="bar-chart-3" class="w-3 h-3"></i> 통계 보기
                    </button>
                    <button id="btn-clear-cache" class="text-xs text-slate-500 hover:text-red-400 transition flex items-center gap-1 ml-3">
                        <i data-lucide="trash" class="w-3 h-3"></i> 캐시 비우기
                    </button>
                </div>

                <div class="grid grid-cols-4 gap-4">
                    <!-- Model -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">모델</label>
                        <select id="image-model" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                            <option value="black-forest-labs/flux-schnell" ${this.imageSettings.model === 'black-forest-labs/flux-schnell' ? 'selected' : ''}>Flux Schnell (빠름)</option>
                            <option value="black-forest-labs/flux-pro" ${this.imageSettings.model === 'black-forest-labs/flux-pro' ? 'selected' : ''}>Flux Pro (고품질)</option>
                            <option value="black-forest-labs/flux-dev" ${this.imageSettings.model === 'black-forest-labs/flux-dev' ? 'selected' : ''}>Flux Dev (실험)</option>
                            <option value="google/nano-banana" ${this.imageSettings.model === 'google/nano-banana' ? 'selected' : ''}>나노 바나나 (Google)</option>
                            <option value="google/nano-banana-pro" ${this.imageSettings.model === 'google/nano-banana-pro' ? 'selected' : ''}>나노 바나나 프로 (Google)</option>
                            <option value="prunaai/hidream-l1-fast" ${this.imageSettings.model === 'prunaai/hidream-l1-fast' ? 'selected' : ''}>HiDream L1 Fast (Pruna AI)</option>
                            <option value="bytedance/seedream-4" ${this.imageSettings.model === 'bytedance/seedream-4' ? 'selected' : ''}>SeeDream 4 (ByteDance)</option>
                        </select>
                    </div>

                    <!-- Aspect Ratio -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">화면 비율</label>
                        <select id="image-aspect-ratio" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                            <option value="16:9" ${this.imageSettings.aspectRatio === '16:9' ? 'selected' : ''}>16:9 (가로)</option>
                            <option value="9:16" ${this.imageSettings.aspectRatio === '9:16' ? 'selected' : ''}>9:16 (세로)</option>
                            <option value="1:1" ${this.imageSettings.aspectRatio === '1:1' ? 'selected' : ''}>1:1 (정사각)</option>
                            <option value="4:3" ${this.imageSettings.aspectRatio === '4:3' ? 'selected' : ''}>4:3 (클래식)</option>
                            <option value="3:2" ${this.imageSettings.aspectRatio === '3:2' ? 'selected' : ''}>3:2 (사진)</option>
                        </select>
                    </div>

                    <!-- Num Outputs -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">출력 수</label>
                        <select id="image-num-outputs" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                            <option value="1" ${this.imageSettings.numOutputs === 1 ? 'selected' : ''}>1개 (기본)</option>
                            <option value="2" ${this.imageSettings.numOutputs === 2 ? 'selected' : ''}>2개</option>
                            <option value="4" ${this.imageSettings.numOutputs === 4 ? 'selected' : ''}>4개 (선택)</option>
                        </select>
                    </div>

                    <!-- Quality -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">품질</label>
                        <select id="image-quality" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                            <option value="70" ${this.imageSettings.outputQuality === 70 ? 'selected' : ''}>70 (낮음)</option>
                            <option value="85" ${this.imageSettings.outputQuality === 85 ? 'selected' : ''}>85 (보통)</option>
                            <option value="90" ${this.imageSettings.outputQuality === 90 ? 'selected' : ''}>90 (높음)</option>
                            <option value="95" ${this.imageSettings.outputQuality === 95 ? 'selected' : ''}>95 (최고)</option>
                        </select>
                    </div>
                </div>

                <!-- 화풍 선택 -->
                <div class="mt-4 pt-4 border-t border-slate-700/50">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="palette" class="w-4 h-4 text-purple-400"></i>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">🎨 화풍 스타일 선택</label>
                        <span class="text-[9px] text-slate-600 ml-auto">대본 분석 시 자동 적용</span>
                    </div>
                    <select id="image-style" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                        <option value="stickman" ${this.imageSettings.style === 'stickman' || !this.imageSettings.style || this.imageSettings.style === 'none' ? 'selected' : ''}>⭐ 스틱맨 (졸라맨) - 파란 셔츠, 빨간 넥타이 (기본)</option>
                        <option value="none" ${this.imageSettings.style === 'none' ? 'selected' : ''}>🚫 스타일 미적용</option>

                        <!-- 애니메이션 & 만화 스타일 -->
                        <optgroup label="📺 애니메이션 & 만화 스타일">
                            <option value="animation" ${this.imageSettings.style === 'animation' ? 'selected' : ''}>애니메이션 - 일본 애니메이션, 밝고 선명한 색감</option>
                            <option value="ghibli" ${this.imageSettings.style === 'ghibli' ? 'selected' : ''}>지브리 - 미야자키 스타일, 따뜻하고 향수적</option>
                            <option value="webtoon" ${this.imageSettings.style === 'webtoon' ? 'selected' : ''}>웹툰 - 한국 웹툰, 깔끔한 선과 밝은 색감</option>
                            <option value="comic_book" ${this.imageSettings.style === 'comic_book' ? 'selected' : ''}>만화책 - 미국 코믹북, 강렬한 외곽선과 망점</option>
                            <option value="european_graphic_novel" ${this.imageSettings.style === 'european_graphic_novel' ? 'selected' : ''}>유럽풍 그래픽 노블 - 명확한 선과 수채화</option>
                            <option value="3d_animation" ${this.imageSettings.style === '3d_animation' ? 'selected' : ''}>3D 애니메이션 - 픽사 스타일, 부드러운 렌더링</option>
                            <option value="claymation" ${this.imageSettings.style === 'claymation' ? 'selected' : ''}>클레이 애니메이션 - 점토 인형, 수작업 질감</option>
                        </optgroup>

                        <!-- 실사 & 시네마틱 -->
                        <optgroup label="🎬 실사 & 시네마틱">
                            <option value="cinematic_photorealistic" ${this.imageSettings.style === 'cinematic_photorealistic' ? 'selected' : ''}>시네마틱 실사 - 영화 같은 실사, 극적인 조명</option>
                            <option value="kdrama_realistic" ${this.imageSettings.style === 'kdrama_realistic' ? 'selected' : ''}>K-드라마 실사 - 한국 드라마, 감성적 실사</option>
                            <option value="noir" ${this.imageSettings.style === 'noir' ? 'selected' : ''}>느와르 - 흑백 영화, 강렬한 명암 대비</option>
                        </optgroup>

                        <!-- 일러스트 & 그림 -->
                        <optgroup label="✏️ 일러스트 & 그림">
                            <option value="illustration" ${this.imageSettings.style === 'illustration' ? 'selected' : ''}>일러스트 - 현대적 디지털 일러스트</option>
                            <option value="hand_drawn" ${this.imageSettings.style === 'hand_drawn' ? 'selected' : ''}>손그림 스타일 - 자연스러운 스케치 터치</option>
                            <option value="fairy_tale_illustration" ${this.imageSettings.style === 'fairy_tale_illustration' ? 'selected' : ''}>동화 일러스트 - 동화책, 환상적 색감</option>
                            <option value="emotional_historical_illustration" ${this.imageSettings.style === 'emotional_historical_illustration' ? 'selected' : ''}>감성 사극 일러스트 - 한국 사극, 전통 한복</option>
                            <option value="web_novel_signature" ${this.imageSettings.style === 'web_novel_signature' ? 'selected' : ''}>웹소설 시그니쳐 - 판타지 로맨스 표지</option>
                            <option value="oriental_folklore_illustration" ${this.imageSettings.style === 'oriental_folklore_illustration' ? 'selected' : ''}>동양 설화 일러스트 - 수묵화 요소, 신비로운 분위기</option>
                        </optgroup>

                        <!-- 페인팅 기법 -->
                        <optgroup label="🖌️ 페인팅 기법">
                            <option value="watercolor" ${this.imageSettings.style === 'watercolor' ? 'selected' : ''}>수채화 - 부드러운 번짐, 은은한 색감</option>
                            <option value="oil_painting" ${this.imageSettings.style === 'oil_painting' ? 'selected' : ''}>유화 - 두꺼운 붓터치, 풍부한 질감</option>
                            <option value="pencil_drawing" ${this.imageSettings.style === 'pencil_drawing' ? 'selected' : ''}>연필그림 - 섬세한 음영, 흑백 스케치</option>
                        </optgroup>

                        <!-- 디자인 & 스타일 -->
                        <optgroup label="🎯 디자인 & 스타일">
                            <option value="flat_vector" ${this.imageSettings.style === 'flat_vector' ? 'selected' : ''}>플랫 벡터 - 플랫 디자인, 미니멀 기하학</option>
                            <option value="vintage" ${this.imageSettings.style === 'vintage' ? 'selected' : ''}>빈티지 - 복고풍, 바랜 색감</option>
                            <option value="pixel_art" ${this.imageSettings.style === 'pixel_art' ? 'selected' : ''}>픽셀아트 - 8비트 레트로 게임 감성</option>
                            <option value="neon_punk" ${this.imageSettings.style === 'neon_punk' ? 'selected' : ''}>네온펑크 - 사이버펑크, 형광 네온색</option>
                        </optgroup>

                        <!-- 공예 & 입체 -->
                        <optgroup label="🎭 공예 & 입체">
                            <option value="wool_felt_doll" ${this.imageSettings.style === 'wool_felt_doll' ? 'selected' : ''}>동화 양모인형 - 양모 펠트, 포근한 질감</option>
                            <option value="diorama" ${this.imageSettings.style === 'diorama' ? 'selected' : ''}>디오라마 - 미니어처 모형, 틸트 시프트</option>
                            <option value="low_poly" ${this.imageSettings.style === 'low_poly' ? 'selected' : ''}>로우폴리 - 로우 폴리곤 3D, 각진 면</option>
                            <option value="origami" ${this.imageSettings.style === 'origami' ? 'selected' : ''}>오리가미 - 종이접기, 기하학적 조각</option>
                            <option value="3d_model" ${this.imageSettings.style === '3d_model' ? 'selected' : ''}>3D 모델 - 사실적 3D 렌더링</option>
                            <option value="craft_clay" ${this.imageSettings.style === 'craft_clay' ? 'selected' : ''}>공예/점토 - 점토 공예, 도자기 질감</option>
                        </optgroup>
                    </select>

                    <!-- 선택된 스타일 정보 표시 -->
                    <div id="style-info" class="mt-3 ${this.imageSettings.style === 'none' ? 'hidden' : ''} p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/40 rounded-xl">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="sparkles" class="w-4 h-4 text-purple-300"></i>
                            <span class="text-xs text-purple-300 font-bold">선택된 화풍 정보</span>
                        </div>
                        <div class="mb-2">
                            <span class="text-[10px] text-slate-500 font-semibold">화풍명:</span>
                            <span id="style-name-preview" class="text-[11px] text-white font-semibold ml-2">
                                ${this.imageSettings.style !== 'none' && this.styleCategories[this.imageSettings.style]
                                    ? this.styleCategories[this.imageSettings.style].name
                                    : ''}
                            </span>
                        </div>
                        <div class="mb-2">
                            <span class="text-[10px] text-slate-500 font-semibold">설명:</span>
                            <span id="style-desc-preview" class="text-[10px] text-slate-300 ml-2">
                                ${this.imageSettings.style !== 'none' && this.styleCategories[this.imageSettings.style]
                                    ? this.styleCategories[this.imageSettings.style].description
                                    : ''}
                            </span>
                        </div>
                        <div class="pt-2 border-t border-purple-500/20">
                            <div class="text-[9px] text-purple-400 font-semibold mb-1">📝 적용될 프롬프트:</div>
                            <div id="style-prompt-preview" class="text-[10px] text-slate-400 font-mono italic leading-relaxed">
                                ${this.imageSettings.style !== 'none' && this.styleCategories[this.imageSettings.style]
                                    ? this.styleCategories[this.imageSettings.style].prompt
                                    : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 레퍼런스 이미지 섹션 -->
                <div class="mt-4 pt-4 border-t border-slate-700/50">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="image-plus" class="w-4 h-4 text-cyan-400"></i>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">🖼️ 레퍼런스 이미지 (선택사항)</label>
                        <span class="text-[9px] text-slate-600 ml-auto">Whisk 스타일 참조</span>
                    </div>

                    <!-- 마스터 캐릭터 프롬프트 -->
                    <div id="master-character-section" class="mb-4 p-3 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/30 rounded-xl ${AppState.getMasterCharacterPrompt() ? '' : 'hidden'}">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <i data-lucide="user-circle" class="w-3.5 h-3.5 text-cyan-300"></i>
                                <span class="text-[10px] text-cyan-300 font-bold">주인공 마스터 프롬프트</span>
                            </div>
                            <button id="btn-generate-master-ref" class="bg-cyan-600 hover:bg-cyan-500 text-white px-2 py-1 rounded text-[9px] font-bold transition flex items-center gap-1">
                                <i data-lucide="wand-2" class="w-3 h-3"></i> 참조 생성
                            </button>
                        </div>
                        <div id="master-character-prompt" class="text-[9px] text-slate-400 font-mono italic leading-relaxed overflow-hidden text-ellipsis" style="max-height: 60px;">
                            ${AppState.getMasterCharacterPrompt()}
                        </div>
                    </div>

                    <!-- 레퍼런스 이미지 업로드 -->
                    <div class="grid grid-cols-3 gap-3">
                        <!-- Subject Reference -->
                        <div class="relative">
                            <label class="block text-[9px] font-bold text-slate-500 mb-2">피사체 참조</label>
                            <div id="ref-subject-preview" class="w-full aspect-square bg-slate-900 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-cyan-500 transition group">
                                <div class="text-center">
                                    <i data-lucide="user" class="w-6 h-6 text-slate-600 group-hover:text-cyan-400 mx-auto mb-1"></i>
                                    <div class="text-[8px] text-slate-600 group-hover:text-cyan-400">Subject</div>
                                </div>
                                <img id="ref-subject-img" class="hidden absolute inset-0 w-full h-full object-cover rounded-lg" />
                            </div>
                            <input type="file" id="ref-subject-input" accept="image/*" class="hidden" />
                            <button id="btn-clear-subject" class="hidden absolute top-6 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full p-1">
                                <i data-lucide="x" class="w-3 h-3"></i>
                            </button>
                        </div>

                        <!-- Scene Reference -->
                        <div class="relative">
                            <label class="block text-[9px] font-bold text-slate-500 mb-2">장면 참조</label>
                            <div id="ref-scene-preview" class="w-full aspect-square bg-slate-900 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-cyan-500 transition group">
                                <div class="text-center">
                                    <i data-lucide="image" class="w-6 h-6 text-slate-600 group-hover:text-cyan-400 mx-auto mb-1"></i>
                                    <div class="text-[8px] text-slate-600 group-hover:text-cyan-400">Scene</div>
                                </div>
                                <img id="ref-scene-img" class="hidden absolute inset-0 w-full h-full object-cover rounded-lg" />
                            </div>
                            <input type="file" id="ref-scene-input" accept="image/*" class="hidden" />
                            <button id="btn-clear-scene" class="hidden absolute top-6 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full p-1">
                                <i data-lucide="x" class="w-3 h-3"></i>
                            </button>
                        </div>

                        <!-- Style Reference -->
                        <div class="relative">
                            <label class="block text-[9px] font-bold text-slate-500 mb-2">스타일 참조</label>
                            <div id="ref-style-preview" class="w-full aspect-square bg-slate-900 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-cyan-500 transition group">
                                <div class="text-center">
                                    <i data-lucide="palette" class="w-6 h-6 text-slate-600 group-hover:text-cyan-400 mx-auto mb-1"></i>
                                    <div class="text-[8px] text-slate-600 group-hover:text-cyan-400">Style</div>
                                </div>
                                <img id="ref-style-img" class="hidden absolute inset-0 w-full h-full object-cover rounded-lg" />
                            </div>
                            <input type="file" id="ref-style-input" accept="image/*" class="hidden" />
                            <button id="btn-clear-style" class="hidden absolute top-6 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full p-1">
                                <i data-lucide="x" class="w-3 h-3"></i>
                            </button>
                        </div>
                    </div>

                    <div class="mt-3 text-[9px] text-slate-600">
                        💡 레퍼런스 이미지는 선택사항입니다. 업로드하면 이미지 생성 시 참조됩니다.
                    </div>
                </div>
            </div>
        `;
    }

    renderStandalonePanel() {
        return `
            <div class="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-2xl p-6 mb-6">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                        <i data-lucide="sparkles" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white">✨ 독립 실행 모드</h3>
                    <span class="ml-auto text-xs text-blue-400 bg-blue-500/20 px-3 py-1 rounded-full">빠른 이미지 생성</span>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">이미지 프롬프트</label>
                        <textarea id="standalone-image-prompt"
                            class="w-full h-24 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none scrollbar-hide"
                            placeholder="생성하고 싶은 이미지를 영어로 설명하세요...&#10;예: A serene mountain landscape at sunset with snow-capped peaks"></textarea>
                    </div>

                    <button id="btn-standalone-generate-image" class="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2">
                        <i data-lucide="image" class="w-4 h-4"></i> 이미지 생성
                    </button>

                    <!-- 생성 결과 표시 영역 -->
                    <div id="standalone-image-result" class="hidden p-4 bg-slate-900/50 border border-blue-500/30 rounded-xl space-y-3">
                        <div class="flex items-center gap-2 text-blue-400 text-sm font-semibold">
                            <i data-lucide="check-circle" class="w-5 h-5"></i>
                            <span>이미지 생성 완료!</span>
                            <span id="standalone-image-info" class="ml-auto text-xs text-slate-400"></span>
                        </div>
                        <div class="relative aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                            <img id="standalone-image-preview" src="" alt="Generated Image" class="w-full h-full object-contain">
                        </div>
                        <button id="btn-standalone-download-image" class="w-full bg-slate-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2">
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>이미지 다운로드</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderManualAddPanel() {
        return `
            <div class="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-6">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 bg-green-500/20 rounded-lg text-green-400">
                        <i data-lucide="plus-square" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white">➕ 장면 수동 추가</h3>
                    <span class="ml-auto text-xs text-green-400 bg-green-500/20 px-3 py-1 rounded-full">분석 없이 직접 추가</span>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">대본</label>
                        <textarea id="manual-scene-script"
                            class="w-full h-20 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none scrollbar-hide"
                            placeholder="장면의 대본을 입력하세요..."></textarea>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">이미지 프롬프트 (선택)</label>
                        <textarea id="manual-scene-prompt"
                            class="w-full h-20 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none scrollbar-hide"
                            placeholder="이미지 프롬프트를 입력하세요... (비우면 자동 생성)"></textarea>
                    </div>
                </div>

                <button id="btn-add-manual-scene" class="mt-4 w-full bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg shadow-green-600/20 transition flex items-center justify-center gap-2">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i> 장면 추가
                </button>
            </div>
        `;
    }

    countSceneStatus(scenes) {
        let complete = 0;
        let pending = 0;
        let error = 0;

        scenes.forEach(s => {
            if (s.generatedUrl) {
                if (s.imageError) error++;
                else complete++;
            } else {
                pending++;
            }
        });

        return { complete, pending, error };
    }

    renderSceneRow(scene) {
        const hasImage = !!scene.generatedUrl;
        const hasError = !!scene.imageError;

        // 상태 아이콘
        let statusIcon, statusColor, statusText;
        if (hasImage && !hasError) {
            statusIcon = 'check-circle-2';
            statusColor = 'text-green-400';
            statusText = '완료';
        } else if (hasError) {
            statusIcon = 'x-circle';
            statusColor = 'text-red-400';
            statusText = '오류';
        } else {
            statusIcon = 'circle-dashed';
            statusColor = 'text-yellow-400';
            statusText = '대기';
        }

        return `
            <tr class="border-b border-slate-800/30 hover:bg-white/5 transition group" id="row-${scene.sceneId}">
                <!-- Status Column -->
                <td class="py-4 pl-6 align-top pt-6">
                    <div class="flex flex-col items-center gap-1">
                        <i data-lucide="${statusIcon}" class="w-5 h-5 ${statusColor}"></i>
                        <span class="text-[9px] ${statusColor} font-medium">${statusText}</span>
                        <span class="text-[10px] text-slate-600 font-mono">#${scene.sceneId}</span>
                    </div>
                </td>

                <!-- Script Column -->
                <td class="py-4 px-4">
                    <textarea class="scene-script-edit w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-sm text-slate-300 resize-none h-16 scrollbar-hide focus:ring-1 focus:ring-blue-500"
                        data-scene-id="${scene.sceneId}">${scene.originalScript}</textarea>
                </td>

                <!-- Prompt Column -->
                <td class="py-4 px-4">
                    <textarea class="scene-prompt-edit w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-[11px] text-slate-400 font-mono italic resize-none h-16 scrollbar-hide focus:ring-1 focus:ring-purple-500"
                        data-scene-id="${scene.sceneId}"
                        placeholder="이미지 프롬프트 (편집 가능)">${scene.imagePrompt || ''}</textarea>
                </td>

                <!-- Preview Column -->
                <td class="py-4 px-4">
                    <div class="w-40 aspect-video bg-slate-900/50 rounded-lg border border-slate-700/50 flex items-center justify-center overflow-hidden relative group/img drop-zone"
                         data-scene-id="${scene.sceneId}"
                         data-drop-type="image"
                         ondragover="event.preventDefault(); this.classList.add('border-blue-500', 'ring-2', 'ring-blue-500/50');"
                         ondragleave="this.classList.remove('border-blue-500', 'ring-2', 'ring-blue-500/50');"
                         ondrop="window.handleAssetDrop(event, this)">
                        <div class="image-placeholder ${hasImage ? 'hidden' : ''} text-[8px] text-slate-600 font-bold uppercase tracking-widest text-center px-2">
                            No Image<br><span class="text-[7px] opacity-60">Drag or Generate</span>
                        </div>
                        <img src="${scene.generatedUrl || ''}" class="${hasImage ? '' : 'hidden'} w-full h-full object-cover cursor-pointer"
                             id="img-${scene.sceneId}"
                             onclick="window.openLightbox(this.src)"
                             title="클릭하여 크게 보기">
                        <div class="loading-overlay hidden absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                            <i data-lucide="loader-2" class="w-4 h-4 text-indigo-500 animate-spin"></i>
                        </div>
                        ${hasImage ? `
                            <div class="absolute top-2 right-2 bg-green-600/80 text-white text-[9px] px-2 py-0.5 rounded font-bold">READY</div>
                        ` : ''}
                    </div>
                </td>

                <!-- Actions Column -->
                <td class="py-4 pr-6 text-right">
                    <div class="flex flex-col gap-2 scale-90 origin-right">
                        <button class="btn-gen-image bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1" data-id="${scene.sceneId}">
                            <i data-lucide="wand-2" class="w-3.5 h-3.5"></i> 생성
                        </button>
                        <button class="btn-down-image ${hasImage ? '' : 'hidden'} bg-slate-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                                id="btn-down-${scene.sceneId}" data-id="${scene.sceneId}">
                            <i data-lucide="download" class="w-3.5 h-3.5"></i> 다운
                        </button>
                        <button class="btn-delete-scene bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1" data-id="${scene.sceneId}">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> 삭제
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    onMount() {
        const scenes = AppState.getScenes();
        const self = this;

        // Setup guide button
        this.setupGuideButton();

        // Reset button
        const btnResetImage = document.getElementById('btn-reset-image');
        if (btnResetImage) {
            btnResetImage.addEventListener('click', () => {
                if (confirm('⚠️ 모든 작업 내용이 삭제됩니다.\n\n정말 초기화하시겠습니까?')) {
                    AppState.startNewProject();
                    location.reload();
                }
            });
        }

        // Retroactive Style Change Button
        const btnApplyRetroactiveStyle = document.getElementById('btn-apply-retroactive-style');
        if (btnApplyRetroactiveStyle) {
            btnApplyRetroactiveStyle.addEventListener('click', async () => {
                const newStyle = document.getElementById('retroactive-style-selector').value;
                const scenes = AppState.getScenes();

                if (scenes.length === 0) {
                    alert('씬이 없습니다. 먼저 대본 분석을 진행하세요.');
                    return;
                }

                if (!confirm(`모든 이미지 프롬프트를 "${newStyle}" 스타일로 재생성하시겠습니까?\n\n이미 생성된 이미지는 변경되지 않으며, 새로 생성해야 적용됩니다.`)) {
                    return;
                }

                try {
                    btnApplyRetroactiveStyle.disabled = true;
                    btnApplyRetroactiveStyle.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> 재생성 중...';

                    if (window.lucide) window.lucide.createIcons();

                    const response = await fetch(`${CONFIG.endpoints.script.replace('/generate-script', '/regenerate-prompts-with-style')}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            scenes: scenes,
                            newStyle: newStyle
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        AppState.setScenes(result.scenes);
                        alert(`✅ 성공적으로 ${result.scenes.length}개 씬의 이미지 프롬프트를 "${newStyle}" 스타일로 재생성했습니다!`);
                        this.refreshModule();
                    } else {
                        alert(`❌ 실패: ${result.error}`);
                    }
                } catch (error) {
                    console.error('Style regeneration error:', error);
                    alert(`❌ 오류 발생: ${error.message}`);
                } finally {
                    btnApplyRetroactiveStyle.disabled = false;
                    btnApplyRetroactiveStyle.innerHTML = '<i data-lucide="wand-2" class="w-4 h-4"></i> 스타일 적용 (프롬프트 재생성)';
                    if (window.lucide) window.lucide.createIcons();
                }
            });
        }

        // Settings event listeners
        ['image-model', 'image-aspect-ratio', 'image-num-outputs', 'image-quality', 'image-style'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.updateSettings());
            }
        });

        // Style selector - show/hide style info
        const styleSelector = document.getElementById('image-style');
        if (styleSelector) {
            styleSelector.addEventListener('change', (e) => {
                const styleInfo = document.getElementById('style-info');
                const styleNamePreview = document.getElementById('style-name-preview');
                const styleDescPreview = document.getElementById('style-desc-preview');
                const stylePromptPreview = document.getElementById('style-prompt-preview');
                const selectedStyle = e.target.value;

                if (selectedStyle === 'none') {
                    styleInfo.classList.add('hidden');
                } else {
                    styleInfo.classList.remove('hidden');
                    const style = this.styleCategories[selectedStyle];
                    if (style) {
                        styleNamePreview.textContent = style.name;
                        styleDescPreview.textContent = style.description;
                        stylePromptPreview.textContent = style.prompt;
                    }
                }

                // Update settings
                this.updateSettings();
            });
        }

        // Stats toggle
        const btnToggleStats = document.getElementById('btn-toggle-stats');
        if (btnToggleStats) {
            btnToggleStats.addEventListener('click', () => this.toggleStats());
        }

        // Clear Cache Button
        const btnClearCache = document.getElementById('btn-clear-cache');
        if (btnClearCache) {
            btnClearCache.addEventListener('click', () => {
                if (confirm('이미지 캐시를 모두 비우시겠습니까?')) {
                    imageCache.clear();
                    alert('캐시가 삭제되었습니다.');
                }
            });
        }

        // 마스터 캐릭터 프롬프트 업데이트
        this.updateMasterCharacterDisplay();

        // 마스터 캐릭터 참조 이미지 생성 버튼
        const btnGenerateMasterRef = document.getElementById('btn-generate-master-ref');
        if (btnGenerateMasterRef) {
            btnGenerateMasterRef.addEventListener('click', () => this.generateMasterReference());
        }

        // 레퍼런스 이미지 업로드 설정
        this.setupReferenceImageUpload('subject');
        this.setupReferenceImageUpload('scene');
        this.setupReferenceImageUpload('style');

        // localStorage에서 레퍼런스 이미지 UI 복원
        this.restoreReferenceImagesUI();

        // Standalone image generation
        const btnStandaloneGen = document.getElementById('btn-standalone-generate-image');
        if (btnStandaloneGen) {
            btnStandaloneGen.addEventListener('click', async () => {
                const promptInput = document.getElementById('standalone-image-prompt');
                const prompt = promptInput?.value.trim();

                if (!prompt) return alert('이미지 프롬프트를 입력해주세요.');

                btnStandaloneGen.disabled = true;
                const originalText = btnStandaloneGen.innerHTML;
                const startTime = Date.now();
                btnStandaloneGen.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 생성 중...`;
                lucide.createIcons();

                try {
                    // 화풍 스타일 적용
                    const styledPrompt = this.applyStyleToPrompt(prompt);

                    const response = await fetch(CONFIG.endpoints.image, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: styledPrompt,
                            settings: this.imageSettings
                        })
                    });

                    if (!response.ok) throw new Error(`서버 오류: ${response.status}`);

                    const result = await response.json();
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

                    if (result.success && result.imageUrl) {
                        // 결과 영역 표시
                        const imageResult = document.getElementById('standalone-image-result');
                        const imagePreview = document.getElementById('standalone-image-preview');
                        const imageInfo = document.getElementById('standalone-image-info');
                        const btnDownload = document.getElementById('btn-standalone-download-image');

                        imageResult.classList.remove('hidden');
                        imagePreview.src = result.imageUrl;
                        imageInfo.textContent = `모델: ${result.model || 'unknown'} · ${elapsed}초`;

                        // 다운로드 버튼 이벤트
                        btnDownload.onclick = () => {
                            const link = document.createElement('a');
                            link.href = result.imageUrl;
                            link.download = `standalone_image_${Date.now()}.png`;
                            link.click();
                        };

                        lucide.createIcons();
                    } else {
                        throw new Error(result.error || '이미지 생성 실패');
                    }
                } catch (e) {
                    console.error(e);
                    alert(`❌ 이미지 생성 실패\n\n${e.message}`);
                } finally {
                    btnStandaloneGen.disabled = false;
                    btnStandaloneGen.innerHTML = originalText;
                    lucide.createIcons();
                }
            });
        }

        // Manual scene add
        const btnAddManual = document.getElementById('btn-add-manual-scene');
        if (btnAddManual) {
            btnAddManual.addEventListener('click', () => {
                const scriptInput = document.getElementById('manual-scene-script');
                const promptInput = document.getElementById('manual-scene-prompt');

                const script = scriptInput?.value.trim();
                if (!script) return alert('대본을 입력해주세요.');

                const prompt = promptInput?.value.trim();
                const currentScenes = AppState.getScenes();
                const newId = currentScenes.length > 0 ? Math.max(...currentScenes.map(s => s.sceneId)) + 1 : 1;

                const newScene = {
                    sceneId: newId,
                    originalScript: script,
                    scriptForTTS: script,
                    imagePrompt: prompt || '',
                    motionPrompt: '',
                    generatedUrl: null,
                    videoUrl: null,
                    audioUrl: null,
                    srtData: null
                };

                AppState.setScenes([...currentScenes, newScene]);
                scriptInput.value = '';
                promptInput.value = '';
                alert(`장면 #${newId}이 추가되었습니다.`);

                if (window.app) window.app.route('image');
            });
        }

        // Script/prompt sync
        document.querySelectorAll('.scene-script-edit').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                const sceneId = e.target.getAttribute('data-scene-id');
                const scene = AppState.getScenes().find(s => s.sceneId == sceneId);
                if (scene) {
                    scene.originalScript = e.target.value;
                    scene.scriptForTTS = e.target.value;
                }
            });
        });

        document.querySelectorAll('.scene-prompt-edit').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                const sceneId = e.target.getAttribute('data-scene-id');
                const scene = AppState.getScenes().find(s => s.sceneId == sceneId);
                if (scene) scene.imagePrompt = e.target.value;
            });
        });

        // Delete scene
        document.querySelectorAll('.btn-delete-scene').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = parseInt(btn.getAttribute('data-id'));
                if (!confirm(`장면 #${sceneId}을 삭제하시겠습니까?`)) return;

                const currentScenes = AppState.getScenes();
                const updatedScenes = currentScenes.filter(s => s.sceneId !== sceneId);
                AppState.setScenes(updatedScenes);

                if (window.app) window.app.route('image');
            });
        });

        // Generate single image (core function without retry)
        const generateItem = async (btn, attemptNum = 1, maxAttempts = 1, bypassCache = false) => {
            const sceneId = btn.getAttribute('data-id');
            // ⭐ CRITICAL FIX: Get scenes array once and modify it directly
            const scenes = AppState.getScenes();
            const scene = scenes.find(s => s.sceneId == sceneId);
            const img = document.getElementById(`img-${sceneId}`);
            const placeholder = img.parentElement.querySelector('.image-placeholder');
            const loading = img.parentElement.querySelector('.loading-overlay');
            const downBtn = document.getElementById(`btn-down-${sceneId}`);

            btn.disabled = true;
            const attemptText = maxAttempts > 1 ? ` (${attemptNum}/${maxAttempts})` : '';
            btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> 생성 중${attemptText}`;
            loading.classList.remove('hidden');
            lucide.createIcons();

            const startTime = Date.now();

            try {
                const result = {};
                let fromCache = false;

                // Check cache first (unless bypassed)
                const cacheKey = imageCache.generateKey('image', {
                    prompt: scene.imagePrompt,
                    model: this.imageSettings.model,
                    aspectRatio: this.imageSettings.aspectRatio
                });

                const cachedResult = bypassCache ? null : imageCache.get(cacheKey);

                if (cachedResult) {
                    // Use cached result
                    Object.assign(result, cachedResult);
                    fromCache = true;
                    console.log(`📦 Using cached image for scene #${sceneId}`);
                } else {
                    // Make API call
                    // 화풍 스타일 적용
                    const styledPrompt = this.applyStyleToPrompt(scene.imagePrompt);

                    // 레퍼런스 이미지 추가 (선택사항)
                    const referenceImages = {};
                    if (this.referenceImages.subject) referenceImages.subject = this.referenceImages.subject;
                    if (this.referenceImages.scene) referenceImages.scene = this.referenceImages.scene;
                    if (this.referenceImages.style) referenceImages.style = this.referenceImages.style;

                    const response = await fetch(CONFIG.endpoints.image, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: styledPrompt,
                            settings: {
                                model: this.imageSettings.model,
                                aspectRatio: this.imageSettings.aspectRatio,
                                numOutputs: this.imageSettings.numOutputs
                            },
                            referenceImages: Object.keys(referenceImages).length > 0 ? referenceImages : undefined
                        })
                    });

                    const responseText = await response.text();
                    if (!response.ok) throw new Error(`Server Error (${response.status}): ${responseText}`);

                    try {
                        Object.assign(result, JSON.parse(responseText));
                    } catch (e) {
                        throw new Error(`Invalid JSON Response`);
                    }

                    // Cache successful result
                    if (result.imageUrl) {
                        imageCache.set(cacheKey, result);
                    }
                }

                if (result.imageUrl) {
                    img.src = result.imageUrl;
                    img.classList.remove('hidden');
                    placeholder.classList.add('hidden');
                    downBtn.classList.remove('hidden');
                    scene.generatedUrl = result.imageUrl;
                    scene.imageError = null;

                    // ⭐ CRITICAL FIX: Save the modified scenes array (not a fresh copy!)
                    AppState.setScenes([...scenes]);

                    // 처리 시간 정보
                    const elapsed = fromCache ? '0.0' : (result.processingTime || ((Date.now() - startTime) / 1000).toFixed(1));
                    const displayElapsed = fromCache ? `${elapsed}s (cached)` : `${elapsed}s`;

                    // Debug: Verify the save worked
                    const verifyScene = AppState.getScenes().find(s => s.sceneId == sceneId);
                    console.log(`✅ Image saved to scene #${scene.sceneId}:`, {
                        imageUrl: verifyScene.generatedUrl ? `${verifyScene.generatedUrl.substring(0, 50)}...` : 'MISSING!',
                        imageError: verifyScene.imageError || 'null',
                        elapsed: displayElapsed
                    });

                    // Update stats
                    this.stats.totalGenerated++;
                    this.stats.successCount++;
                    if (!fromCache) {
                        this.stats.totalProcessingTime += parseFloat(elapsed);
                    }
                    this.updateStatsUI();

                    // 성공 피드백: 버튼에 체크마크와 시간 표시 (2초간)
                    const originalHTML = btn.innerHTML;
                    const icon = fromCache ? 'database' : 'check-circle';
                    btn.innerHTML = `<i data-lucide="${icon}" class="w-3.5 h-3.5"></i> ${displayElapsed}`;
                    btn.classList.add(fromCache ? 'bg-cyan-600' : 'bg-green-600');
                    btn.classList.remove('bg-indigo-600');
                    lucide.createIcons();

                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.classList.remove('bg-green-600', 'bg-cyan-600');
                        btn.classList.add('bg-indigo-600');
                        lucide.createIcons();
                    }, 2000);

                    return { success: true };
                } else {
                    throw new Error("No image URL in response");
                }

            } catch (e) {
                console.error(`[Scene #${sceneId}] Attempt ${attemptNum}/${maxAttempts} failed:`, e.message);
                const errorMessage = e.message || '알 수 없는 오류';
                scene.imageError = errorMessage;

                // ⭐ Save error to AppState
                AppState.setScenes([...scenes]);

                // 네트워크 오류인 경우 retryable = true
                const isNetworkError = e.message && (
                    e.message.includes('Failed to fetch') ||
                    e.message.includes('NetworkError') ||
                    e.message.includes('timeout')
                );

                return {
                    success: false,
                    error: errorMessage,
                    retryable: isNetworkError
                };
            } finally {
                loading.classList.add('hidden');
            }
        };

        // Generate with automatic retry (up to 3 attempts)
        const generateItemWithRetry = async (btn, maxAttempts = 3, bypassCache = false) => {
            const sceneId = btn.getAttribute('data-id');
            let lastError = null;
            let isRetryable = true;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                console.log(`[Scene #${sceneId}] Starting attempt ${attempt}/${maxAttempts}...`);

                const result = await generateItem(btn, attempt, maxAttempts, bypassCache);

                if (result.success) {
                    // Success - restore button state
                    btn.disabled = false;
                    btn.innerHTML = `<i data-lucide="wand-2" class="w-3.5 h-3.5"></i> 생성`;
                    lucide.createIcons();
                    return { success: true };
                }

                lastError = result.error;
                isRetryable = result.retryable !== false; // 명시적으로 false가 아니면 재시도 가능

                // 재시도 불가능한 오류인 경우 즉시 중단
                if (!isRetryable) {
                    console.warn(`[Scene #${sceneId}] Non-retryable error detected. Stopping retries.`);
                    break;
                }

                // Wait before retry (except on last attempt)
                if (attempt < maxAttempts) {
                    console.log(`[Scene #${sceneId}] Waiting 2 seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            // All attempts failed
            console.error(`[Scene #${sceneId}] All ${maxAttempts} attempts failed.`);
            const failedScenes = AppState.getScenes();
            const scene = failedScenes.find(s => s.sceneId == sceneId);
            if (scene) {
                scene.imageError = lastError;
                // ⭐ Save error to AppState
                AppState.setScenes([...failedScenes]);
            }

            btn.disabled = false;
            btn.classList.remove('bg-indigo-600');
            btn.classList.add('bg-red-900');
            btn.innerHTML = `<i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> 재시도`;
            lucide.createIcons();

            this.stats.totalGenerated++;
            this.stats.errorCount++;
            this.updateStatsUI();

            return { success: false, error: lastError };
        };

        // Attach listeners - individual generation with retry
        document.querySelectorAll('.btn-gen-image').forEach(btn => {
            btn.addEventListener('click', async () => {
                // Manual click always bypasses cache
                const result = await generateItemWithRetry(btn, 3, true);
                if (!result.success) {
                    // 에러 타입별 메시지와 해결 방법
                    let helpText = '\n\n💡 해결 방법:\n';
                    const errorLower = result.error.toLowerCase();

                    if (errorLower.includes('api 키') || errorLower.includes('인증')) {
                        helpText += '• 설정 메뉴에서 Replicate API 키를 확인하세요.\n• API 키가 유효한지 테스트해보세요.';
                    } else if (errorLower.includes('한도') || errorLower.includes('rate limit')) {
                        helpText += '• API 사용 한도가 초과되었습니다.\n• 몇 분 후 다시 시도하거나, 다른 API 키를 사용하세요.';
                    } else if (errorLower.includes('네트워크') || errorLower.includes('연결')) {
                        helpText += '• 인터넷 연결을 확인하세요.\n• VPN을 사용 중이라면 잠시 끄고 시도해보세요.';
                    } else if (errorLower.includes('timeout') || errorLower.includes('시간 초과')) {
                        helpText += '• 네트워크가 느리거나 서버가 혼잡합니다.\n• 잠시 후 다시 시도하세요.';
                    } else {
                        helpText += '• 빨간색 "재시도" 버튼을 클릭하여 다시 생성하세요.\n• 문제가 계속되면 프롬프트를 수정해보세요.';
                    }

                    alert(`❌ 이미지 생성 실패 (3회 시도)\n\n${result.error}${helpText}`);
                }
            });
        });

        document.querySelectorAll('.btn-down-image').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = btn.getAttribute('data-id');
                const img = document.getElementById(`img-${sceneId}`);
                const link = document.createElement('a');
                link.href = img.src;
                link.download = `scene_${sceneId}.png`;
                link.click();
            });
        });

        // Batch generate with parallel processing and retry
        // Batch generate with parallel processing and retry
        const btnGenAll = document.getElementById('btn-gen-all');

        const runBatchGeneration = async (auto = false) => {
            const btns = Array.from(document.querySelectorAll('.btn-gen-image'));
            const total = btns.length;

            if (total === 0) return;

            if (!auto && !confirm(`총 ${total}개 이미지를 병렬 생성합니다.\n(최대 10개씩 동시 생성, 실패시 각 이미지당 최대 3회 자동 재시도)\n\n계속하시겠습니까?`)) return;

            this.showBatchProgress();
            this.startTime = Date.now();

            const progressContainer = document.getElementById('batch-progress-container');
            const progressBar = document.getElementById('batch-progress-bar');
            const progressPercent = document.getElementById('batch-progress-percent');
            const progressMessage = document.getElementById('batch-progress-message');
            const elapsedTimeEl = document.getElementById('batch-elapsed-time');

            // 경과 시간 타이머
            const elapsedTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                if (elapsedTimeEl) {
                    elapsedTimeEl.textContent = `경과 시간: ${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
            }, 1000);

            if (btnGenAll) btnGenAll.disabled = true;
            let completed = 0;
            let successCount = 0;
            let failedScenes = [];

            const updateProgress = (count, total, succeeded) => {
                completed = count;
                const percent = Math.round((count / total) * 100);
                progressBar.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                progressMessage.textContent = `${count}/${total}개 완료 (성공: ${succeeded}, 실패: ${count - succeeded})`;
            };

            updateProgress(0, total, 0);

            // 병렬 처리 (10개씩 동시 실행, 각각 자동 재시도 3회)
            await processInBatches(btns, 10, async (btn) => {
                const result = await generateItemWithRetry(btn, 3);
                if (result.success) {
                    successCount++;
                } else {
                    const sceneId = btn.getAttribute('data-id');
                    failedScenes.push({ sceneId, error: result.error });
                }
                updateProgress(++completed, total, successCount);
            }, () => { });

            clearInterval(elapsedTimer);
            if (btnGenAll) btnGenAll.disabled = false;
            progressContainer.classList.add('hidden');
            lucide.createIcons();

            const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
            const avgTimePerImage = successCount > 0 ? (elapsed / successCount).toFixed(1) : 0;

            if (failedScenes.length === 0) {
                // 자동 모드일 경우 알림 없이 다음 단계로 넘어갈 수도 있음 (선택 사항)
                // 현재는 알림 표시
                if (!auto) {
                    alert(`✅ 일괄 생성 완료!\n\n` +
                        `📊 통계:\n` +
                        `• 성공: ${successCount}/${total}개 (100%)\n` +
                        `• 총 처리 시간: ${elapsed}초\n` +
                        `• 평균 생성 시간: ${avgTimePerImage}초/이미지\n\n` +
                        `🎉 모든 이미지가 성공적으로 생성되었습니다!`
                    );
                } else {
                    console.log("✅ Auto image generation completed.");
                    // 다음 단계(TTS) 로직으로 이동
                    if (window.app) window.app.route('tts');
                }
            } else {
                const successRate = ((successCount / total) * 100).toFixed(0);
                const failedList = failedScenes.map(f => `Scene #${f.sceneId}`).join(', ');

                alert(`⚠️ 일괄 생성 완료 (일부 실패)\n\n` +
                    `📊 통계:\n` +
                    `• 성공: ${successCount}/${total}개 (${successRate}%)\n` +
                    `• 실패: ${failedScenes.length}개\n` +
                    `• 총 처리 시간: ${elapsed}초\n` +
                    `• 평균 생성 시간: ${avgTimePerImage}초/이미지\n\n` +
                    `❌ 실패한 장면: ${failedList}\n\n` +
                    `💡 해결 방법:\n` +
                    `• 실패한 장면의 빨간색 "재시도" 버튼을 클릭하세요.\n` +
                    `• 프롬프트가 너무 복잡한 경우 단순화해보세요.`
                );
            }
        };

        if (btnGenAll) {
            btnGenAll.addEventListener('click', () => runBatchGeneration(false));
        }

        // Auto Start Logic
        if (AppState.getAutomation('image')) {
            setTimeout(() => {
                const scenes = AppState.getScenes();
                if (scenes.length > 0 && scenes.some(s => !s.generatedUrl)) {
                    console.log('🤖 Auto-starting batch image generation...');
                    runBatchGeneration(true);
                }
            }, 1000);
        }

        // Batch download
        const btnDownAll = document.getElementById('btn-down-all');
        if (btnDownAll) {
            btnDownAll.addEventListener('click', () => {
                const generated = scenes.filter(s => s.generatedUrl);
                if (generated.length === 0) return alert("먼저 이미지를 생성해 주세요.");

                generated.forEach((s, i) => {
                    setTimeout(() => {
                        const link = document.createElement('a');
                        link.href = s.generatedUrl;
                        link.download = `scene_${s.sceneId}.png`;
                        link.click();
                    }, i * 500);
                });
            });
        }

        // Download all image prompts as text file
        const btnDownPrompts = document.getElementById('btn-down-prompts');
        if (btnDownPrompts) {
            btnDownPrompts.addEventListener('click', () => {
                const allScenes = AppState.getScenes();
                if (allScenes.length === 0) return alert("다운로드할 장면이 없습니다.");

                const scenesWithPrompts = allScenes.filter(s => s.imagePrompt);
                if (scenesWithPrompts.length === 0) return alert("이미지 프롬프트가 없습니다.");

                // 프롬프트만 한 줄씩 추출 (프롬프트 사이에 빈 줄 추가)
                const txtContent = scenesWithPrompts
                    .map(scene => scene.imagePrompt)
                    .join('\n\n');

                const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = `image_prompts_${Date.now()}.txt`;
                link.click();

                URL.revokeObjectURL(url);
                alert(`✅ 이미지 프롬프트 파일이 다운로드되었습니다.\n총 ${scenesWithPrompts.length}개 프롬프트 포함`);
            });
        }

        lucide.createIcons();
    }

    updateSettings() {
        const model = document.getElementById('image-model')?.value;
        const aspectRatio = document.getElementById('image-aspect-ratio')?.value;
        const numOutputs = parseInt(document.getElementById('image-num-outputs')?.value || '1');
        const outputQuality = parseInt(document.getElementById('image-quality')?.value || '90');
        const style = document.getElementById('image-style')?.value || 'none';

        this.imageSettings = { model, aspectRatio, numOutputs, outputQuality, style };
        console.log('✅ Image settings updated:', this.imageSettings);
    }

    /**
     * 선택된 화풍 스타일을 프롬프트에 적용
     * @param {string} originalPrompt - 원본 프롬프트
     * @returns {string} - 스타일이 적용된 프롬프트
     */
    applyStyleToPrompt(originalPrompt) {
        const style = this.imageSettings.style;
        if (!style || style === 'none') {
            return originalPrompt;
        }

        const styleInfo = this.styleCategories[style];
        if (!styleInfo) {
            return originalPrompt;
        }

        // 스타일 프롬프트를 원본 프롬프트 앞에 추가
        return `${styleInfo.prompt}, ${originalPrompt}`;
    }

    toggleStats() {
        const statsPanel = document.getElementById('image-stats-panel');
        if (statsPanel) {
            statsPanel.classList.toggle('hidden');
        }
    }

    showBatchProgress() {
        const progressContainer = document.getElementById('batch-progress-container');
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }

    updateStatsUI() {
        document.getElementById('stat-total-generated').textContent = this.stats.totalGenerated;
        document.getElementById('stat-success-count').textContent = this.stats.successCount;
        document.getElementById('stat-error-count').textContent = this.stats.errorCount;

        const avgTime = this.stats.totalGenerated > 0
            ? (this.stats.totalProcessingTime / this.stats.totalGenerated).toFixed(1)
            : '-';
        document.getElementById('stat-avg-time').textContent = avgTime;
    }

    // 마스터 캐릭터 프롬프트 표시 업데이트
    updateMasterCharacterDisplay() {
        const masterPrompt = AppState.getMasterCharacterPrompt();
        const section = document.getElementById('master-character-section');
        const promptEl = document.getElementById('master-character-prompt');

        if (masterPrompt && section && promptEl) {
            section.classList.remove('hidden');
            promptEl.textContent = masterPrompt;
        } else if (section) {
            section.classList.add('hidden');
        }
    }

    // 레퍼런스 이미지 업로드 설정
    setupReferenceImageUpload(type) {
        const preview = document.getElementById(`ref-${type}-preview`);
        const input = document.getElementById(`ref-${type}-input`);
        const img = document.getElementById(`ref-${type}-img`);
        const clearBtn = document.getElementById(`btn-clear-${type}`);

        if (!preview || !input || !img) return;

        // 파일 처리 함수 (클릭 업로드와 드래그 앤드랍 공통)
        const handleFile = (file) => {
            if (!file) return;

            // 이미지 파일 검증
            if (!file.type.startsWith('image/')) {
                alert('이미지 파일만 업로드할 수 있습니다.');
                return;
            }

            // 파일 크기 검증 (5MB 제한)
            if (file.size > 5 * 1024 * 1024) {
                alert('이미지 크기는 5MB 이하여야 합니다.');
                return;
            }

            // FileReader로 이미지 읽기
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;

                // 이미지 미리보기 표시
                img.src = base64;
                img.classList.remove('hidden');
                clearBtn.classList.remove('hidden');

                // 상태에 저장
                this.referenceImages[type] = base64;

                // localStorage에 저장
                this.saveReferenceImages();

                console.log(`📎 ${type} reference image uploaded and saved`);
            };
            reader.readAsDataURL(file);
        };

        // 클릭 시 파일 선택 다이얼로그 열기
        preview.addEventListener('click', (e) => {
            // 삭제 버튼 클릭은 제외
            if (e.target.closest('button')) return;
            input.click();
        });

        // 파일 선택 시 처리
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            handleFile(file);
        });

        // 드래그 앤드랍 설정
        // 드래그 진입
        preview.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            preview.classList.add('ring-2', 'ring-blue-500', 'bg-blue-500/10');
        });

        // 드래그 오버
        preview.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        // 드래그 이탈
        preview.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // 자식 요소로 이동하는 경우 제외
            if (e.target === preview) {
                preview.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-500/10');
            }
        });

        // 드랍
        preview.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            preview.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-500/10');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFile(files[0]);
            }
        });

        // 삭제 버튼
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                img.src = '';
                img.classList.add('hidden');
                clearBtn.classList.add('hidden');
                input.value = '';
                this.referenceImages[type] = null;

                // localStorage에서도 삭제
                this.saveReferenceImages();

                console.log(`🗑️ ${type} reference image cleared and removed from localStorage`);
            });
        }
    }

    // 마스터 캐릭터 참조 이미지 생성
    async generateMasterReference() {
        const masterPrompt = AppState.getMasterCharacterPrompt();
        if (!masterPrompt) {
            alert('마스터 캐릭터 프롬프트가 없습니다. 먼저 대본 분석을 실행하세요.');
            return;
        }

        const btn = document.getElementById('btn-generate-master-ref');
        if (!btn) return;

        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> 생성 중...`;
        lucide.createIcons();

        try {
            const response = await fetch(CONFIG.endpoints.image, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: masterPrompt,
                    settings: {
                        ...this.imageSettings,
                        aspectRatio: '1:1'  // 참조 이미지는 정사각형
                    }
                })
            });

            if (!response.ok) throw new Error(`서버 오류: ${response.status}`);

            const result = await response.json();

            if (result.success && result.imageUrl) {
                // Subject 레퍼런스로 자동 설정
                const img = document.getElementById('ref-subject-img');
                const clearBtn = document.getElementById('btn-clear-subject');

                if (img) {
                    img.src = result.imageUrl;
                    img.classList.remove('hidden');
                    if (clearBtn) clearBtn.classList.remove('hidden');
                }

                // base64로 변환해서 저장 (URL을 직접 저장)
                this.referenceImages.subject = result.imageUrl;

                // localStorage에 저장
                this.saveReferenceImages();

                alert('✅ 마스터 캐릭터 참조 이미지가 생성되어 피사체 참조로 설정되었습니다!');
            } else {
                throw new Error(result.error || '이미지 생성 실패');
            }
        } catch (error) {
            console.error('Master reference generation error:', error);
            alert(`❌ 생성 실패: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    // localStorage에서 레퍼런스 이미지 로드
    loadReferenceImages() {
        try {
            const saved = localStorage.getItem('referenceImages');
            if (saved) {
                const images = JSON.parse(saved);
                console.log('📎 Loaded reference images from localStorage');
                return images;
            }
        } catch (error) {
            console.error('Failed to load reference images:', error);
        }

        // 기본값 반환
        return {
            subject: null,
            scene: null,
            style: null
        };
    }

    // localStorage에 레퍼런스 이미지 저장
    saveReferenceImages() {
        try {
            localStorage.setItem('referenceImages', JSON.stringify(this.referenceImages));
            console.log('💾 Saved reference images to localStorage');
        } catch (error) {
            console.error('Failed to save reference images:', error);
            // localStorage 용량 초과 시 에러 처리
            if (error.name === 'QuotaExceededError') {
                alert('⚠️ 저장 공간이 부족합니다. 일부 레퍼런스 이미지를 삭제해주세요.');
            }
        }
    }

    // localStorage에서 레퍼런스 이미지 UI 복원
    restoreReferenceImagesUI() {
        ['subject', 'scene', 'style'].forEach(type => {
            const imageUrl = this.referenceImages[type];
            if (imageUrl) {
                const img = document.getElementById(`ref-${type}-img`);
                const clearBtn = document.getElementById(`btn-clear-${type}`);

                if (img) {
                    img.src = imageUrl;
                    img.classList.remove('hidden');
                }
                if (clearBtn) {
                    clearBtn.classList.remove('hidden');
                }

                console.log(`🖼️ Restored ${type} reference image`);
            }
        });
    }
}
