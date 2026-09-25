@echo off
setlocal
rem ============================================================
rem  Finance OS - vollstaendige Pruefung (M16): Lint -> Tests -> Build.
rem  Ruft die Einzelskripte auf (keine doppelte Logik); bricht beim
rem  ersten Fehler ab und reicht dessen Exitcode weiter.
rem ============================================================

echo ============================================
echo  Finance OS: vollstaendige Pruefung (1/3 Lint)
echo ============================================
call "%~dp0lint.bat"
if not "%ERRORLEVEL%"=="0" (
  echo [ABBRUCH] Lint fehlgeschlagen - Tests und Build werden nicht ausgefuehrt.
  exit /b %ERRORLEVEL%
)

echo.
echo ============================================
echo  Finance OS: vollstaendige Pruefung (2/3 Tests)
echo ============================================
call "%~dp0test.bat"
if not "%ERRORLEVEL%"=="0" (
  echo [ABBRUCH] Tests fehlgeschlagen - Build wird nicht ausgefuehrt.
  exit /b %ERRORLEVEL%
)

echo.
echo ============================================
echo  Finance OS: vollstaendige Pruefung (3/3 Build)
echo ============================================
call "%~dp0build.bat"
if not "%ERRORLEVEL%"=="0" (
  echo [ABBRUCH] Build fehlgeschlagen.
  exit /b %ERRORLEVEL%
)

echo.
echo ============================================
echo  [ERFOLG] Alle drei Pruefungen bestanden:
echo    1. Lint  - ohne Befund
echo    2. Tests - vollstaendige Suite gruen
echo    3. Build - Typpruefung + Produktions-Build in dist\
echo ============================================
exit /b 0
