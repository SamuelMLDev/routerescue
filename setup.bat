@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 22 or newer was not found. Install it from https://nodejs.org/en/download
 pause
 exit /b 1
)
node -e "const v=process.versions.node.split('.').map(Number);if(v[0]<22||(v[0]===22&&v[1]<12))process.exit(1)"
if errorlevel 1 (
 echo Node.js version 22.12 or newer is required.
 pause
 exit /b 1
)
echo No dependency installation is needed. This project uses Node.js built-ins.
echo Running tests...
call npm test
if errorlevel 1 (
 echo Tests did not pass. See errors above.
 pause
 exit /b 1
)
echo Setup complete. Double-click start.bat to launch RouteRescue.
pause
