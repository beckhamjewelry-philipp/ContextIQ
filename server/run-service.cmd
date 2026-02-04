@echo off
setlocal

set "REPO_ROOT=%~dp0.."
set "USER_HOME=C:\Users\PhilippBecker"

set "USERPROFILE=%USER_HOME%"
set "HOMEDRIVE=C:"
set "HOMEPATH=\Users\PhilippBecker"
set "APPDATA=%USER_HOME%\AppData\Roaming"
set "LOCALAPPDATA=%USER_HOME%\AppData\Local"

cd /d "%REPO_ROOT%"

"C:\nvm4w\nodejs\node.exe" "%~dp0index.js"
