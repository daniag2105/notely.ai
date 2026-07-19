@echo off
REM Notely.ai - double-click setup for Windows.
REM Just double-click this file. It installs everything, builds the app, and opens the folder with
REM the installer. You never have to type a command. Your keys are entered later, inside the app -
REM this script never touches them.

REM Run from this file's own folder, no matter where it's launched from.
cd /d "%~dp0"

echo.
echo   Notely.ai - setup
echo   -----------------
echo.

REM 1. Node check
where node >nul 2>nul
if errorlevel 1 (
  echo   [X] Node.js isn't installed - it's required to run Notely.ai.
  echo       Opening the download page... install the LTS version, then run this again.
  start "" "https://nodejs.org"
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo   [ok] Node %%v

REM 2. Install dependencies
echo.
echo   Installing dependencies (this can take a minute)...
call npm install
if errorlevel 1 goto :fail

REM 3. Build the Windows app
echo.
echo   Building the app...
call npm run build:win
if errorlevel 1 goto :fail

REM 4. Open the dist folder with the installer
echo.
echo   [ok] Done. Opening the 'dist' folder - run the installer inside it (notely-...-setup.exe).
start "" "dist"

echo.
echo   Next steps:
echo     1. Run the installer in the dist folder (if Windows warns, click "More info" then "Run anyway").
echo     2. Open Notely.ai, click Settings, and paste your Anthropic API key (console.anthropic.com).
echo     3. Optionally add your Notion integration token to enable "Send to Notion".
echo.
pause
exit /b 0

:fail
echo.
echo   Something went wrong above. Make sure Node.js is installed and try again.
echo.
pause
exit /b 1
