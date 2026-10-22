@echo off
setlocal
cd /d "%~dp0"

rem Try an ASCII junction first. This avoids the executable path containing
rem Chinese characters while keeping the app folder where the user extracted it.
set "TARGET=%LOCALAPPDATA%\SmartVocabLaunch"
if exist "%TARGET%" rmdir "%TARGET%" >nul 2>nul
mklink /J "%TARGET%" "%~dp0." >nul 2>nul
if exist "%TARGET%\SmartVocab.exe" (
  start "" "%TARGET%\SmartVocab.exe" %*
  exit /b 0
)

rem Fallback: Windows 8.3 short path.
for %%I in ("%~dp0.") do set "SHORT=%%~sI"
if exist "%SHORT%\SmartVocab.exe" (
  start "" "%SHORT%\SmartVocab.exe" %*
  exit /b 0
)

rem Last resort: direct launch.
start "" "SmartVocab.exe" %*
if errorlevel 1 (
  echo.
  echo 启动失败：无法创建 ASCII 兼容路径，也无法直接启动。
  echo 请把本文件夹移动到纯英文路径，例如 C:\SmartVocab，再运行 SmartVocab.exe。
  echo.
  pause
)
