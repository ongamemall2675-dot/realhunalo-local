// ================================================================
// SCRIPT MODULE - 대본 분석실
// ================================================================

import { Module } from '../Module.js';
import { AppState } from '../state.js';
import { CONFIG } from '../config.js';

// 화풍 카테고리 정의 (ImageModule과 동일)
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

export class ScriptModule extends Module {
    constructor() {
        super('script', '대본 분석실', 'file-text', 'GPT-Mini 기반 대본 초정밀 세분화');
    }

    render() {
        return `
            <div class="h-full flex flex-col gap-8 slide-up">
                <!-- Options Section (상단으로 이동) -->
                <div class="w-full space-y-6">
                    <div class="flex justify-between items-center gap-4">
                        <div class="flex items-center gap-2">
                            <!-- User Guide Button -->
                            ${this.renderGuideButton()}

                            <!-- Reset Button -->
                            <button id="btn-reset-script" class="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 rounded-xl text-xs font-bold transition">
                                <i data-lucide="refresh-ccw" class="w-3.5 h-3.5"></i>
                                초기화
                            </button>
                        </div>

                        <span class="text-blue-400 text-sm font-bold">⚙️ 분석 옵션을 먼저 설정하세요</span>
                    </div>

                    <div class="bg-slate-800/40 border border-slate-700 p-6 rounded-2xl">
                        <h4 class="text-sm font-bold text-white mb-4 flex items-center gap-2"><i data-lucide="sliders" class="w-4 h-4 text-blue-400"></i> 분석 옵션</h4>

                        <div class="space-y-4">
                            <!-- 화풍 선택 -->
                            <div>
                                <div class="flex items-center gap-2 mb-2">
                                    <i data-lucide="palette" class="w-3.5 h-3.5 text-purple-400"></i>
                                    <label class="block text-xs font-bold text-slate-500">🎨 화풍 스타일</label>
                                </div>
                                <select id="opt-image-style" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                                    <option value="stickman" selected>⭐ 스틱맨 (졸라맨) - 파란 셔츠, 빨간 넥타이 (기본)</option>
                                    <option value="none">🚫 스타일 미적용</option>

                                    <optgroup label="📺 애니메이션 & 만화 스타일">
                                        <option value="animation">애니메이션 - 일본 애니메이션, 밝고 선명한 색감</option>
                                        <option value="ghibli">지브리 - 미야자키 스타일, 따뜻하고 향수적</option>
                                        <option value="webtoon">웹툰 - 한국 웹툰, 깔끔한 선과 밝은 색감</option>
                                        <option value="comic_book">만화책 - 미국 코믹북, 강렬한 외곽선과 망점</option>
                                        <option value="european_graphic_novel">유럽풍 그래픽 노블 - 명확한 선과 수채화</option>
                                        <option value="3d_animation">3D 애니메이션 - 픽사 스타일, 부드러운 렌더링</option>
                                        <option value="claymation">클레이 애니메이션 - 점토 인형, 수작업 질감</option>
                                    </optgroup>

                                    <optgroup label="🎬 실사 & 시네마틱">
                                        <option value="cinematic_photorealistic">시네마틱 실사 - 영화 같은 실사, 극적인 조명</option>
                                        <option value="kdrama_realistic">K-드라마 실사 - 한국 드라마, 감성적 실사</option>
                                        <option value="noir">느와르 - 흑백 영화, 강렬한 명암 대비</option>
                                    </optgroup>

                                    <optgroup label="✏️ 일러스트 & 그림">
                                        <option value="illustration">일러스트 - 현대적 디지털 일러스트</option>
                                        <option value="hand_drawn">손그림 스타일 - 자연스러운 스케치 터치</option>
                                        <option value="fairy_tale_illustration">동화 일러스트 - 동화책, 환상적 색감</option>
                                        <option value="emotional_historical_illustration">감성 사극 일러스트 - 한국 사극, 전통 한복</option>
                                        <option value="web_novel_signature">웹소설 시그니쳐 - 판타지 로맨스 표지</option>
                                        <option value="oriental_folklore_illustration">동양 설화 일러스트 - 수묵화 요소, 신비로운 분위기</option>
                                    </optgroup>

                                    <optgroup label="🖌️ 페인팅 기법">
                                        <option value="watercolor">수채화 - 부드러운 번짐, 은은한 색감</option>
                                        <option value="oil_painting">유화 - 두꺼운 붓터치, 풍부한 질감</option>
                                        <option value="pencil_drawing">연필그림 - 섬세한 음영, 흑백 스케치</option>
                                    </optgroup>

                                    <optgroup label="🎯 디자인 & 스타일">
                                        <option value="flat_vector">플랫 벡터 - 플랫 디자인, 미니멀 기하학</option>
                                        <option value="vintage">빈티지 - 복고풍, 바랜 색감</option>
                                        <option value="pixel_art">픽셀아트 - 8비트 레트로 게임 감성</option>
                                        <option value="neon_punk">네온펑크 - 사이버펑크, 형광 네온색</option>
                                    </optgroup>

                                    <optgroup label="🎭 공예 & 입체">
                                        <option value="wool_felt_doll">동화 양모인형 - 양모 펠트, 포근한 질감</option>
                                        <option value="diorama">디오라마 - 미니어처 모형, 틸트 시프트</option>
                                        <option value="low_poly">로우폴리 - 로우 폴리곤 3D, 각진 면</option>
                                        <option value="origami">오리가미 - 종이접기, 기하학적 조각</option>
                                        <option value="3d_model">3D 모델 - 사실적 3D 렌더링</option>
                                        <option value="craft_clay">공예/점토 - 점토 공예, 도자기 질감</option>
                                    </optgroup>
                                </select>

                                <!-- 선택된 스타일 정보 표시 -->
                                <div id="style-info-script" class="mt-3 hidden p-3 bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/40 rounded-xl">
                                    <div class="flex items-center gap-2 mb-2">
                                        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-purple-300"></i>
                                        <span class="text-[10px] text-purple-300 font-bold">선택된 화풍</span>
                                    </div>
                                    <div class="mb-1">
                                        <span class="text-[9px] text-slate-500 font-semibold">화풍명:</span>
                                        <span id="style-name-script" class="text-[10px] text-white font-semibold ml-1"></span>
                                    </div>
                                    <div class="mb-2">
                                        <span class="text-[9px] text-slate-500 font-semibold">설명:</span>
                                        <span id="style-desc-script" class="text-[9px] text-slate-300 ml-1"></span>
                                    </div>
                                    <div class="pt-2 border-t border-purple-500/20">
                                        <div class="text-[8px] text-purple-400 font-semibold mb-1">📝 프롬프트:</div>
                                        <div id="style-prompt-script" class="text-[9px] text-slate-400 font-mono italic leading-relaxed"></div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-2">화면 비율</label>
                                <div class="grid grid-cols-3 gap-2">
                                    <button class="opt-ratio active py-2 bg-slate-900 border border-blue-500 text-blue-400 rounded-lg text-xs font-bold transition">16:9</button>
                                    <button class="opt-ratio py-2 bg-slate-900 border border-slate-700 text-slate-400 rounded-lg text-xs font-bold hover:border-slate-500 transition">9:16</button>
                                    <button class="opt-ratio py-2 bg-slate-900 border border-slate-700 text-slate-400 rounded-lg text-xs font-bold hover:border-slate-500 transition">1:1</button>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-2">해상도</label>
                                <select id="opt-resolution" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 outline-none focus:border-blue-500">
                                    <option>1K (Fast)</option>
                                    <option>2K (Balanced)</option>
                                    <option>4K (High)</option>
                                </select>
                            </div>

                            <div class="pt-4 border-t border-slate-700">
                                <div class="flex items-center justify-between">
                                    <label class="text-xs font-bold text-slate-500">자동화 모드</label>
                                    <div class="relative inline-block">
                                        <input type="checkbox" id="toggle-automation-script" class="sr-only peer" ${AppState.getAutomation('script') ? 'checked' : ''}>
                                        <label for="toggle-automation-script" class="block w-12 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 cursor-pointer transition"></label>
                                        <span class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition peer-checked:translate-x-6"></span>
                                    </div>
                                </div>
                                <p class="text-[10px] text-slate-600 mt-2">분석 완료 후 자동으로 씬 분할</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                        <p class="text-xs text-blue-300 leading-relaxed font-medium">
                            💡 <b>Tip:</b> GPT-Mini가 장면을 자동으로 구분하고 최적의 프롬프트를 생성합니다.
                        </p>
                    </div>
                </div>

                <!-- Input Section (하단으로 이동) -->
                <div class="flex-1 bg-slate-800/40 border border-slate-700 rounded-3xl p-1 flex flex-col">
                    <div class="bg-slate-800/20 border border-slate-700/50 rounded-3xl p-8 mb-8 shadow-inner">
                        <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-4">대본 본문</label>
                        <textarea id="script-input"
                            class="w-full h-80 bg-transparent text-slate-200 text-lg leading-relaxed placeholder-slate-600 focus:outline-none resize-none scrollbar-hide"
                            placeholder="여기에 대본을 입력하세요...">${AppState.getScript()}</textarea>
                    </div>
                    <div class="p-4 border-t border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-b-3xl">
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-bold text-slate-500 uppercase tracking-widest pl-4">Script Input</span>
                            <button id="btn-export-script-json" class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2">
                                <i data-lucide="file-json" class="w-3.5 h-3.5"></i> JSON 내보내기
                            </button>
                            <button id="btn-export-script-txt" class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2">
                                <i data-lucide="file-text" class="w-3.5 h-3.5"></i> TXT 내보내기
                            </button>
                        </div>
                        <button id="btn-analyze" class="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition flex items-center gap-2">
                            <i data-lucide="sparkles" class="w-4 h-4"></i> 분석 시작
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    onMount() {
        const btn = document.getElementById('btn-analyze');
        const textarea = document.getElementById('script-input');

        // Setup guide button
        this.setupGuideButton();

        // Reset button
        const btnReset = document.getElementById('btn-reset-script');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (confirm('⚠️ 모든 작업 내용이 삭제됩니다.\n\n정말 초기화하시겠습니까?')) {
                    AppState.startNewProject();
                    location.reload();
                }
            });
        }

        // 화풍 선택 이벤트 리스너
        const styleSelector = document.getElementById('opt-image-style');
        if (styleSelector) {
            styleSelector.addEventListener('change', (e) => {
                const styleInfo = document.getElementById('style-info-script');
                const styleNameEl = document.getElementById('style-name-script');
                const styleDescEl = document.getElementById('style-desc-script');
                const stylePromptEl = document.getElementById('style-prompt-script');
                const selectedStyle = e.target.value;

                if (selectedStyle === 'none') {
                    styleInfo.classList.add('hidden');
                } else {
                    styleInfo.classList.remove('hidden');
                    const style = STYLE_CATEGORIES[selectedStyle];
                    if (style) {
                        styleNameEl.textContent = style.name;
                        styleDescEl.textContent = style.description;
                        stylePromptEl.textContent = style.prompt;
                    }
                }
            });
        }

        textarea.addEventListener('input', (e) => {
            AppState.setScript(e.target.value);
        });

        btn.addEventListener('click', async () => {
            const text = textarea.value.trim();
            if (!text) return alert("대본을 입력해주세요.");

            // 화풍 선택 가져오기
            const imageStyle = document.getElementById('opt-image-style')?.value || 'none';

            // 화풍 미설정 경고
            if (imageStyle === 'none') {
                const userChoice = confirm(
                    "⚠️ 화풍(이미지 스타일)이 설정되지 않았습니다.\n\n" +
                    "화풍을 설정하지 않으면 AI가 일관성 없는 이미지를 생성할 수 있습니다.\n\n" +
                    "• 확인: 화풍 없이 분석 시작\n" +
                    "• 취소: 화풍을 먼저 선택하기"
                );

                if (!userChoice) {
                    // 사용자가 취소를 선택하면 화풍 선택 영역으로 스크롤
                    const styleSelector = document.getElementById('opt-image-style');
                    if (styleSelector) {
                        styleSelector.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        styleSelector.focus();
                    }
                    return;
                }
            }

            const ratioBtn = document.querySelector('.opt-ratio.active') || document.querySelector('.opt-ratio');
            const ratio = ratioBtn ? ratioBtn.innerText : '16:9';
            const resolution = document.getElementById('opt-resolution')?.value || '2K';

            AppState.setScript(text);
            AppState.setRatio(ratio);
            AppState.setResolution(resolution);

            btn.disabled = true;
            btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 분석 중...`;

            const startTime = Date.now();

            try {
                const response = await fetch(`${CONFIG.endpoints.script}?ts=${Date.now()}`, {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic: text,
                        style: 'engaging',
                        imageStyle: imageStyle,  // 대본 분석실에서 선택한 화풍 사용
                        settings: {
                            model: "gpt-4o-mini",
                            temperature: 0.7
                        }
                    })
                });

