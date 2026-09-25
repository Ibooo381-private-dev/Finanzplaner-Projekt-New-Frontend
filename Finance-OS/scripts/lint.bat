@echo off
setlocal
rem Finance OS - ESLint (M16).
set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
  echo [FEHLER] Projektverzeichnis nicht erreichbar: "%PROJECT_ROOT%"
  exit /b 1
)

echo === Finance OS: Lint (eslint .) ===
call npm run lint
if not "%ERRORLEVEL%"=="0" (
  echo [FEHLER] Lint hat Probleme gemeldet.
  exit /b %ERRORLEVEL%
)
echo [OK] Lint ohne Befund.
exit /b 0
