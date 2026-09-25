@echo off
setlocal
rem ============================================================
rem  Finance OS - Aufraeumen (M16).
rem  Entfernt AUSSCHLIESSLICH reproduzierbare Artefakte:
rem    - dist\      (Build-Ausgabe)
rem    - .runtime\  (projektlokale PID-/Laufzeitdateien)
rem  Mit Parameter --full zusaetzlich (nach Bestaetigung):
rem    - node_modules\ (per 'npm ci' reproduzierbar)
rem  NIEMALS geloescht werden: user-data\, backups\, project-backups\,
rem  releases\, reference\, docs\ oder sonstige Projekt-/Nutzerdaten.
rem ============================================================

set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
  echo [FEHLER] Projektverzeichnis nicht erreichbar: "%PROJECT_ROOT%"
  exit /b 1
)

echo === Finance OS: Aufraeumen ===

if exist ".runtime\dev-server.pid" (
  echo [ABBRUCH] Es existiert eine Dev-Server-PID-Datei - der Entwicklungsserver laeuft
  echo           vermutlich noch. Bitte zuerst scripts\stop-dev.bat ausfuehren
  echo           ^(das raeumt auch veraltete PID-Dateien sicher auf^).
  exit /b 1
)

if exist "dist" (
  rmdir /s /q "dist"
  if exist "dist" (
    echo [FEHLER] dist\ konnte nicht entfernt werden ^(Datei in Benutzung?^).
    exit /b 1
  )
  echo [OK] dist\ entfernt.
) else (
  echo [OK] dist\ existiert nicht - nichts zu tun.
)

if exist ".runtime" (
  rmdir /s /q ".runtime"
  if exist ".runtime" (
    echo [FEHLER] .runtime\ konnte nicht entfernt werden. Laeuft der Dev-Server noch? ^(scripts\stop-dev.bat^)
    exit /b 1
  )
  echo [OK] .runtime\ entfernt ^(PID-/Laufzeitdateien^).
) else (
  echo [OK] .runtime\ existiert nicht - nichts zu tun.
)

if /i not "%~1"=="--full" goto :done

if not exist "node_modules" (
  echo [OK] node_modules\ existiert nicht - nichts zu tun.
  goto :done
)
echo.
echo [ACHTUNG] --full entfernt auch node_modules\ ^(Neuinstallation danach: npm ci^).
set "ANSWER="
set /p ANSWER="node_modules\ wirklich loeschen? [J/N] "
if /i not "%ANSWER%"=="J" (
  echo Uebersprungen - node_modules\ bleibt erhalten.
  goto :done
)
rmdir /s /q "node_modules"
if exist "node_modules" (
  echo [FEHLER] node_modules\ konnte nicht vollstaendig entfernt werden.
  exit /b 1
)
echo [OK] node_modules\ entfernt. Neuinstallation: npm ci

:done
echo [FERTIG] Aufraeumen abgeschlossen. Nutzer- und Finanzdaten wurden nicht angefasst.
exit /b 0
