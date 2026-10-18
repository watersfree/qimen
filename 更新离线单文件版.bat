@echo off
chcp 936 >nul
title 更新奇门遁甲离线单文件版
cd /d "%~dp0"

echo ============================================================
echo   正在自动打包生成【纯离线单文件版】...
echo ============================================================
echo.

python build_standalone.py

if %errorlevel% equ 0 (
    echo.
    echo ============================================================
    echo [√] 打包成功！
    echo 生成文件：qimen_offline_standalone.html
    echo.
    echo 使用提示：
    echo 1. 将此 html 文件直接发送到手机（微信/QQ/网盘/传输助手）
    echo 2. 在手机上用浏览器打开即可彻底脱机运行，断网永不失效！
    echo ============================================================
) else (
    echo.
    echo [×] 打包失败，请检查 Python 环境。
)

echo.
pause
