@echo off
chcp 65001 > nul
echo ========================================
echo RealHunalo Studio - 서버 재시작
echo ========================================
echo.

echo [1/3] 기존 프로세스 종료 중...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq RealHunalo*" 2>nul
timeout /t 2 /nobreak > nul

echo [2/3] 백엔드 시작 (Port 8000)...
start "RealHunalo Backend" cmd /k "cd /d "%~dp0" && python backend.py"
timeout /t 3 /nobreak > nul

echo [3/3] 프론트엔드 시작 (Port 5500)...
start "RealHunalo Frontend" cmd /k "cd /d "%~dp0" && python -m http.server 5500"
timeout /t 3 /nobreak > nul

echo.
echo ========================================
echo 서버 시작 완료!
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5500
echo.
echo 브라우저에서 http://localhost:5500/index.html 를 여세요
echo.
pause
