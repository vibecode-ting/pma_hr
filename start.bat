@echo off
title HR-Portal Production Server

:: ── Kill any process already using port 4173 ──────────────────────────────
echo Checking for processes on port 4173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4173 " ^| findstr "LISTENING" 2^>nul') do (
    echo   Killing PID %%a on port 4173...
    taskkill /PID %%a /F >nul 2>&1
)

:: ── Install npm dependencies ───────────────────────────────────────────────
echo.
echo Installing npm packages...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

:: ── Ensure config exists and sync to public ────────────────────────────────
if exist config.json (
    copy /Y config.json public\config.json >nul
) else if exist config.example.json (
    echo Creating config.json from config.example.json...
    copy /Y config.example.json config.json >nul
    copy /Y config.example.json public\config.json >nul
)

:: ── Build for production ───────────────────────────────────────────────────
echo.
echo Building for production...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed. See errors above.
    pause
    exit /b 1
)

:: ── Ensure latest config.json is copied/replaced into dist ─────────────────
if exist config.json (
    copy /Y config.json dist\config.json >nul
)

:: ── Detect LAN IP (Prioritize Ethernet, then Wi-Fi) ───────────────────────
node scripts\get-lan-ip.cjs > getip.txt
set /p LAN_IP=<getip.txt
del getip.txt
:: Trim leading space
set LAN_IP=%LAN_IP: =%

echo.
echo Starting production server on LAN only...
echo   Network: http://%LAN_IP%:4173/
echo.
echo   Keep this window open to keep the server running.
echo   Close this window to stop the server.
echo.

:: ── Open in default browser after server starts (spawned asynchronously) ──
start "" cmd /c "ping -n 3 127.0.0.1 >nul & start http://%LAN_IP%:4173/"

:: ── Start Vite preview (LAN IP bound, port 4173) ──────────────────────────
call npx vite preview --port 4173

:: ── Keep terminal open if server exits unexpectedly ───────────────────────
pause
