@echo off
setlocal
rem Finance OS - vollstaendige Testsuite EINMALIG (M16); kein Watch-Modus.
set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
  echo [FEHLER] Projektverzeichnis nicht erreichbar: "%PROJECT_ROOT%"
  exit /b 1
)

echo === Finance OS: Tests (vitest run, einmalig) ===
call npm test
if not "%ERRORLEVEL%"=="0" (
  echo [FEHLER] Mindestens ein Test ist fehlgeschlagen.
  exit /b %ERRORLEVEL%
)
echo [OK] Alle Tests bestanden.
exit /b 0
