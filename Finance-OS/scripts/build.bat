@echo off
setlocal
rem Finance OS - Produktions-Build (M16): tsc --noEmit + vite build -> dist\
set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
  echo [FEHLER] Projektverzeichnis nicht erreichbar: "%PROJECT_ROOT%"
  exit /b 1
)

echo === Finance OS: Build (Typpruefung + Produktions-Build) ===
echo Ausgabeziel: "%PROJECT_ROOT%\dist"
call npm run build
if not "%ERRORLEVEL%"=="0" (
  echo [FEHLER] Build fehlgeschlagen.
  exit /b %ERRORLEVEL%
)
echo [OK] Build erfolgreich. Ausgabe liegt in "dist\".
exit /b 0
