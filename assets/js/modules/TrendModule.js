// ================================================================
// TREND MODULE - 트렌드 분석실
// ================================================================

import { Module } from '../Module.js';

export class TrendModule extends Module {
    constructor() {
        super('trend', '트렌드 분석실', 'trending-up', '네이버/구글 실시간 트렌드를 분석합니다.');
    }

    render() {
        return `
            <div class="max-w-5xl mx-auto slide-up">
                <div class="mb-6 flex gap-3 flex-wrap">
                    <input type="text" id="trend-keyword" class="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500" placeholder="연관 키워드 입력 (예: 부동산, 비트코인, AI) - Enter로 검색">
                    <button id="btn-analyze-trend" class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/30 flex items-center gap-2 transition">
                        <i data-lucide="search" class="w-4 h-4"></i> 네이버+구글 동시 분석
                    </button>
                    <button id="btn-ai-recommend" class="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-purple-600/30 flex items-center gap-2 transition">
                        <i data-lucide="sparkles" class="w-4 h-4"></i> AI 추천 키워드
                    </button>
                </div>

                <!-- 다운로드 버튼 (초기 숨김) -->
                <div id="download-buttons" class="mb-4 flex gap-3 hidden">
                    <button id="btn-download-csv" class="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2">
                        <i data-lucide="file-spreadsheet" class="w-4 h-4"></i> CSV 다운로드
                    </button>
                    <button id="btn-download-png" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2">
                        <i data-lucide="image" class="w-4 h-4"></i> PNG 다운로드
                    </button>
                </div>
                
                <!-- 정보 카드 -->
                <div class="mb-4 bg-blue-900/20 border border-blue-700/50 rounded-xl p-4 text-sm text-blue-300">
                    <i data-lucide="info" class="w-4 h-4 inline mr-2"></i>
                    네이버 데이터랩과 구글 트렌드를 동시에 분석하여 비교합니다. (최근 1년 데이터)
                </div>
                
                <!-- 결과 영역 -->
                <div id="trend-result-container" class="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 min-h-[500px] flex flex-col">
                     <!-- 초기 상태/로딩/에러 메시지 표시용 -->
                    <div id="trend-message" class="flex-1 flex items-center justify-center">
                        <p class="text-slate-500 text-center">
                            <i data-lucide="trending-up" class="w-12 h-12 mx-auto mb-3 opacity-50"></i><br>
                            분석할 키워드를 입력하고 버튼을 누르세요
                        </p>
                    </div>
                    <!-- 차트 캔버스 (초기엔 숨김) -->
                    <div id="chart-wrapper" class="hidden w-full" style="height: 450px;">
                        <canvas id="trendChart"></canvas>
                    </div>
                </div>
            </div>
        `;
    }

