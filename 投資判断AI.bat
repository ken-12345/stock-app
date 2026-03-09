@echo off
setlocal

cd /d "%~dp0"

title Investment Decision AI

echo Starting the application...
echo.

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

call npm start

if errorlevel 1 (
  echo.
  echo --------------------------------------------------
  echo The application exited with an error.
  echo Please check the error message above.
  echo --------------------------------------------------
  pause
)
