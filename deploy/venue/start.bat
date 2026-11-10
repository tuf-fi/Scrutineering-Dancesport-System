@echo off
rem Starts BOSS on this laptop (after a restart, or after stop.bat). It keeps everything that was already there.
cd /d "%~dp0"
docker version >nul 2>&1
if errorlevel 1 (
  echo Docker is not running. Open Docker Desktop, wait until it says it is running, then double-click this again.
  pause
  exit /b 1
)
docker compose up -d
call "%~dp0show-address.bat"
