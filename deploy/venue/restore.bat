@echo off
rem For the SPARE laptop if the main one stops: starts BOSS from the newest backup on the USB drive.
cd /d "%~dp0"
set /p USB=Type the letter of the USB drive, for example E, and press Enter: 
set "NEWEST="
for /f "delims=" %%f in ('dir /b /o-d "%USB%:\bis-backup\bis-*.db" 2^>nul') do if not defined NEWEST set "NEWEST=%%f"
if not defined NEWEST (
  echo Cannot find a backup in %USB%:\bis-backup
  pause
  exit /b 1
)
echo The newest backup is %NEWEST%
call "%~dp0setup.bat" "%USB%:\bis-backup\%NEWEST%"
