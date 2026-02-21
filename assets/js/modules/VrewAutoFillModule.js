import { VrewAutoFillUI } from '../components/VrewAutoFillUI.js';
import { API_BASE_URL } from '../config.js';

export class VrewAutoFillModule {
    /**
     * Vrew 자동 채우기 모듈 (프론트엔드 컨트롤러) - 캡처링 이벤트 위임 적용본 (검은 화면 완벽 차단)
     */
    constructor() {
        this.id = 'vrew-autofill';
        this.name = 'Vrew 오토필';
        this.icon = 'layers';
        this.desc = '미완성 Vrew 파일에 이미지와 영상을 자동으로 채워넣습니다';

        this.vrewFile = null;
        this.mediaFiles = [];

        // 메모리 누수 방지를 위한 바인딩
        this._globalDragEnter = this._globalDragEnter.bind(this);
        this._globalDragOver = this._globalDragOver.bind(this);
        this._globalDragLeave = this._globalDragLeave.bind(this);
        this._globalDrop = this._globalDrop.bind(this);
        this._globalClick = this._globalClick.bind(this);
        this._globalChange = this._globalChange.bind(this);
    }

    render() {
        return VrewAutoFillUI.render();
    }

    onMount() {
        this.vrewFile = null;
        this.mediaFiles = [];
        // 문서 최상위 레벨 "캡처링(Capture: true)" 등록 -> 브라우저 기본동작보다 우선!
        this.bindEvents();
    }

    onUnmount() {
        this.unbindEvents();
    }

    bindEvents() {
        // [핵심] { capture: true } 옵션으로 가장 먼저 이벤트를 낚아채서 e.preventDefault() 실행
        window.addEventListener('dragenter', this._globalDragEnter, { capture: true });
        window.addEventListener('dragover', this._globalDragOver, { capture: true });
        window.addEventListener('dragleave', this._globalDragLeave, { capture: true });
        window.addEventListener('drop', this._globalDrop, { capture: true });
        // 클릭과 체인지는 버블링으로 처리해도 충분함
        document.addEventListener('click', this._globalClick);
        document.addEventListener('change', this._globalChange);

        setTimeout(() => this.updateButtonState(), 200);
    }

    unbindEvents() {
        window.removeEventListener('dragenter', this._globalDragEnter, { capture: true });
        window.removeEventListener('dragover', this._globalDragOver, { capture: true });
        window.removeEventListener('dragleave', this._globalDragLeave, { capture: true });
        window.removeEventListener('drop', this._globalDrop, { capture: true });
        document.removeEventListener('click', this._globalClick);
        document.removeEventListener('change', this._globalChange);
    }

    _globalDragEnter(e) {
        e.preventDefault(); // 필수: 크롬 브라우저 검은 화면 방지용 1
        e.stopPropagation();
    }

    _globalDragOver(e) {
        e.preventDefault(); // 필수: 크롬 브라우저 검은 화면 방지용 2
        e.stopPropagation();

        const vrewDrop = e.target.closest('#vrew-dropzone');
        const mediaDrop = e.target.closest('#media-dropzone');

        const vEl = document.getElementById('vrew-dropzone');
        const mEl = document.getElementById('media-dropzone');

        if (vEl) vEl.classList.remove('border-indigo-400', 'bg-indigo-500/10');
        if (mEl) mEl.classList.remove('border-purple-400', 'bg-purple-500/10');

        if (vrewDrop && vEl) vEl.classList.add('border-indigo-400', 'bg-indigo-500/10');
        if (mediaDrop && mEl) mEl.classList.add('border-purple-400', 'bg-purple-500/10');
    }

    _globalDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();

        const vEl = document.getElementById('vrew-dropzone');
        const mEl = document.getElementById('media-dropzone');

