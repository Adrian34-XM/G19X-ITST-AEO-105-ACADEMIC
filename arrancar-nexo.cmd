@echo off
cd /d "%~dp0"
echo Arrancando Nexo...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1"
echo.
echo Puedes cerrar esta ventana; el servidor sigue en segundo plano.
pause
