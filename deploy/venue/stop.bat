@echo off
rem Stops BOSS on this laptop. Nothing is lost: start.bat brings it back as it was.
cd /d "%~dp0"
docker compose stop
echo BOSS is stopped.
pause
