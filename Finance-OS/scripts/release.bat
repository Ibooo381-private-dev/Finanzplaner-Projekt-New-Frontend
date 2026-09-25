@echo off
setlocal
rem ============================================================
rem  Finance OS - lokaler Release (M16).
rem  Ablauf: Git-Pruefung -> clean -> lint -> Tests -> Build ->
rem  releases\finance-os-v<version>\ + Manifest + ZIP.
rem  Optionaler Parameter: --allow-dirty (Release trotz
rem  uncommitteter Aenderungen; wird im Manifest als dirty markiert).
rem  KEINE Pushes, KEINE Tags.
rem ============================================================

set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
  echo [FEHLER] Projektverzeichnis nicht erreichbar: "%PROJECT_ROOT%"
  exit /b 1
)

set "ALLOW_DIRTY=0"
if /i "%~1"=="--allow-dirty" set "ALLOW_DIRTY=1"

echo === Finance OS: lokalen Release erzeugen ===
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0release.ps1" -ProjectRoot "%PROJECT_ROOT%" -AllowDirty %ALLOW_DIRTY%
exit /b %ERRORLEVEL%
