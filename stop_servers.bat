@echo off
echo ========================================
echo RealHunalo Studio - Server Shutdown
echo ========================================
echo.

echo Cleaning up processes on port 8000 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a 2>nul

echo Cleaning up processes on port 5500 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5500') do taskkill /f /pid %%a 2>nul

echo.
echo All servers have been stopped.
echo ========================================
pause
