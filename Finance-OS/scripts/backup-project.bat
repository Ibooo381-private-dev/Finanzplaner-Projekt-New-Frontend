@echo off
setlocal
rem ============================================================
rem  Finance OS - Quellcode-Backup (M16).
rem  Erzeugt project-backups\Finance-OS-source-JJJJ-MM-TT_HH-mm-ss.zip
rem  ueber den PowerShell-Helfer backup-project.ps1 (robuste
rem  Pfad-/Ausschlussbehandlung, ZIP-Validierung).
rem ============================================================

set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
  echo [FEHLER] Projektverzeichnis nicht erreichbar: "%PROJECT_ROOT%"
  exit /b 1
)

echo === Finance OS: Quellcode-Backup ===
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-project.ps1" -ProjectRoot "%PROJECT_ROOT%"
exit /b %ERRORLEVEL%
