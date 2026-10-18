@echo off
chcp 936 >nul
title 局域网防火墙放行配置工具

:: 检查是否具备管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 正在请求管理员授权，请在弹出的 UAC 提示窗口中点击【是】...
    powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================================
echo   奇门遁甲排盘 - 局域网防火墙放行配置
echo ============================================================
echo.
echo 正在放行 8099 端口与配置网络权限...

:: 1. 放行 8099 端口 (覆盖公用网络和专用网络)
netsh advfirewall firewall delete rule name="Qimen PWA 8099" >nul 2>&1
netsh advfirewall firewall add rule name="Qimen PWA 8099" dir=in action=allow protocol=TCP localport=8099 profile=any >nul

:: 2. 放行 python.exe
netsh advfirewall firewall set rule name="python.exe" new action=allow profile=any >nul 2>&1

:: 3. 将无线网络切换为专用网络
powershell -NoProfile -Command "Set-NetConnectionProfile -InterfaceAlias WLAN -NetworkCategory Private -ErrorAction SilentlyContinue" >nul 2>&1

echo.
echo ============================================================
echo [√] 防火墙已成功放行 8099 端口！
echo.
echo 本机局域网地址： http://192.168.2.133:8099/
echo.
echo 同一 Wi-Fi 下的手机、平板或电脑直接在浏览器打开上述地址即可。
echo ============================================================
echo.
pause
