@echo off
setlocal
cd /d "%~dp0"

rem Some Windows/Electron combinations fail when the executable path contains
rem non-ASCII characters. Try the 8.3 short path first (ASCII), then fall back.
for %%I in ("%~dp0.") do set "SHORT=%%~sI"
if exist "%SHORT%SmartVocab.exe" (
  start "" "%SHORT%SmartVocab.exe" %*
  exit /b 0
)

start "" "SmartVocab.exe" %*
