@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 22+ from https://nodejs.org/en/download
 pause
 exit /b 1
)
set ROUTERESCUE_OPEN_BROWSER=1
echo Starting RouteRescue. Leave this window open. Press Ctrl+C to stop.
node server/index.js
if errorlevel 1 pause
