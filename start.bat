@echo off
REM CustomerIQ Startup Script for Windows

echo ========================================================
echo         CustomerIQ Customer Context Platform
echo                  Startup Script
echo ========================================================
echo.

REM Check if config exists
if not exist "config.env" (
    echo Warning: config.env not found. Creating from template...
    copy config.env.example config.env
    echo Created config.env - Please edit with your settings
    echo.
)

REM Load configuration (simplified for Windows)
for /f "tokens=1,2 delims==" %%a in (config.env) do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        set "%%a=%%b"
    )
)

echo Configuration:
echo    Database: %DB_PROVIDER%
echo    MCP Server: %MCP_ENABLED%
echo    REST API: %API_ENABLED% (port %API_PORT%)
echo    NATS Events: %NATS_ENABLED%
echo    CRM Sync: %CRM_ENABLED% (%CRM_TYPE%)
echo.

echo Starting CustomerIQ...
echo.

cd server
node app.js
