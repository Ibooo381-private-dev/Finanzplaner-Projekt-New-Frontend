@echo off
setlocal
rem ============================================================
rem  Finance OS - Entwicklungsserver stoppen (M16)
rem  Beendet AUSSCHLIESSLICH den von start-dev.bat gestarteten
rem  Prozess (PID aus .runtime\dev-server.pid). Es werden nie
rem  pauschal node.exe-Prozesse beendet.
rem ============================================================

set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
  echo [FEHLER] Projektverzeichnis nicht erreichbar: "%PROJECT_ROOT%"
  exit /b 1
)

echo === Finance OS: Entwicklungsserver stoppen ===
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-server.ps1" -Action stop -ProjectRoot "%PROJECT_ROOT%"
exit /b %ERRORLEVEL%
