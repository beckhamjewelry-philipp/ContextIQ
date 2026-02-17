@echo off
REM Build script for CustomerIQ Customer Context Platform

echo ========================================================
echo         CustomerIQ Customer Context Platform
echo                   Build Script
echo ========================================================
echo.

REM Install server dependencies
echo Installing server dependencies...
cd server
call npm install
cd ..

REM Install extension dependencies (if extension exists)
if exist "extension\" (
  echo Installing extension dependencies...
  cd extension
  call npm install
  cd ..
)

echo.
echo Build completed successfully!
echo.
echo Next steps:
echo 1. Configure settings: copy config.env.example config.env
echo 2. Edit config.env with your database and service settings
echo 3. Start the application: start.bat
echo 4. Access web UI at: http://localhost:3000
echo.
echo For production deployment, see DEPLOYMENT_GUIDE.md