        // 브라우저 밖으로 나갈 때 모든 하이라이트 제거
        if (!e.relatedTarget) {
            if (vEl) vEl.classList.remove('border-indigo-400', 'bg-indigo-500/10');
            if (mEl) mEl.classList.remove('border-purple-400', 'bg-purple-500/10');
        }
    }

    async _globalDrop(e) {
        // ★ 여기서 무조건 브라우저 기본동작(파일 열림 = 검은 화면)을 차단해야 합니다.
        e.preventDefault();
        e.stopPropagation();

        const vEl = document.getElementById('vrew-dropzone');
        const mEl = document.getElementById('media-dropzone');
        if (vEl) vEl.classList.remove('border-indigo-400', 'bg-indigo-500/10');
        if (mEl) mEl.classList.remove('border-purple-400', 'bg-purple-500/10');

        const vrewDrop = e.target.closest('#vrew-dropzone');
        const mediaDrop = e.target.closest('#media-dropzone');

        if (vrewDrop) {
            const files = e.dataTransfer.files;
            if (files && files.length > 0) this.handleVrewFile(files[0]);
        } else if (mediaDrop) {
            await this.processMediaDrop(e.dataTransfer);
        }
    }

    _globalClick(e) {
        const btnStart = e.target.closest('#btn-start-autofill');
        const btnClear = e.target.closest('#btn-clear-media');
        const vrewDrop = e.target.closest('#vrew-dropzone');
        const mediaDrop = e.target.closest('#media-dropzone');
        const isInput = e.target.tagName && e.target.tagName.toLowerCase() === 'input';
        const isButton = e.target.tagName && e.target.tagName.toLowerCase() === 'button';
        const vrewListRemove = e.target.closest('button[data-remove-media]');

        if (btnStart) {
            this.startAutofill(btnStart);
        } else if (vrewListRemove) {
            const idx = parseInt(vrewListRemove.getAttribute('data-remove-media'));
            this.removeMediaFile(idx);
        } else if (btnClear) {
            e.stopPropagation();
            this.mediaFiles = [];
            this.updateMediaUI();
            this.updateButtonState();
        } else if (vrewDrop && !isInput && !isButton) {
            document.getElementById('vrew-file-input')?.click();
        } else if (mediaDrop && !isInput && !isButton) {
            document.getElementById('media-files-input')?.click();
        }
    }

    _globalChange(e) {
        if (e.target.id === 'vrew-file-input') {
            if (e.target.files && e.target.files.length > 0) this.handleVrewFile(e.target.files[0]);
            e.target.value = '';
        } else if (e.target.id === 'media-files-input') {
            if (e.target.files && e.target.files.length > 0) this.handleMediaFiles(e.target.files);
            e.target.value = '';
        }
    }

    async processMediaDrop(dataTransfer) {
        const items = dataTransfer.items;
        if (items && items.length > 0) {
            const allFiles = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                    if (entry && entry.isDirectory) {
                        const filesFromDir = await this.readAllFilesFromDirectory(entry);
                        allFiles.push(...filesFromDir);
                    } else {
                        const file = item.getAsFile();
                        if (file) allFiles.push(file);
                    }
                }
            }
            if (allFiles.length > 0) this.handleMediaFiles(allFiles);
        } else {
            const files = dataTransfer.files;
            if (files && files.length > 0) this.handleMediaFiles(Array.from(files));
        }
    }

    readAllFilesFromDirectory(directoryEntry) {
        return new Promise((resolve) => {
            const files = [];
            const dirReader = directoryEntry.createReader();

            const readEntries = () => {
                dirReader.readEntries(async (entries) => {
                    if (entries.length === 0) {
                        resolve(files);
                    } else {
                        for (let i = 0; i < entries.length; i++) {
                            const entry = entries[i];
                            if (entry.isFile) {
                                if (!entry.name.startsWith('.')) {
                                    const file = await new Promise(res => entry.file(res));
                                    files.push(file);
                                }
                            } else if (entry.isDirectory) {
                                const subFiles = await this.readAllFilesFromDirectory(entry);
                                files.push(...subFiles);
                            }
                        }
                        readEntries();
                    }
                });
            };
            readEntries();
        });
    }

    handleVrewFile(file) {
        if (!file.name.toLowerCase().endsWith('.vrew')) {
            alert('.vrew 확장자 파일만 업로드 가능합니다.');
            return;
        }
        this.vrewFile = file;

        const filenameEl = document.getElementById('vrew-filename');
        const filesizeEl = document.getElementById('vrew-filesize');
        const fileInfoEl = document.getElementById('vrew-file-info');
        const fileListEl = document.getElementById('vrew-file-list');

        if (filenameEl) filenameEl.textContent = file.name;
        if (filesizeEl) filesizeEl.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
        if (fileInfoEl) fileInfoEl.classList.remove('hidden');

        if (fileListEl) {
            fileListEl.innerHTML = `
                <div class="flex items-center justify-between p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] text-slate-300">
                    <span class="truncate pr-4">${file.name}</span>
                    <i data-lucide="check" class="w-2.5 h-2.5 text-indigo-400"></i>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
        }

        this.updateButtonState();
    }

    handleMediaFiles(fileList) {
        const validExtensions = ['.jpg', '.jpeg', '.png', '.mp4'];
        const files = Array.from(fileList);

        files.sort((a, b) => {
            const numA = parseInt(a.name.split('_')[0]) || Number.MAX_SAFE_INTEGER;
            const numB = parseInt(b.name.split('_')[0]) || Number.MAX_SAFE_INTEGER;
            return numA - numB;
        });

        let added = 0;
        for (let file of files) {
            const nameLower = file.name.toLowerCase();
            const ext = nameLower.substring(nameLower.lastIndexOf('.'));

            if (validExtensions.includes(ext) && file.name.includes('_')) {
                this.mediaFiles.push(file);
                added++;
            }
        }

        if (added === 0) {
            alert('유효한 번호 형식(예: 001_xxx.jpg)의 미디어 파일만 업로드 가능합니다.');
        }

        this.updateMediaUI();
        this.updateButtonState();
    }

    updateMediaUI() {
        const infoEl = document.getElementById('media-files-info');
        const fileListEl = document.getElementById('media-file-list');

        if (this.mediaFiles.length > 0) {
            const countEl = document.getElementById('media-count');
            if (countEl) countEl.textContent = `선택된 에셋: ${this.mediaFiles.length}개`;
            if (infoEl) infoEl.classList.remove('hidden');

            if (fileListEl) {
                fileListEl.innerHTML = this.mediaFiles.map((file, idx) => `
                    <div class="flex items-center justify-between px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded-md text-[10px] text-slate-400 group/item">
                        <div class="flex items-center gap-2 overflow-hidden truncate">
                            <span class="text-slate-600 font-mono">${(idx + 1).toString().padStart(3, '0')}</span>
                            <span class="truncate text-slate-300">${file.name}</span>
                        </div>
                        <button data-remove-media="${idx}" class="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100 p-1">
                            <i data-lucide="x" class="w-3 h-3 pointer-events-none"></i>
                        </button>
                    </div>
                `).join('');
                if (window.lucide) window.lucide.createIcons();
            }
        } else {
            if (infoEl) infoEl.classList.add('hidden');
            if (fileListEl) fileListEl.innerHTML = '';
            const inputEl = document.getElementById('media-files-input');
            if (inputEl) inputEl.value = '';
        }
    }

    removeMediaFile(idx) {
        this.mediaFiles.splice(idx, 1);
        this.updateMediaUI();
        this.updateButtonState();
    }

    updateButtonState() {
        const btnStart = document.getElementById('btn-start-autofill');
        const isReady = this.vrewFile && this.mediaFiles.length > 0;

        if (!btnStart) return;

        if (isReady) {
            btnStart.removeAttribute('disabled');
            btnStart.classList.remove('opacity-50', 'cursor-not-allowed');
            btnStart.classList.add('hover:scale-105');
        } else {
            btnStart.setAttribute('disabled', 'true');
            btnStart.classList.add('opacity-50', 'cursor-not-allowed');
            btnStart.classList.remove('hover:scale-105');
        }
    }

    async startAutofill(btn) {
        if (!this.vrewFile || this.mediaFiles.length === 0) return;

        const originalContent = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i><span>자동 조합 중... (최대 1분 소요)</span>`;
        btn.setAttribute('disabled', 'true');
        window.lucide.createIcons();

        const statusEl = document.getElementById('autofill-status');
        if (statusEl) {
            statusEl.className = 'hidden mt-6 px-6 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 border shadow-lg transition-all';
            statusEl.innerHTML = '';
        }

        try {
            const formData = new FormData();
            formData.append('vrew_file', this.vrewFile);

            for (let i = 0; i < this.mediaFiles.length; i++) {
                formData.append('media_files', this.mediaFiles[i]);
            }

            const response = await fetch(`${API_BASE_URL}/api/vrew/autofill`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || '서버 응답 오류 (JSON 파싱 실패 혹은 서버 다운)');
            }

            const blob = await response.blob();
            let filename = `final_${this.vrewFile.name}`;
            const disposition = response.headers.get('content-disposition');
            if (disposition && disposition.includes('filename=')) {
                const match = disposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) filename = match[1];
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();

            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            if (statusEl) {
                statusEl.className = 'mt-6 px-6 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 border shadow-lg transition-all bg-green-900/30 border-green-500/40 text-green-400';
                statusEl.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i><span>🎉 자동 생성 성공! 파일이 다운로드되었습니다. Vrew에서 열어 확인해보세요.</span>`;
            }
            window.lucide.createIcons();

            this.mediaFiles = [];
            this.updateMediaUI();

        } catch (e) {
            console.error(e);
            if (statusEl) {
                statusEl.className = 'mt-6 px-6 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 border shadow-lg transition-all bg-red-900/30 border-red-500/40 text-red-400';
                statusEl.innerHTML = `<i data-lucide="alert-triangle" class="w-5 h-5"></i><span>오류 발생: ${e.message}</span>`;
            }
            window.lucide.createIcons();
        } finally {
            btn.innerHTML = originalContent;
            this.updateButtonState();
            window.lucide.createIcons();
        }
    }
}
