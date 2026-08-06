@echo off
title MMM Intelligence Studio - Portable Starter
cls

echo ========================================================
echo   MMM Intelligence Studio (Marketing Mix Modeling)
echo ========================================================
echo.

echo [1/3] Checking Node.js Environment...
call node -v
if %errorlevel% neq 0 (
    echo.
    echo ========================================================
    echo [CRITICAL ERROR] Node.js is NOT installed on this PC!
    echo.
    echo How to fix:
    echo 1. Open browser and visit: https://nodejs.org
    echo 2. Click green [LTS Version] button and install it.
    echo 3. RESTART your computer after installation!
    echo 4. Double-click start.bat again.
    echo ========================================================
    echo.
    pause
    exit /b
)

echo.
echo [2/3] Checking Required Packages (vite)...
if not exist "node_modules\vite" (
    echo Installing required packages (first-time only, ~20 sec)...
    call npm install
)

echo.
echo [3/3] Launching Analytics Web Server...
echo --------------------------------------------------------
echo   Opening Browser at: http://localhost:3000
echo --------------------------------------------------------
echo.

start http://localhost:3000
call npm run preview

if %errorlevel% neq 0 (
    echo.
    echo Falling back to npm run dev...
    call npm run dev
)

echo.
echo Server Stopped.
pause
