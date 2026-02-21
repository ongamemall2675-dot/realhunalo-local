export class VrewAutoFillUI {
    static render() {
        return `
            <div class="max-w-4xl mx-auto pb-20 fade-in relative z-10 block-drag">
                <!-- Header Section -->
                <div class="mb-10 text-center pointer-events-none">
                    <div class="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.15)] ring-1 ring-white/10 relative group">
                        <div class="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full group-hover:bg-indigo-500/20 transition-all duration-500"></div>
                        <i data-lucide="layers" class="w-10 h-10 relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"></i>
                    </div>
                    <h1 class="text-4xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-purple-200 tracking-tight">Vrew 구조 자동 배치</h1>
                    <p class="text-slate-400 max-w-xl mx-auto leading-relaxed font-medium">대본이 세팅된 <b>.vrew 파일</b>과 번호가 매겨진 <b>미디어 파일(001_xxx.jpg)</b>들을 함께 끌어다 놓으세요. 번호에 맞춰 클립에 자동 배치된 결과물을 다운로드할 수 있습니다.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    
                    <!-- 1. Vrew 파일 드롭존 -->
                    <div class="glass-card rounded-3xl p-6 border border-white/5 flex flex-col items-center justify-center w-full min-h-[300px] transition-all duration-300 relative overflow-hidden group">
                        <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        <div class="text-indigo-400 bg-indigo-500/10 p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                            <i data-lucide="file-video" class="w-8 h-8 pointer-events-none"></i>
                        </div>
                        <h3 class="text-lg font-bold text-white mb-2 pointer-events-none">원본 Vrew 파일</h3>
                        <p class="text-xs text-slate-500 text-center mb-6 pointer-events-none">대본 불러오기만 완료된 .vrew 파일 1개를 여기에 올려주세요.</p>
                        
                        <!-- ID 기반 순수 드롭존 (이벤트 위임 타겟) -->
                        <div id="vrew-dropzone" class="w-full flex-1 border-2 border-dashed border-indigo-500/30 rounded-2xl flex flex-col items-center justify-center p-6 bg-slate-900/80 hover:bg-slate-800 hover:border-indigo-400 cursor-pointer transition-all relative group/zone">
                            <i data-lucide="upload-cloud" class="w-6 h-6 text-indigo-400 mb-2 pointer-events-none relative z-10 transition-transform group-hover/zone:scale-110"></i>
                            <span class="text-sm font-bold text-slate-200 pointer-events-none relative z-10 group-hover/zone:text-white transition-colors">클릭하거나 끌어다 놓기</span>
                            <input type="file" id="vrew-file-input" accept=".vrew" class="hidden" />
                        </div>
                        
                        <div id="vrew-file-info" class="hidden mt-4 px-4 py-2 w-full bg-slate-800/80 rounded-xl border border-slate-700/50 flex flex-col pointer-events-none">
                            <span class="text-xs font-bold text-indigo-400 truncate w-full flex items-center gap-2">
                                <i data-lucide="check-circle" class="w-3 h-3"></i> 
                                <span id="vrew-filename">file.vrew</span>
                            </span>
                            <span class="text-[10px] text-slate-500 mt-1" id="vrew-filesize">0 MB</span>
                        </div>
                        
                        <!-- Vrew 파일 상세 목록 -->
                        <div id="vrew-file-list" class="mt-2 w-full max-h-24 overflow-y-auto scrollbar-hide space-y-1"></div>
                    </div>

                    <!-- 2. 에셋 일괄 드롭존 -->
                    <div class="glass-card rounded-3xl p-6 border border-white/5 flex flex-col items-center justify-center w-full min-h-[300px] transition-all duration-300 relative overflow-hidden group">
                        <div class="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        <div class="text-purple-400 bg-purple-500/10 p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                            <i data-lucide="images" class="w-8 h-8 pointer-events-none"></i>
                        </div>
                        <h3 class="text-lg font-bold text-white mb-2 pointer-events-none">미디어 패키지 (이미지/영상)</h3>
                        <p class="text-xs text-slate-500 text-center mb-6 pointer-events-none"><b class="text-purple-300">001_배경.jpg</b> 처럼 번호가 지정된 이미지/영상을 모두 선택해서 올려주세요.</p>
                        
                        <!-- ID 기반 순수 드롭존 (폴더 드래그 허용) -->
                        <div id="media-dropzone" class="w-full flex-1 border-2 border-dashed border-purple-500/30 rounded-2xl flex flex-col items-center justify-center p-6 bg-slate-900/80 hover:bg-slate-800 hover:border-purple-400 cursor-pointer transition-all relative group/zone">
                            <i data-lucide="upload-cloud" class="w-6 h-6 text-purple-400 mb-2 pointer-events-none relative z-10 transition-transform group-hover/zone:scale-110"></i>
                            <span class="text-sm font-bold text-slate-200 pointer-events-none relative z-10 group-hover/zone:text-white transition-colors">클릭하여 파일/폴더 선택 (또는 드래그)</span>
                            <input type="file" id="media-files-input" webkitdirectory directory multiple class="hidden" />
                        </div>
                        
                        <div id="media-files-info" class="hidden mt-4 px-4 py-2 w-full bg-slate-800/80 rounded-xl border border-slate-700/50 flex items-center justify-between">
                            <span class="text-xs font-bold text-purple-400 flex items-center gap-2 pointer-events-none">
                                <i data-lucide="check-circle" class="w-3 h-3"></i> 
                                <span id="media-count">0개 파일</span>
                            </span>
                            <button id="btn-clear-media" class="text-[10px] text-slate-400 hover:text-red-400 underline relative z-20">지우기</button>
                        </div>
                        
                        <!-- 미디어 파일 리스트 영역 -->
                        <div id="media-file-list" class="mt-2 w-full max-h-40 overflow-y-auto scrollbar-hide space-y-1 bg-black/20 rounded-lg p-2 empty:hidden"></div>
                    </div>

                </div>

                <!-- Action Bar -->
                <div class="glass-card rounded-2xl p-6 border border-white/10 flex items-center justify-between relative overflow-hidden shadow-2xl">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent pointer-events-none"></div>
                    <div class="relative z-10 flex flex-col pointer-events-none">
                        <h4 class="text-lg font-bold text-white mb-1">모든 준비가 끝났나요?</h4>
                        <p class="text-xs text-slate-400">버튼을 누르면 15초 내에 자동 배치가 완료됩니다.</p>
                    </div>
                    <button id="btn-start-autofill" class="relative z-20 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-blue-900/40 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group">
                        <i data-lucide="wand-2" class="w-5 h-5 group-hover:rotate-12 transition-transform"></i>
                        <span>자동 배치 시작 & 다운로드</span>
                    </button>
                </div>

                <!-- Status / Result Banner -->
                <div id="autofill-status" class="hidden mt-6 px-6 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 border shadow-lg transition-all">
                    <!-- Injected by JS -->
                </div>

            </div>
        `;
    }
}
