    /**
     * 이미지 프롬프트 수동 생성 (사용자 설정 기반)
     */
    async generateImagePromptsManual(style, model, ratio) {
    const scenes = AppState.getScenes();

    if (scenes.length === 0) {
        alert('❌ 생성할 장면이 없습니다.');
        return;
    }

    const btn = document.getElementById('btn-generate-image-prompts-manual');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> 생성 중...';
        lucide.createIcons();
    }

    try {
        // Backend API 호출
        const response = await fetch(`${API_BASE_URL}/api/generate-image-prompts-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transcripts: scenes.map(s => ({
                    index: s.sceneId,
                    text: s.originalScript || s.scriptForTTS
                })),
                imageStyle: style
            })
        });

        if (!response.ok) throw new Error(`서버 오류: ${response.status}`);

        const result = await response.json();

        if (result.success && result.prompts) {
            // AppState 업데이트
            const updatedScenes = scenes.map(scene => {
                const promptData = result.prompts.find(p => p.index === scene.sceneId);
                if (promptData) {
                    scene.imagePrompt = promptData.imagePrompt;
                }
                return scene;
            });

            AppState.setScenes(updatedScenes);
            this.refreshModule();

            alert(`✅ 이미지 프롬프트 생성 완료!\n스타일: ${style}\n생성된 프롬프트: ${result.prompts.length}개`);
        } else {
            throw new Error(result.error || '프롬프트 생성 실패');
        }
    } catch (error) {
        console.error('[ERROR] Image prompt generation failed:', error);
        alert(`❌ 이미지 프롬프트 생성 실패:\n${error.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="sparkles" class="w-5 h-5"></i> 이미지 프롬프트 생성';
            lucide.createIcons();
        }
    }
}
