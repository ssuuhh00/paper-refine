@echo off
REM paper-refine launcher for Windows — opens server + web in two new windows
REM and points the default browser at the web URL.
REM
REM Usage:
REM   start.bat              uses defaults: server :3001, web :5173
REM   start.bat --no-open    skip browser
REM   set SERVER_PORT=4000 && set WEB_PORT=4173 && start.bat
REM
REM Note: this is the demo launcher. It does NOT install dependencies and
REM does NOT manage stale processes (use Task Manager if a port is busy).
REM On Windows, running an actual pipeline round needs the claude CLI
REM resolvable from PATH; for read-only demos that requirement doesn't apply.

setlocal

if "%SERVER_PORT%"=="" set SERVER_PORT=3001
if "%WEB_PORT%"=="" set WEB_PORT=5173

set OPEN_BROWSER=1
:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--no-open" set OPEN_BROWSER=0
if /I "%~1"=="-h"        goto show_help
if /I "%~1"=="--help"    goto show_help
shift
goto parse_args
:args_done

cd /d "%~dp0"

if not exist "node_modules" (
  echo [start.bat] node_modules not found — run "npm install" first.
  exit /b 1
)

echo [start.bat] launching server on :%SERVER_PORT%
start "paper-refine server" cmd /k "set PORT=%SERVER_PORT%&& npm run dev:server"

echo [start.bat] launching web on :%WEB_PORT%
start "paper-refine web" cmd /k "npm run dev:web -- --port %WEB_PORT%"

if %OPEN_BROWSER%==1 (
  echo [start.bat] waiting 3s for the dev server to come up…
  timeout /t 3 /nobreak >nul
  echo [start.bat] opening browser at http://localhost:%WEB_PORT%/
  start "" "http://localhost:%WEB_PORT%/"
) else (
  echo [start.bat] --no-open: browser skipped. Open http://localhost:%WEB_PORT%/ when ready.
)

echo [start.bat] two windows are now running. Close them to stop the servers.
endlocal
exit /b 0

:show_help
echo paper-refine launcher (Windows)
echo.
echo   start.bat              uses defaults: server :3001, web :5173
echo   start.bat --no-open    skip browser
echo   start.bat -h^|--help    this help
echo.
echo Env overrides:
echo   set SERVER_PORT=4000
echo   set WEB_PORT=4173
exit /b 0
