@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在检查奇门遁甲服务状态...
netstat -ano | findstr :8099 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo 正在启动本地服务端口 8099...
    start /b python -m http.server 8099 >nul 2>&1
    timeout /t 1 /nobreak >nul
) else (
    echo 服务已在运行中 (端口 8099)
)

echo 正在打开奇门遁甲排盘系统...
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:8099
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:8099
) else (
    start http://localhost:8099
)
