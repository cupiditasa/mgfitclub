@echo off
setlocal
set "MG_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "MG_PS=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
"%MG_PS%" -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0Start.ps1" -Profile 2
if errorlevel 1 pause