    onMount() {
        const btnAnalyze = document.getElementById('btn-analyze-trend');
        const btnAIRecommend = document.getElementById('btn-ai-recommend');
        const inputKeyword = document.getElementById('trend-keyword');
        const msgContainer = document.getElementById('trend-message');
        const chartWrapper = document.getElementById('chart-wrapper');
        const downloadButtons = document.getElementById('download-buttons');
        let myChart = null;
        let currentData = null; // 현재 분석 데이터 저장

        // 엔터키로 검색 시작
        inputKeyword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                btnAnalyze.click();
            }
        });

        // 분석 실행
        btnAnalyze.addEventListener('click', async () => {
            const keyword = inputKeyword.value.trim();

            if (!keyword) {
                alert('키워드를 입력해주세요.');
                return;
            }

            // 로딩 표시
            msgContainer.innerHTML = `
                <div class="text-center">
                    <i data-lucide="loader-2" class="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3"></i>
                    <p class="text-slate-400">네이버와 구글 데이터를 동시에 분석 중입니다...</p>
                </div>
            `;
            lucide.createIcons();
            msgContainer.classList.remove('hidden');
            chartWrapper.classList.add('hidden');
            downloadButtons.classList.add('hidden');

            try {
                const response = await fetch('http://localhost:8000/api/analyze-trend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keyword })
                });

                const data = await response.json();

                if (data.error) {
                    throw new Error(data.error);
                }

                // 데이터 저장
                currentData = { keyword, data };

                // 성공 시 차트 렌더링
                msgContainer.classList.add('hidden');
                chartWrapper.classList.remove('hidden');
                downloadButtons.classList.remove('hidden'); // 다운로드 버튼 표시

                const ctx = document.getElementById('trendChart').getContext('2d');

                // 기존 차트 파괴
                if (myChart) {
                    myChart.destroy();
                }

                // 데이터셋 준비
                const datasets = [];

                // 네이버 데이터 추가
                if (data.naver && data.naver.labels) {
                    const naverGradient = ctx.createLinearGradient(0, 0, 0, 400);
                    naverGradient.addColorStop(0, 'rgba(3, 199, 90, 0.3)');
                    naverGradient.addColorStop(1, 'rgba(3, 199, 90, 0.0)');

                    datasets.push({
                        label: '네이버 트렌드',
                        data: data.naver.values,
                        borderColor: '#03c75a',
                        backgroundColor: naverGradient,
                        borderWidth: 2,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#03c75a',
                        pointHoverBackgroundColor: '#03c75a',
                        pointHoverBorderColor: '#fff',
                        fill: true,
                        tension: 0.4
                    });
                }

                // 구글 데이터 추가
                if (data.google && data.google.labels) {
                    const googleGradient = ctx.createLinearGradient(0, 0, 0, 400);
                    googleGradient.addColorStop(0, 'rgba(66, 133, 244, 0.3)');
                    googleGradient.addColorStop(1, 'rgba(66, 133, 244, 0.0)');

                    datasets.push({
                        label: '구글 트렌드',
                        data: data.google.values,
                        borderColor: '#4285f4',
                        backgroundColor: googleGradient,
                        borderWidth: 2,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#4285f4',
                        pointHoverBackgroundColor: '#4285f4',
                        pointHoverBorderColor: '#fff',
                        fill: true,
                        tension: 0.4
                    });
                }

                // 라벨 선택
                let chartLabels = [];
                if (data.google && data.google.labels) {
                    chartLabels = data.google.labels;
                } else if (data.naver && data.naver.labels) {
                    chartLabels = data.naver.labels;
                }

                myChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: chartLabels,
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: `"${keyword}" 트렌드 비교 분석`,
                                color: '#e2e8f0',
                                font: { size: 16, weight: 'bold' }
                            },
                            legend: {
                                labels: {
                                    color: '#cbd5e1',
                                    font: { size: 12 }
                                }
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                            }
                        },
                        scales: {
                            x: {
                                grid: { color: '#334155' },
                                ticks: {
                                    color: '#94a3b8',
                                    maxRotation: 45,
                                    minRotation: 45
                                }
                            },
                            y: {
                                grid: { color: '#334155' },
                                ticks: { color: '#94a3b8' },
                                beginAtZero: true
                            }
                        },
                        interaction: {
                            mode: 'nearest',
                            axis: 'x',
                            intersect: false
                        }
                    }
                });

            } catch (error) {
                console.error(error);
                msgContainer.innerHTML = `
                    <div class="text-center text-red-400">
                        <i data-lucide="alert-circle" class="w-10 h-10 mx-auto mb-3"></i>
                        <p class="font-bold mb-2">분석 실패</p>
                        <p class="text-sm">${error.message}</p>
                    </div>
                `;
                lucide.createIcons();
                msgContainer.classList.remove('hidden');
                chartWrapper.classList.add('hidden');
            }
        });

        // CSV 다운로드
        const btnDownloadCSV = document.getElementById('btn-download-csv');
        if (btnDownloadCSV) {
            btnDownloadCSV.addEventListener('click', () => {
                if (!currentData) return alert('먼저 트렌드를 분석해주세요.');

                let csv = '날짜,네이버 트렌드,구글 트렌드\n';
                const { data } = currentData;

                const maxLength = Math.max(
                    (data.naver?.labels || []).length,
                    (data.google?.labels || []).length
                );

                for (let i = 0; i < maxLength; i++) {
                    const date = data.google?.labels[i] || data.naver?.labels[i] || '';
                    const naverVal = data.naver?.values[i] || '';
                    const googleVal = data.google?.values[i] || '';
                    csv += `${date},${naverVal},${googleVal}\n`;
                }

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `trend_${currentData.keyword}_${Date.now()}.csv`;
                link.click();
                URL.revokeObjectURL(url);
            });
        }

        // PNG 다운로드
        const btnDownloadPNG = document.getElementById('btn-download-png');
        if (btnDownloadPNG) {
            btnDownloadPNG.addEventListener('click', () => {
                if (!myChart) return alert('먼저 트렌드를 분석해주세요.');

                const link = document.createElement('a');
                link.href = myChart.toBase64Image();
                link.download = `trend_chart_${currentData.keyword}_${Date.now()}.png`;
                link.click();
            });
        }

        // AI 추천 키워드
        if (btnAIRecommend) {
            btnAIRecommend.addEventListener('click', async () => {
                const currentKeyword = inputKeyword.value.trim() || '트렌드';

                const originalHTML = btnAIRecommend.innerHTML;
                btnAIRecommend.disabled = true;
                btnAIRecommend.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> AI 분석 중`;
                lucide.createIcons();

                try {
                    // Backend AI 추천 엔드포인트 호출
                    const response = await fetch('http://localhost:8000/api/ai-recommend-keywords', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ baseKeyword: currentKeyword })
                    });

                    const result = await response.json();

                    if (result.keywords && result.keywords.length > 0) {
                        const keywords = result.keywords.join('\n• ');
                        alert(`🤖 AI 추천 키워드:\n\n• ${keywords}\n\n원하는 키워드를 입력창에 입력하세요.`);
                    } else {
                        alert('AI가 추천 키워드를 생성하지 못했습니다.');
                    }
                } catch (e) {
                    console.error(e);
                    alert(`AI 추천 실패: ${e.message}\n\n설정에서 AI API 키를 확인하세요.`);
                } finally {
                    btnAIRecommend.disabled = false;
                    btnAIRecommend.innerHTML = originalHTML;
                    lucide.createIcons();
                }
            });
        }

        lucide.createIcons();
    }
}
