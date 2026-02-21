@echo off
echo ========================================
echo RealHunalo Studio - Server Startup
echo ========================================
echo.

echo [0/2] Cleaning up existing processes on ports 8000 and 5500...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5500') do taskkill /f /pid %%a 2>nul
echo Done.
echo.

echo [1/2] Starting Backend Server (Port 8000)...
start "RealHunalo Backend" cmd /k "cd /d "%~dp0" && python backend.py"
timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend Server (Port 5500)...
start "RealHunalo Frontend" cmd /k "cd /d "%~dp0" && python -m http.server 5500"
timeout /t 3 /nobreak > nul

echo.
echo ========================================
echo Servers Started!
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5500
echo Test Page: http://localhost:5500/test.html
echo.
echo Opening test page in browser...
timeout /t 2 /nobreak > nul

start http://localhost:5500/test.html

echo.
echo Press any key to close this window...
pause > nul
