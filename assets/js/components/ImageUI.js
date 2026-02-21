import { AppState } from '../state.js';

/**
 * Image UI Component
 * 미술 작업실의 HTML 렌더링을 전담하는 View 클래스입니다.
 */
export class ImageUI {
    static countSceneStatus(scenes) {
        let complete = 0;
        let pending = 0;
        let error = 0;

        scenes.forEach(s => {
            if (s.generatedUrl || (s.videoUrl && s.preferredVisual === 'video')) {
                if (s.imageError) error++;
                else complete++;
            } else {
                pending++;
            }
        });

        return { complete, pending, error };
    }

    static render(scenes, stats, imageSettings, styleCategories) {
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

                <!-- Settings Panel -->
                ${this.renderSettingsPanel(imageSettings, styleCategories)}

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
                        <button id="btn-gen-all-prompts-combined" class="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-purple-600/20 transition flex items-center gap-2">
                            <i data-lucide="sparkles" class="w-4 h-4"></i> 이미지·모션 프롬프트 일괄 생성
                        </button>
                        <button id="btn-gen-all" class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2">
                            <i data-lucide="play" class="w-4 h-4"></i> 전체 일괄 생성
                        </button>
                        <button id="btn-down-all" class="bg-slate-700 hover:bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="download-cloud" class="w-4 h-4"></i> 일괄 다운로드
                        </button>
                        <button id="btn-down-image-prompts" class="bg-slate-700 hover:bg-purple-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="file-text" class="w-4 h-4"></i> 이미지 프롬프트 다운로드
                        </button>
                        <button id="btn-down-motion-prompts" class="bg-slate-700 hover:bg-orange-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <i data-lucide="video" class="w-4 h-4"></i> 모션 프롬프트 다운로드
                        </button>

                        <!-- 이미지 일괄 업로드 -->
                        <div class="relative" id="bulk-upload-wrapper">
                            <button id="btn-bulk-upload" class="bg-slate-700 hover:bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                                <i data-lucide="upload-cloud" class="w-4 h-4"></i> 이미지 일괄 업로드
                                <i data-lucide="chevron-down" class="w-3 h-3"></i>
                            </button>
                            <div id="bulk-upload-menu" class="hidden absolute right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 min-w-[180px] overflow-hidden">
                                <button id="btn-bulk-files" class="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2">
                                    <i data-lucide="images" class="w-4 h-4 text-blue-400"></i> 파일 여러 개 선택
                                </button>
                                <div class="border-t border-slate-700"></div>
                                <button id="btn-bulk-folder" class="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2">
                                    <i data-lucide="folder-open" class="w-4 h-4 text-yellow-400"></i> 폴더 통째로 선택
                                </button>
                            </div>
                            <input type="file" id="bulk-files-input" multiple accept="image/*,video/*" class="hidden">
                            <input type="file" id="bulk-folder-input" webkitdirectory accept="image/*,video/*" class="hidden">
                        </div>
                    </div>
                </div>

                <!-- 일괄 업로드 드롭존 -->
                <div id="bulk-dropzone"
                     class="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-2xl p-6 text-center transition-all duration-200 cursor-pointer select-none"
                     ondragover="event.preventDefault(); event.stopPropagation(); this.classList.add('border-blue-400','bg-blue-500/10'); this.querySelector('#dropzone-label').classList.add('text-blue-400');"
                     ondragleave="event.stopPropagation(); this.classList.remove('border-blue-400','bg-blue-500/10'); this.querySelector('#dropzone-label').classList.remove('text-blue-400');"
                     ondrop="event.preventDefault(); event.stopPropagation(); this.classList.remove('border-blue-400','bg-blue-500/10'); this.querySelector('#dropzone-label').classList.remove('text-blue-400'); window._handleBulkDrop(event.dataTransfer.files);">
                    <i data-lucide="upload-cloud" class="w-8 h-8 text-slate-500 mx-auto mb-2"></i>
                    <p id="dropzone-label" class="text-sm text-slate-400 font-semibold transition-colors">
                        이미지·영상을 여기로 드래그하세요 &nbsp;—&nbsp; 여러 파일을 한번에 장면에 자동 배정합니다
                    </p>
                    <p class="text-xs text-slate-600 mt-1">파일명 번호 기준 매칭 → 순서 매칭 | 이미지 → generatedUrl · 영상 → videoUrl</p>
                </div>

                <!-- Progress Display (Hidden by default) -->

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
                            <div id="stat-total-generated" class="text-2xl font-bold text-white">${stats.totalGenerated}</div>
                            <div class="text-[10px] text-slate-500">총 생성</div>
                        </div>
                        <div>
                            <div id="stat-success-count" class="text-2xl font-bold text-green-400">${stats.successCount}</div>
                            <div class="text-[10px] text-slate-500">성공</div>
                        </div>
                        <div>
                            <div id="stat-error-count" class="text-2xl font-bold text-red-400">${stats.errorCount}</div>
                            <div class="text-[10px] text-slate-500">오류</div>
                        </div>
                        <div>
                            <div id="stat-avg-time" class="text-2xl font-bold text-blue-400">${stats.totalProcessingTime > 0 ? (stats.totalProcessingTime / stats.totalGenerated).toFixed(1) : '-'}</div>
                            <div class="text-[10px] text-slate-500">평균 시간(s)</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    static renderSettingsPanel(imageSettings, styleCategories) {
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
                    <div>
                        <button id="btn-toggle-stats" class="text-xs text-slate-500 hover:text-slate-300 transition inline-flex items-center gap-1">
                            <i data-lucide="bar-chart-3" class="w-3 h-3"></i> 통계 보기
                        </button>
                        <button id="btn-clear-cache" class="text-xs text-slate-500 hover:text-red-400 transition inline-flex items-center gap-1 ml-3">
                            <i data-lucide="trash" class="w-3 h-3"></i> 캐시 비우기
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-4 gap-4">
                    <!-- Model -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">모델</label>
                        <select id="image-model" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                            <option value="black-forest-labs/flux-schnell" ${imageSettings.model === 'black-forest-labs/flux-schnell' ? 'selected' : ''}>Flux Schnell (빠름)</option>
                            <option value="black-forest-labs/flux-pro" ${imageSettings.model === 'black-forest-labs/flux-pro' ? 'selected' : ''}>Flux Pro (고품질)</option>
                            <option value="black-forest-labs/flux-dev" ${imageSettings.model === 'black-forest-labs/flux-dev' ? 'selected' : ''}>Flux Dev (실험)</option>
                            <option value="google/nano-banana" ${imageSettings.model === 'google/nano-banana' ? 'selected' : ''}>나노 바나나 (Google)</option>
                            <option value="google/nano-banana-pro" ${imageSettings.model === 'google/nano-banana-pro' ? 'selected' : ''}>나노 바나나 프로 (Google)</option>
                            <option value="prunaai/hidream-l1-fast" ${imageSettings.model === 'prunaai/hidream-l1-fast' ? 'selected' : ''}>HiDream L1 Fast (Pruna AI)</option>
                            <option value="bytedance/seedream-4" ${imageSettings.model === 'bytedance/seedream-4' ? 'selected' : ''}>SeeDream 4 (ByteDance)</option>
                        </select>
                    </div>

                    <!-- Aspect Ratio -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">화면 비율</label>
                        <select id="image-aspect-ratio" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                            <option value="16:9" ${imageSettings.aspectRatio === '16:9' ? 'selected' : ''}>16:9 (가로)</option>
                            <option value="9:16" ${imageSettings.aspectRatio === '9:16' ? 'selected' : ''}>9:16 (세로)</option>
                            <option value="1:1" ${imageSettings.aspectRatio === '1:1' ? 'selected' : ''}>1:1 (정사각)</option>
                            <option value="4:3" ${imageSettings.aspectRatio === '4:3' ? 'selected' : ''}>4:3 (클래식)</option>
                            <option value="3:2" ${imageSettings.aspectRatio === '3:2' ? 'selected' : ''}>3:2 (사진)</option>
                        </select>
                    </div>

                    <!-- Num Outputs -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">출력 수</label>
                        <select id="image-num-outputs" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                            <option value="1" ${imageSettings.numOutputs === 1 ? 'selected' : ''}>1개 (기본)</option>
                            <option value="2" ${imageSettings.numOutputs === 2 ? 'selected' : ''}>2개</option>
                            <option value="4" ${imageSettings.numOutputs === 4 ? 'selected' : ''}>4개 (선택)</option>
                        </select>
                    </div>

                    <!-- Quality -->
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">품질</label>
                        <select id="image-quality" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                            <option value="70" ${imageSettings.outputQuality === 70 ? 'selected' : ''}>70 (낮음)</option>
                            <option value="85" ${imageSettings.outputQuality === 85 ? 'selected' : ''}>85 (보통)</option>
                            <option value="90" ${imageSettings.outputQuality === 90 ? 'selected' : ''}>90 (높음)</option>
                            <option value="95" ${imageSettings.outputQuality === 95 ? 'selected' : ''}>95 (최고)</option>
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
                        <option value="yeop_stickman" ${imageSettings.style === 'yeop_stickman' ? 'selected' : ''}>🏠 옆집부동산 졸라맨 - 수트, 포인터, DATA&FACT 가방</option>
                        <option value="stickman" ${imageSettings.style === 'stickman' || !imageSettings.style || imageSettings.style === 'none' ? 'selected' : ''}>⭐ 스틱맨 (졸라맨) - 파란 셔츠, 빨간 넥타이 (기본)</option>
                        <option value="none" ${imageSettings.style === 'none' ? 'selected' : ''}>🚫 스타일 미적용</option>

                        <!-- 애니메이션 & 만화 스타일 -->
                        <optgroup label="📺 애니메이션 & 만화 스타일">
                            <option value="animation" ${imageSettings.style === 'animation' ? 'selected' : ''}>애니메이션 - 일본 애니메이션, 밝고 선명한 색감</option>
                            <option value="ghibli" ${imageSettings.style === 'ghibli' ? 'selected' : ''}>지브리 - 미야자키 스타일, 따뜻하고 향수적</option>
                            <option value="webtoon" ${imageSettings.style === 'webtoon' ? 'selected' : ''}>웹툰 - 한국 웹툰, 깔끔한 선과 밝은 색감</option>
                            <option value="comic_book" ${imageSettings.style === 'comic_book' ? 'selected' : ''}>만화책 - 미국 코믹북, 강렬한 외곽선과 망점</option>
                            <option value="european_graphic_novel" ${imageSettings.style === 'european_graphic_novel' ? 'selected' : ''}>유럽풍 그래픽 노블 - 명확한 선과 수채화</option>
                            <option value="3d_animation" ${imageSettings.style === '3d_animation' ? 'selected' : ''}>3D 애니메이션 - 픽사 스타일, 부드러운 렌더링</option>
                            <option value="claymation" ${imageSettings.style === 'claymation' ? 'selected' : ''}>클레이 애니메이션 - 점토 인형, 수작업 질감</option>
                        </optgroup>

                        <!-- 실사 & 시네마틱 -->
                        <optgroup label="🎬 실사 & 시네마틱">
                            <option value="cinematic_photorealistic" ${imageSettings.style === 'cinematic_photorealistic' ? 'selected' : ''}>시네마틱 실사 - 영화 같은 실사, 극적인 조명</option>
                            <option value="kdrama_realistic" ${imageSettings.style === 'kdrama_realistic' ? 'selected' : ''}>K-드라마 실사 - 한국 드라마, 감성적 실사</option>
                            <option value="noir" ${imageSettings.style === 'noir' ? 'selected' : ''}>느와르 - 흑백 영화, 강렬한 명암 대비</option>
                        </optgroup>

                        <!-- 일러스트 & 그림 -->
                        <optgroup label="✏️ 일러스트 & 그림">
                            <option value="illustration" ${imageSettings.style === 'illustration' ? 'selected' : ''}>일러스트 - 현대적 디지털 일러스트</option>
                            <option value="hand_drawn" ${imageSettings.style === 'hand_drawn' ? 'selected' : ''}>손그림 스타일 - 자연스러운 스케치 터치</option>
                            <option value="fairy_tale_illustration" ${imageSettings.style === 'fairy_tale_illustration' ? 'selected' : ''}>동화 일러스트 - 동화책, 환상적 색감</option>
                            <option value="emotional_historical_illustration" ${imageSettings.style === 'emotional_historical_illustration' ? 'selected' : ''}>감성 사극 일러스트 - 한국 사극, 전통 한복</option>
                            <option value="web_novel_signature" ${imageSettings.style === 'web_novel_signature' ? 'selected' : ''}>웹소설 시그니쳐 - 판타지 로맨스 표지</option>
                            <option value="oriental_folklore_illustration" ${imageSettings.style === 'oriental_folklore_illustration' ? 'selected' : ''}>동양 설화 일러스트 - 수묵화 요소, 신비로운 분위기</option>
                        </optgroup>

                        <!-- 페인팅 기법 -->
                        <optgroup label="🖌️ 페인팅 기법">
                            <option value="watercolor" ${imageSettings.style === 'watercolor' ? 'selected' : ''}>수채화 - 부드러운 번짐, 은은한 색감</option>
                            <option value="oil_painting" ${imageSettings.style === 'oil_painting' ? 'selected' : ''}>유화 - 두꺼운 붓터치, 풍부한 질감</option>
                            <option value="pencil_drawing" ${imageSettings.style === 'pencil_drawing' ? 'selected' : ''}>연필그림 - 섬세한 음영, 흑백 스케치</option>
                        </optgroup>

                        <!-- 디자인 & 스타일 -->
                        <optgroup label="🎯 디자인 & 스타일">
                            <option value="flat_vector" ${imageSettings.style === 'flat_vector' ? 'selected' : ''}>플랫 벡터 - 플랫 디자인, 미니멀 기하학</option>
                            <option value="vintage" ${imageSettings.style === 'vintage' ? 'selected' : ''}>빈티지 - 복고풍, 바랜 색감</option>
                            <option value="pixel_art" ${imageSettings.style === 'pixel_art' ? 'selected' : ''}>픽셀아트 - 8비트 레트로 게임 감성</option>
                            <option value="neon_punk" ${imageSettings.style === 'neon_punk' ? 'selected' : ''}>네온펑크 - 사이버펑크, 형광 네온색</option>
                        </optgroup>

                        <!-- 공예 & 입체 -->
                        <optgroup label="🎭 공예 & 입체">
                            <option value="wool_felt_doll" ${imageSettings.style === 'wool_felt_doll' ? 'selected' : ''}>동화 양모인형 - 양모 펠트, 포근한 질감</option>
                            <option value="diorama" ${imageSettings.style === 'diorama' ? 'selected' : ''}>디오라마 - 미니어처 모형, 틸트 시프트</option>
                            <option value="low_poly" ${imageSettings.style === 'low_poly' ? 'selected' : ''}>로우폴리 - 로우 폴리곤 3D, 각진 면</option>
                            <option value="origami" ${imageSettings.style === 'origami' ? 'selected' : ''}>오리가미 - 종이접기, 기하학적 조각</option>
                            <option value="3d_model" ${imageSettings.style === '3d_model' ? 'selected' : ''}>3D 모델 - 사실적 3D 렌더링</option>
                            <option value="craft_clay" ${imageSettings.style === 'craft_clay' ? 'selected' : ''}>공예/점토 - 점토 공예, 도자기 질감</option>
                        </optgroup>
                    </select>

                    <!-- 선택된 스타일 정보 표시 -->
                    <div id="style-info" class="mt-3 ${imageSettings.style === 'none' ? 'hidden' : ''} p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/40 rounded-xl">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="sparkles" class="w-4 h-4 text-purple-300"></i>
                            <span class="text-xs text-purple-300 font-bold">선택된 화풍 정보</span>
                        </div>
                        <div class="mb-2">
                            <span class="text-[10px] text-slate-500 font-semibold">화풍명:</span>
                            <span id="style-name-preview" class="text-[11px] text-white font-semibold ml-2">
                                ${imageSettings.style !== 'none' && styleCategories[imageSettings.style]
                ? styleCategories[imageSettings.style].name
                : ''}
                            </span>
                        </div>
                        <div class="mb-2">
                            <span class="text-[10px] text-slate-500 font-semibold">설명:</span>
                            <span id="style-desc-preview" class="text-[10px] text-slate-300 ml-2">
                                ${imageSettings.style !== 'none' && styleCategories[imageSettings.style]
                ? styleCategories[imageSettings.style].description
                : ''}
                            </span>
                        </div>
                        <div class="pt-2 border-t border-purple-500/20">
                            <div class="text-[9px] text-purple-400 font-semibold mb-1">📝 적용될 프롬프트:</div>
                            <div id="style-prompt-preview" class="text-[10px] text-slate-400 font-mono italic leading-relaxed">
                                ${imageSettings.style !== 'none' && styleCategories[imageSettings.style]
                ? styleCategories[imageSettings.style].prompt
                : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 레퍼런스 이미지 섹션 -->
                <div class="mt-4 pt-4 border-t border-slate-700/50">
                    <div class="flex justify-between items-center mb-3">
                        <div class="flex items-center gap-2">
                            <i data-lucide="image-plus" class="w-4 h-4 text-cyan-400"></i>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">🎭 마스터 캐릭터 설정</label>
                        </div>
                        <button id="btn-open-char-library" class="text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition border border-blue-500/30">
                            <i data-lucide="library" class="w-3.5 h-3.5"></i> 캐릭터 라이브러리 열기
                        </button>
                    </div>

                    <!-- 마스터 캐릭터 프롬프트 목록 -->
                    <div id="master-character-section" class="mb-4">
                        ${this.renderMasterCharacterSection()}
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

    static renderMasterCharacterSection() {
        let charPrompts = AppState.getMasterCharacterPrompt();

        // 상태 1: 아직 생성된 적 없음
        if (charPrompts === '' || charPrompts === null || charPrompts === undefined) {
            return `
                <div class="flex items-start gap-3 p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
                    <i data-lucide="info" class="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5"></i>
                    <div>
                        <p class="text-xs font-bold text-slate-400">마스터 캐릭터 프롬프트를 생성하려면</p>
                        <p class="text-[11px] text-slate-500 mt-1">용람의 <b class="text-slate-300">오디오 분석실</b>에서 대본이 포함된 오디오를 분석하면 자동으로 추출됩니다.</p>
                    </div>
                </div>
            `;
        }

        // 상태 2: 응답이 왔지만 빈 배열 (분석 실패)
        if (Array.isArray(charPrompts) && charPrompts.length === 0) {
            return `
                <div class="flex items-start gap-3 p-4 bg-red-900/20 border border-red-500/40 rounded-xl">
                    <i data-lucide="alert-triangle" class="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"></i>
                    <div>
                        <p class="text-xs font-bold text-red-400">캐릭터 분석 결과: 쫙은 인물이 없습니다</p>
                        <p class="text-[11px] text-slate-400 mt-1">AI가 대본에서 시각적 특징이 나타난 인물을 찾지 못했습니다.<br/>대본에 인물의 <b class="text-slate-300">외모(나이, 복장, 얼굴 특징)</b>을 잔룬히 기술해 주세요.</p>
                    </div>
                </div>
            `;
        }

        // 상태 3: 문자열 형시 (old format)
        if (typeof charPrompts === 'string') {
            charPrompts = [{
                type: 'Protagonist',
                name: '주인공',
                description: charPrompts
            }];
        } else if (!Array.isArray(charPrompts)) {
            return `
                <div class="flex items-start gap-3 p-4 bg-yellow-900/20 border border-yellow-500/40 rounded-xl">
                    <i data-lucide="alert-circle" class="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5"></i>
                    <p class="text-xs text-yellow-400">잘못된 형식의 데이터입니다. 오디오 분석을 다시 실행해 주세요.</p>
                </div>
            `;
        }

        // 상태 4: 성공 (캐릭터 카드 표시)
        return `
            <div class="mb-2 flex items-center gap-2 text-[10px] text-emerald-400 font-bold">
                <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                캐릭터 ${charPrompts.length}명 추출 완료
            </div>
            ${charPrompts.map((char, idx) => `
            <div class="mb-3 p-4 bg-gradient-to-r ${char.type === 'Protagonist' || char.type === '\uc8fc\uc778\uacf5' ? 'from-cyan-900/30 to-blue-900/20 border-cyan-500/40' : 'from-slate-800/60 to-slate-900/40 border-slate-600/50'} border rounded-xl relative group">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i data-lucide="${char.type === 'Protagonist' || char.type === '\uc8fc\uc778\uacf5' ? 'user-check' : 'user'}" class="w-4 h-4 ${char.type === 'Protagonist' || char.type === '\uc8fc\uc778\uacf5' ? 'text-cyan-400' : 'text-slate-400'}"></i>
                        <span class="text-xs ${char.type === 'Protagonist' || char.type === '\uc8fc\uc778\uacf5' ? 'text-cyan-300' : 'text-slate-300'} font-bold">
                            [${char.type}] ${char.name}
                        </span>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn-generate-master-ref bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-lg shadow-cyan-900/20" data-char-idx="${idx}">
                            <i data-lucide="wand-2" class="w-3 h-3"></i> 캐릭터 이미지 생성
                        </button>
                    </div>
                </div>
                <div class="text-[11px] text-slate-400 font-mono italic leading-relaxed mb-3">
                    ${char.description}
                </div>
                <!-- 생성된 이미지 결과 표시 영역 -->
                <div id="master-char-result-${idx}" class="hidden pt-3 border-t border-slate-700/50 transition-all">
                    <div class="flex items-start gap-4">
                        <div class="relative w-24 h-24 bg-slate-900 rounded-lg border border-cyan-500/30 overflow-hidden flex-shrink-0 group/img cursor-pointer" onclick="window.openLightbox(this.querySelector('img').src)">
                            <img id="master-char-img-${idx}" src="" class="w-full h-full object-cover">
                            <div id="master-char-loading-${idx}" class="hidden absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10">
                                <i data-lucide="loader-2" class="w-5 h-5 text-cyan-400 animate-spin mb-1"></i>
                                <span class="text-[8px] text-cyan-300 font-bold">생성중...</span>
                            </div>
                        </div>
                        <div class="flex flex-col gap-2 justify-center h-24">
                            <button class="btn-apply-subject-ref bg-slate-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 w-fit" data-char-idx="${idx}">
                                <i data-lucide="arrow-down" class="w-3 h-3"></i> 피사체 참조로 등록
                            </button>
                            <button class="btn-download-master-char bg-slate-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 w-fit" data-char-idx="${idx}">
                                <i data-lucide="download" class="w-3 h-3"></i> 이미지 다운로드
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('')}`;
    }

    static renderStandalonePanel() {
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

    static renderManualAddPanel() {
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

    static renderSceneRow(scene) {
        const hasImage = !!scene.generatedUrl;
        const hasVideo = !!scene.videoUrl && scene.preferredVisual === 'video';
        const hasMedia = hasImage || hasVideo;
        const hasError = !!scene.imageError;

        let statusIcon, statusColor, statusText;
        if (hasVideo && !hasError) {
            statusIcon = 'video';
            statusColor = 'text-blue-400';
            statusText = '영상';
        } else if (hasImage && !hasError) {
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
                    <textarea class="scene-motion-prompt-edit w-full bg-slate-900/50 border border-orange-800/40 rounded-lg p-2 text-[11px] text-orange-300/70 font-mono italic resize-none h-12 scrollbar-hide focus:ring-1 focus:ring-orange-500 mt-1"
                        data-scene-id="${scene.sceneId}"
                        placeholder="모션 프롬프트 (편집 가능)">${scene.motionPrompt || ''}</textarea>
                </td>

                <!-- Preview Column -->
                <td class="py-4 px-4">
                    <div class="w-40 aspect-video bg-slate-900/50 rounded-lg border border-slate-700/50 flex items-center justify-center overflow-hidden relative group/img drop-zone"
                         data-scene-id="${scene.sceneId}"
                         data-drop-type="image"
                         ondragover="event.preventDefault(); this.classList.add('border-blue-500', 'ring-2', 'ring-blue-500/50');"
                         ondragleave="this.classList.remove('border-blue-500', 'ring-2', 'ring-blue-500/50');"
                         ondrop="window.handleAssetDrop(event, this)">
                        <div class="image-placeholder ${hasMedia ? 'hidden' : ''} text-[8px] text-slate-600 font-bold uppercase tracking-widest text-center px-2">
                            No Image<br><span class="text-[7px] opacity-60">Drag or Generate</span>
                        </div>
                        <img src="${scene.generatedUrl || ''}" class="${hasImage ? '' : 'hidden'} w-full h-full object-cover cursor-pointer"
                             id="img-${scene.sceneId}"
                             onclick="window.openLightbox(this.src)"
                             title="클릭하여 크게 보기">
                        <video src="${scene.videoUrl || ''}" class="${hasVideo ? '' : 'hidden'} w-full h-full object-cover"
                               id="vid-${scene.sceneId}"
                               muted playsinline
                               onmouseenter="this.play()" onmouseleave="this.pause(); this.currentTime=0;">
                        </video>
                        <div class="loading-overlay hidden absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                            <i data-lucide="loader-2" class="w-4 h-4 text-indigo-500 animate-spin"></i>
                        </div>
                        ${hasVideo ? '<div class="absolute top-2 right-2 bg-blue-600/80 text-white text-[9px] px-2 py-0.5 rounded font-bold">VIDEO</div>'
                : hasImage ? '<div class="absolute top-2 right-2 bg-green-600/80 text-white text-[9px] px-2 py-0.5 rounded font-bold">READY</div>' : ''}
                    </div>
                </td>

                <!-- Actions Column -->
                <td class="py-4 pr-6 text-right">
                    <div class="flex flex-col gap-2 scale-90 origin-right">
                        <button class="btn-gen-image bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1" data-id="${scene.sceneId}">
                            <i data-lucide="wand-2" class="w-3.5 h-3.5"></i> 생성
                        </button>
                        <button class="btn-down-image ${hasMedia ? '' : 'hidden'} ${hasVideo ? 'bg-blue-600/50 hover:bg-blue-600' : 'bg-slate-700 hover:bg-green-600'} text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                                id="btn-down-${scene.sceneId}" data-id="${scene.sceneId}">
                            <i data-lucide="${hasVideo ? 'video' : 'download'}" class="w-3.5 h-3.5"></i> ${hasVideo ? '영상 다운' : '이미지 다운'}
                        </button>
                        <button class="btn-delete-scene bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1" data-id="${scene.sceneId}">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> 삭제
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    static renderGuideButton() {
        return `
            <button onclick="window.TutorialManager.startTutorial('image')" class="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-xl text-xs font-bold transition">
                <i data-lucide="help-circle" class="w-3.5 h-3.5 text-blue-400"></i>
                가이드
            </button>
        `;
    }
}