                if (!response.ok) throw new Error(`서버 통신 실패: ${response.status}`);

                const rawText = await response.text();
                if (!rawText) throw new Error("서버로부터 빈 응답이 왔습니다.");

                let result;
                try {
                    result = JSON.parse(rawText);
                } catch (e) {
                    throw new Error("JSON 파싱 실패. 응답: " + rawText);
                }

                if (result.scenes && Array.isArray(result.scenes)) {
                    // 마스터 캐릭터 프롬프트 저장
                    if (result.masterCharacterPrompt) {
                        AppState.setMasterCharacterPrompt(result.masterCharacterPrompt);
                        console.log('👤 Master Character Prompt:', result.masterCharacterPrompt);
                    }

                    // 자동으로 모션 프롬프트 생성
                    result.scenes.forEach(scene => {
                        if (scene.imagePrompt && !scene.motionPrompt) {
                            // 이미지 프롬프트를 기반으로 모션 프롬프트 자동 생성
                            scene.motionPrompt = this.generateMotionPrompt(scene.imagePrompt, scene.originalScript);
                        }
                    });

                    AppState.setScenes(result.scenes);

                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    const avgTimePerScene = (elapsed / result.scenes.length).toFixed(1);

                    const masterCharMsg = result.masterCharacterPrompt ? '\n👤 주인공 마스터 프롬프트가 생성되었습니다.' : '';

                    alert(`✅ 스크립트 분석 완료!\n\n` +
                        `📊 결과:\n` +
                        `• 생성된 장면: ${result.scenes.length}개\n` +
                        `• 처리 시간: ${elapsed}초\n` +
                        `• 평균 시간: ${avgTimePerScene}초/장면\n\n` +
                        `🎨 이미지 프롬프트와 모션 프롬프트가 자동 설정되었습니다.${masterCharMsg}`
                    );

                    // 자동화 모드 체크
                    if (AppState.getAutomation('script')) {
                        console.log('🤖 자동화 모드: 이미지 작업실로 자동 이동');
                        if (window.app) window.app.route('image');
                    } else if (window.app) {
                        window.app.route('image');
                    }
                } else {
                    throw new Error("분석 결과에 장면(scenes) 데이터가 없습니다.");
                }
            } catch (e) {
                console.error("Fetch Error:", e);

                // 에러 메시지 개선
                let helpText = '\n\n💡 해결 방법:\n';
                const errorMsg = e.message.toLowerCase();

                if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
                    helpText += '• 인터넷 연결을 확인하세요.\n• 백엔드 서버가 실행 중인지 확인하세요 (localhost:8000).';
                } else if (errorMsg.includes('json') || errorMsg.includes('파싱')) {
                    helpText += '• 서버 응답이 올바르지 않습니다.\n• 백엔드 로그를 확인해보세요.';
                } else if (errorMsg.includes('timeout') || errorMsg.includes('시간')) {
                    helpText += '• 스크립트가 너무 길거나 복잡합니다.\n• 더 짧은 스크립트로 시도해보세요.';
                } else {
                    helpText += '• 스크립트 내용을 확인하세요.\n• 백엔드 서버 상태를 확인하세요.';
                }

                alert(`❌ 스크립트 분석 실패\n\n오류: ${e.message}${helpText}`);
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i> 분석 시작`;
                lucide.createIcons();
            }
        });

        // Ratio selector
        const ratios = document.querySelectorAll('.opt-ratio');
        ratios.forEach(r => r.addEventListener('click', () => {
            ratios.forEach(b => {
                b.classList.remove('active', 'border-blue-500', 'text-blue-400');
                b.classList.add('border-slate-700', 'text-slate-400');
            });
            r.classList.remove('border-slate-700', 'text-slate-400');
            r.classList.add('active', 'border-blue-500', 'text-blue-400');
        }));

        // Automation toggle
        const automationToggle = document.getElementById('toggle-automation-script');
        if (automationToggle) {
            automationToggle.addEventListener('change', (e) => {
                AppState.setAutomation('script', e.target.checked);
            });
        }

        // Export as JSON
        const btnExportJSON = document.getElementById('btn-export-script-json');
        if (btnExportJSON) {
            btnExportJSON.addEventListener('click', () => {
                const scenes = AppState.getScenes();

                if (!scenes || scenes.length === 0) {
                    return alert('내보낼 장면 데이터가 없습니다.\n먼저 대본을 분석해주세요.');
                }

                const exportData = {
                    exportDate: new Date().toISOString(),
                    totalScenes: scenes.length,
                    settings: {
                        style: AppState.style,
                        ratio: AppState.ratio,
                        resolution: AppState.resolution
                    },
                    originalScript: AppState.getScript(),
                    scenes: scenes.map(scene => ({
                        sceneId: scene.sceneId,
                        originalScript: scene.originalScript,
                        imagePrompt: scene.imagePrompt,
                        motionPrompt: scene.motionPrompt || '',
                        groupId: scene.groupId || null,
                        hasImage: !!scene.generatedUrl,
                        hasAudio: !!scene.audioUrl,
                        hasVideo: !!scene.videoUrl
                    }))
                };

                const jsonString = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = `script_analysis_${Date.now()}.json`;
                link.click();

                URL.revokeObjectURL(url);
                alert(`✅ JSON 파일이 다운로드되었습니다.\n총 ${scenes.length}개 장면 데이터 포함`);
            });
        }

        // Export as TXT
        const btnExportTXT = document.getElementById('btn-export-script-txt');
        if (btnExportTXT) {
            btnExportTXT.addEventListener('click', () => {
                const scenes = AppState.getScenes();

                if (!scenes || scenes.length === 0) {
                    return alert('내보낼 장면 데이터가 없습니다.\n먼저 대본을 분석해주세요.');
                }

                let txtContent = `=================================================\n`;
                txtContent += `📝 대본 분석 결과\n`;
                txtContent += `=================================================\n\n`;
                txtContent += `생성 일시: ${new Date().toLocaleString('ko-KR')}\n`;
                txtContent += `총 장면 수: ${scenes.length}개\n`;
                txtContent += `설정: ${AppState.style || 'N/A'} / ${AppState.ratio || 'N/A'} / ${AppState.resolution || 'N/A'}\n\n`;
                txtContent += `=================================================\n\n`;

                txtContent += `[원본 대본]\n`;
                txtContent += `${AppState.getScript() || '(없음)'}\n\n`;
                txtContent += `=================================================\n\n`;

                txtContent += `[장면 분석 결과]\n\n`;

                scenes.forEach((scene, index) => {
                    txtContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                    txtContent += `Scene #${scene.sceneId}${scene.groupId ? ` (Group ${scene.groupId})` : ''}\n`;
                    txtContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

                    txtContent += `[대본]\n${scene.originalScript}\n\n`;

                    if (scene.imagePrompt) {
                        txtContent += `[이미지 프롬프트]\n${scene.imagePrompt}\n\n`;
                    }

                    if (scene.motionPrompt) {
                        txtContent += `[모션 프롬프트]\n${scene.motionPrompt}\n\n`;
                    }

                    const status = [];
                    if (scene.generatedUrl) status.push('✓ 이미지');
                    if (scene.audioUrl) status.push('✓ 오디오');
                    if (scene.videoUrl) status.push('✓ 비디오');

                    if (status.length > 0) {
                        txtContent += `[생성 상태] ${status.join(', ')}\n\n`;
                    }
                });

                txtContent += `=================================================\n`;
                txtContent += `End of Report\n`;
                txtContent += `=================================================\n`;

                const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = `script_analysis_${Date.now()}.txt`;
                link.click();

                URL.revokeObjectURL(url);
                alert(`✅ TXT 파일이 다운로드되었습니다.\n총 ${scenes.length}개 장면 데이터 포함`);
            });
        }
    }

    generateMotionPrompt(imagePrompt, script) {
        /**
         * 이미지 프롬프트와 대본을 기반으로 모션 프롬프트 자동 생성 (4-Section 구조)
         * 1. Camera Movement
         * 2. Subject Action
         * 3. Environment Effect
         * 4. Tone & Speed
         */

        // 키워드 기반 모션 스타일 결정
        const lowerPrompt = imagePrompt.toLowerCase();
        const lowerScript = script.toLowerCase();

        // 4-Section 구조의 모션 프롬프트 라이브러리
        const motionLibrary = [
            "Slowly zoom in, stickman nods gently, background subtly glows, smooth and calm at slow pace",
            "Smooth pan left, stickman smiles slightly, soft light shifts across scene, calming atmosphere with smooth motion",
            "Dolly-in smoothly, stickman points with gentle gesture, chart numbers gently pulse, slow motion with peaceful tone",
            "Gentle pan right, stickman tilts head thoughtfully, background elements softly float, very smooth and serene movement",
            "Slow zoom out, stickman waves hand subtly, ambient particles drift slowly, calm and steady pacing",
            "Static with slight drift, stickman breathes naturally, soft shadows move gently, minimal movement with tranquil feel",
            "Smooth tracking right, stickman turns head slightly, background blur shifts softly, slow and elegant motion",
            "Subtle dolly-out, stickman adjusts stance gently, light flickers softly, smooth camera with calming speed",
            "Slow push in, stickman blinks and smiles, background shapes pulse gently, very smooth with peaceful atmosphere",
            "Gentle arc movement, stickman gestures with one hand, soft reflections shimmer, slow motion with serene tone"
        ];

        let selectedMotion;

        // 동적인 장면
        if (lowerPrompt.includes("action") || lowerPrompt.includes("running") ||
            lowerPrompt.includes("fast") || lowerScript.includes("빠르게") ||
            lowerScript.includes("달리")) {
            selectedMotion = "Quick pan following subject, stickman moves dynamically, motion blur trails, energetic pace with dynamic feel";
        }
        // 평화로운 장면
        else if (lowerPrompt.includes("peaceful") || lowerPrompt.includes("calm") ||
                 lowerPrompt.includes("serene") || lowerScript.includes("평화") ||
                 lowerScript.includes("조용")) {
            selectedMotion = "Gentle dolly-out, stickman rests peacefully, soft breeze effect in background, very slow and calming motion";
        }
        // 극적인 장면
        else if (lowerPrompt.includes("dramatic") || lowerPrompt.includes("intense") ||
                 lowerScript.includes("극적") || lowerScript.includes("강렬")) {
            selectedMotion = "Dramatic push in, stickman shows strong emotion, dramatic lighting shifts, intense but controlled pacing";
        }
        // 회전/파노라마 장면
        else if (lowerPrompt.includes("landscape") || lowerPrompt.includes("panorama") ||
                 lowerPrompt.includes("wide") || lowerScript.includes("전경") ||
                 lowerScript.includes("풍경")) {
            selectedMotion = "Slow circular orbit, stickman stays centered, environment rotates smoothly around subject, calm and steady pacing";
        }
        // 클로즈업
        else if (lowerPrompt.includes("close-up") || lowerPrompt.includes("face") ||
                 lowerPrompt.includes("detail") || lowerScript.includes("얼굴") ||
                 lowerScript.includes("표정")) {
            selectedMotion = "Slow push in, stickman shows facial expression, background softly blurs, intimate and focused pacing";
        }
        // 기본값: 라이브러리에서 랜덤 선택
        else {
            const randomIndex = Math.floor(Math.random() * motionLibrary.length);
            selectedMotion = motionLibrary[randomIndex];
        }

        return selectedMotion;
    }
}
