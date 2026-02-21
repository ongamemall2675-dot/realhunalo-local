// API 기본 URL 가져오기 (포트 8000 백엔드 서버)
import { API_BASE_URL } from '../config.js';

export const CharacterLibraryModule = {
    // 저장된 캐릭터 목록
    characters: [],

    init() {
        console.log("Initialize CharacterLibraryModule");
        this.renderModal();
        this.attachEventListeners();
        this.loadCharacters();
    },

    renderModal() {
        // 기존 모달이 있으면 제거
        const existing = document.getElementById('character-library-modal');
        if (existing) existing.remove();

        const modalHtml = `
        <div id="character-library-modal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 hidden backdrop-blur-sm">
            <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                <!-- Header -->
                <div class="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                            <i data-lucide="users" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-white tracking-tight">캐릭터 라이브러리</h2>
                            <p class="text-sm text-slate-400">일관된 AI 비디오를 위한 캐릭터 JSON 프로필 저장소</p>
                        </div>
                    </div>
                    <button id="btn-close-char-modal" class="text-slate-400 hover:text-white transition p-2 hover:bg-slate-800 rounded-xl">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                </div>

                <!-- Body -->
                <div class="flex-1 overflow-y-auto p-6 flex gap-6">
                    
                    <!-- Left: Upload & Analyze -->
                    <div class="w-1/3 flex flex-col gap-4 border-r border-slate-700 pr-6">
                        <h3 class="font-bold text-white mb-2 flex items-center gap-2">
                            <i data-lucide="upload-cloud" class="w-4 h-4 text-emerald-400"></i> 새 캐릭터 추가
                        </h3>
                        
                        <div class="flex flex-col gap-3">
                            <label class="text-sm text-slate-300 font-medium">1. 레퍼런스 이미지 업로드</label>
                            <label for="char-image-upload" class="border-2 border-dashed border-slate-600 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-500/10 transition group">
                                <i data-lucide="image-plus" class="w-8 h-8 text-slate-400 group-hover:text-emerald-400 mb-2"></i>
                                <span class="text-sm text-slate-400 group-hover:text-emerald-300 text-center" id="char-upload-text">클릭하여 이미지 찾기<br><span class="text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent rounded mt-1">(또는 드래그 앤 드롭)</span></span>
                            </label>
                            <input type="file" id="char-image-upload" accept="image/*" class="hidden" />
                            <img id="char-image-preview" class="hidden w-full h-40 object-cover rounded-xl border border-slate-700 mx-auto" />
                        </div>

                        <div class="flex flex-col gap-2 mt-2">
                            <label class="text-sm text-slate-300 font-medium">2. 캐릭터 이름</label>
                            <input type="text" id="char-name-input" placeholder="예: 중년 CEO 김대표" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 outline-none transition text-sm">
                        </div>

                        <button id="btn-analyze-char" class="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed">
                            <i data-lucide="scan" class="w-4 h-4"></i>
                            이미지 분석 & JSON 추출
                        </button>
                    </div>

                    <!-- Right: Library List & Selection -->
                    <div class="w-2/3 flex flex-col">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="font-bold text-white flex items-center gap-2">
                                <i data-lucide="library" class="w-4 h-4 text-blue-400"></i> 저장된 프로필
                            </h3>
                            <button id="btn-refresh-chars" class="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition">
                                <i data-lucide="refresh-cw" class="w-3 h-3"></i> 새로고침
                            </button>
                        </div>
                        
                        <div id="char-list-container" class="grid grid-cols-2 gap-4 auto-rows-max">
                            <!-- JS will populate characters here -->
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 border-t border-slate-700 bg-slate-900 flex justify-between items-center hidden" id="char-json-preview-footer">
                    <div class="text-sm font-medium text-emerald-400 flex items-center gap-2">
                        <i data-lucide="check-circle" class="w-4 h-4"></i> 분석 완료!
                    </div>
                    <button id="btn-save-analyzed-char" class="py-2 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition flex items-center gap-2">
                        <i data-lucide="save" class="w-4 h-4"></i>
                        라이브러리에 저장
                    </button>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        lucide.createIcons();
    },

    attachEventListeners() {
        const modal = document.getElementById('character-library-modal');
        const btnClose = document.getElementById('btn-close-char-modal');

        btnClose.addEventListener('click', () => modal.classList.add('hidden'));

        // Upload Logic
        const uploadInput = document.getElementById('char-image-upload');
        const previewImg = document.getElementById('char-image-preview');
        const uploadText = document.getElementById('char-upload-text');

        // base64 보관용
        this.currentUploadedBase64 = null;
        this.currentAnalyzedJson = null;

        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                previewImg.src = event.target.result;
                previewImg.classList.remove('hidden');
                uploadText.parentElement.classList.add('hidden');
                this.currentUploadedBase64 = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        previewImg.addEventListener('click', () => uploadInput.click()); // 이미지 클릭시 재업로드

        // Analyze Logic
        const btnAnalyze = document.getElementById('btn-analyze-char');
        btnAnalyze.addEventListener('click', async () => {
            if (!this.currentUploadedBase64) {
                alert("먼저 레퍼런스 이미지를 업로드해주세요.");
                return;
            }

            const nameInput = document.getElementById('char-name-input').value.trim();
            if (!nameInput) {
                alert("캐릭터 이름을 입력해주세요.");
                return;
            }

            const originalHTML = btnAnalyze.innerHTML;
            btnAnalyze.disabled = true;
            btnAnalyze.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Vision AI 분석 중...`;
            lucide.createIcons();

            try {
                const response = await fetch(`${API_BASE_URL}/api/analyze-character-image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: this.currentUploadedBase64 })
                });

                if (!response.ok) throw new Error("분석 요청 실패");
                const result = await response.json();

                if (result.success && result.json_profile) {
                    this.currentAnalyzedJson = result.json_profile;
                    document.getElementById('char-json-preview-footer').classList.remove('hidden');
                    alert("캐릭터 특징이 완벽하게 추출되었습니다!\n우측 하단의 [라이브러리에 저장] 버튼을 눌러주세요.");
                } else {
                    throw new Error("결과 파싱 오류");
                }
            } catch (error) {
                console.error(error);
                alert("분석에 실패했습니다: " + error.message);
            } finally {
                btnAnalyze.disabled = false;
                btnAnalyze.innerHTML = originalHTML;
                lucide.createIcons();
            }
        });

        // Save Logic
        const btnSave = document.getElementById('btn-save-analyzed-char');
        btnSave.addEventListener('click', async () => {
            if (!this.currentAnalyzedJson) return;

            const nameInput = document.getElementById('char-name-input').value.trim();

            try {
                const response = await fetch(`${API_BASE_URL}/api/characters`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: nameInput,
                        json_profile: this.currentAnalyzedJson
                    })
                });

                if (!response.ok) throw new Error("저장 실패");

                alert(`캐릭터 '${nameInput}' 저장 완료!`);

                // 폼 리셋
                previewImg.classList.add('hidden');
                uploadText.parentElement.classList.remove('hidden');
                document.getElementById('char-name-input').value = '';
                document.getElementById('char-json-preview-footer').classList.add('hidden');
                this.currentUploadedBase64 = null;
                this.currentAnalyzedJson = null;

                // 목록 재요청
                this.loadCharacters();
            } catch (e) {
                alert("저장 오류: " + e.message);
            }
        });

        // Refresh Logic
        document.getElementById('btn-refresh-chars').addEventListener('click', () => this.loadCharacters());
    },

    async loadCharacters() {
        try {
            const container = document.getElementById('char-list-container');
            container.innerHTML = `<div class="col-span-2 text-center text-slate-500 py-10"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2"></i>로드 중...</div>`;
            lucide.createIcons();

            const response = await fetch(`${API_BASE_URL}/api/characters`);
            const data = await response.json();

            if (data.success) {
                this.characters = data.characters;
                this.renderCharacterList();
            }
        } catch (error) {
            console.error(error);
            document.getElementById('char-list-container').innerHTML = `<div class="col-span-2 text-center text-red-500 py-10">목록을 불러오지 못했습니다.</div>`;
        }
    },

    renderCharacterList() {
        const container = document.getElementById('char-list-container');
        container.innerHTML = '';

        if (this.characters.length === 0) {
            container.innerHTML = `<div class="col-span-2 flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
                <i data-lucide="ghost" class="w-12 h-12 mb-3 opacity-50"></i>
                <p>저장된 캐릭터가 없습니다.</p>
                <p class="text-xs mt-1">왼쪽에서 이미지를 업로드하고 분석해보세요!</p>
            </div>`;
            lucide.createIcons();
            return;
        }

        this.characters.forEach(char => {
            const card = document.createElement('div');
            card.className = "bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col gap-3 group relative overflow-hidden transition hover:border-blue-500/50 hover:bg-slate-800/80";

            // Generate a quick summary from JSON
            let summary = "정보 없음";
            if (char.json_profile && char.json_profile.subject) {
                const sub = (char.json_profile.subject.type || 'human');
                const cloth = char.json_profile.appearance?.clothing?.value || '일반 복장';
                summary = `[${sub}] ${cloth}`.substring(0, 30) + '...';
            }

            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <h4 class="font-bold text-white text-lg truncate pr-6">${char.name}</h4>
                    <button class="btn-delete-char absolute top-4 right-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition" data-id="${char.id}">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
                <div class="text-xs text-slate-400 bg-slate-900 rounded-lg p-2 font-mono truncate">
                    ${summary}
                </div>
                <button class="btn-apply-char mt-auto w-full py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-sm transition flex items-center justify-center gap-2" data-id="${char.id}">
                    <i data-lucide="check" class="w-4 h-4"></i> 프로젝트 마스터 캐스팅
                </button>
            `;
            container.appendChild(card);
        });
        lucide.createIcons();

        // 딜리트 이벤트
        document.querySelectorAll('.btn-delete-char').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('이 캐릭터를 삭제하시겠습니까?')) return;

                const id = btn.getAttribute('data-id');
                try {
                    const res = await fetch(`${API_BASE_URL}/api/characters/${id}`, { method: 'DELETE' });
                    if (res.ok) this.loadCharacters();
                } catch (e) {
                    alert('삭제 실패');
                }
            });
        });

        // 등록(적용) 이벤트
        document.querySelectorAll('.btn-apply-char').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.getAttribute('data-id');
                const char = this.characters.find(c => c.id === id);
                if (char) {
                    // AppState에 적용 (포맷은 AudioSegmentation output 규격과 호환되게 Array로 감싸서)
                    AppState.setMasterCharacterPrompt([
                        {
                            type: "Protagonist",
                            name: char.name,
                            description: "Visual JSON Profile Loaded. See AppState for details.",
                            json_profile: char.json_profile
                        }
                    ]);

                    document.getElementById('character-library-modal').classList.add('hidden');
                    alert(`✅ [${char.name}] 캐스팅 완료!\n이제 이미지 일괄 생성 시 해당 프로필이 최우선 참조됩니다.`);
                }
            });
        });
    },

    openModal() {
        const modal = document.getElementById('character-library-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.loadCharacters();
        }
    }
};
