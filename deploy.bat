@echo off
chcp 65001 > nul
cd /d %~dp0

echo ╔══════════════════════════════════╗
echo ║   WMSM 麥頭印標系統 — 部署腳本  ║
echo ╚══════════════════════════════════╝
echo.

:: ── Step 1: Git Pull ──────────────────────────────────────
echo [1/5] 從 GitHub 拉取最新程式碼...
git pull origin main
if %ERRORLEVEL% neq 0 (
  echo [錯誤] git pull 失敗，請確認網路或 SSH 設定
  pause & exit /b 1
)
echo.

:: ── Step 2: 前端安裝 ───────────────────────────────────────
echo [2/5] 安裝前端相依套件...
cd frontend
call npm install --prefer-offline
if %ERRORLEVEL% neq 0 (
  echo [錯誤] npm install 失敗
  cd ..
  pause & exit /b 1
)
echo.

:: ── Step 3: 前端 Build ─────────────────────────────────────
echo [3/5] 建置前端（React → dist）...
call npm run build
if %ERRORLEVEL% neq 0 (
  echo [錯誤] 前端 build 失敗，請查看上方錯誤訊息
  cd ..
  pause & exit /b 1
)
cd ..
echo.

:: ── Step 4: 後端安裝 + Build ────────────────────────────────
echo [4/5] 安裝後端套件並編譯 TypeScript...
cd backend
call npm install --prefer-offline
call npm run build
if %ERRORLEVEL% neq 0 (
  echo [錯誤] 後端 build 失敗，請查看上方錯誤訊息
  cd ..
  pause & exit /b 1
)
cd ..
echo.

:: ── Step 5: 建立 logs 目錄 ─────────────────────────────────
if not exist logs mkdir logs

:: ── Step 6: 重啟 PM2 服務 ──────────────────────────────────
echo [5/5] 重啟 PM2 服務...
pm2 describe wmsm-api > nul 2>&1
if %ERRORLEVEL% equ 0 (
  pm2 restart wmsm-api
) else (
  echo [首次啟動] 使用 ecosystem.config.js 啟動...
  pm2 start backend/ecosystem.config.js
  pm2 save
)

echo.
echo ══════════════════════════════════════
echo   部署完成！服務運行於 http://localhost:3000
echo   使用 pm2 logs wmsm-api 查看即時日誌
echo ══════════════════════════════════════
echo.
pause
