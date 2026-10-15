@echo off
title PixelForge Studio — Photoshop Alternative for Windows
color 0b
echo ========================================================
echo         PIXELFORGE STUDIO (Photoshop Alternative)
echo ========================================================
echo.
cd /d "%~dp0"

echo Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not found on your system!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js detected.
echo.
echo What would you like to do?
echo.
echo   1. Run Instant Web App (Fastest, opens in browser, zero install)
echo   2. Run Native Desktop Window (Installs Electron if needed, opens desktop app)
echo   3. Build Standalone Windows .exe Installer (Builds into \dist folder)
echo.
set /p choice="Enter choice [1, 2, or 3, default=1]: "

if "%choice%"=="3" (
    echo.
    if not exist "node_modules\electron-builder" (
        echo [INFO] Installing Electron and Electron-Builder... (one-time setup)
        call npm install
    )
    echo [INFO] Building Windows installer and portable .exe...
    call npm run dist
    echo.
    echo [SUCCESS] Build finished! Check the 'dist' folder for your .exe files.
    pause
    exit /b 0
)

if "%choice%"=="2" (
    echo.
    if not exist "node_modules\electron" (
        echo [INFO] Installing Electron desktop engine... (one-time setup)
        call npm install
    )
    echo [INFO] Starting PixelForge Desktop App...
    call npm start
    exit /b 0
)

echo.
echo [INFO] Starting instant preview server at http://localhost:3000 ...
start "" http://localhost:3000
node server.js
