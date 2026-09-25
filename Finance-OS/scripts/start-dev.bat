@echo off
setlocal
rem ============================================================
rem  Finance OS - Entwicklungsserver starten (M16)
rem  Startet "npm run dev" in einem eigenen Fenster und merkt
rem  sich die Prozess-ID in .runtime\dev-server.pid.
rem ============================================================

set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
  echo [FEHLER] Projektverzeichnis nicht erreichbar: "%PROJECT_ROOT%"
  exit /b 1
)

echo === Finance OS: Entwicklungsserver starten ===
echo Projektverzeichnis: "%PROJECT_ROOT%"

if not exist "package.json" (
  echo [FEHLER] package.json nicht gefunden - ist das wirklich das Projektverzeichnis?
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [FEHLER] "node" wurde nicht gefunden. Bitte Node.js ^(^>= 22^) installieren.
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [FEHLER] "npm" wurde nicht gefunden. Bitte Node.js inkl. npm installieren.
  exit /b 1
)

if exist "node_modules" goto :deps_ok
echo [HINWEIS] Der Ordner node_modules fehlt - die Abhaengigkeiten sind noch nicht installiert.
set "ANSWER="
set /p ANSWER="Jetzt 'npm ci' ausfuehren (empfohlen)? [J/N] "
if /i not "%ANSWER%"=="J" (
  echo Abgebrochen. Bitte zuerst 'npm ci' im Projektverzeichnis ausfuehren.
  exit /b 1
)
call npm ci
if not "%ERRORLEVEL%"=="0" (
  echo [FEHLER] 'npm ci' ist fehlgeschlagen.
  exit /b 1
)
:deps_ok

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-server.ps1" -Action start -ProjectRoot "%PROJECT_ROOT%"
exit /b %ERRORLEVEL%
