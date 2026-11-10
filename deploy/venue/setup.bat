@echo off
rem Puts a copy of the online database on this laptop and starts BOSS. Double-click it, once, before the event.
rem  setup.bat                     uses bis-venue-copy.db from this folder
rem  setup.bat "E:\path\bis-x.db"  uses that file instead (restore.bat does this)
setlocal EnableDelayedExpansion
cd /d "%~dp0"

docker version >nul 2>&1
if errorlevel 1 (
  echo Docker is not running. Open Docker Desktop, wait until it says it is running, then double-click this again.
  pause
  exit /b 1
)

set "COPY=%~1"
if "%COPY%"=="" set "COPY=%~dp0bis-venue-copy.db"
if not exist "%COPY%" (
  echo Cannot find the database copy: %COPY%
  echo Download it from the online site, Offline day, Download database copy, and put it in this folder.
  pause
  exit /b 1
)

echo.
echo This puts the copy on this laptop and REPLACES anything BOSS already has here.
echo Only do this before the event. Never during it.
set /p OK=Type YES and press Enter to go on: 
if /i not "%OK%"=="YES" (
  echo Nothing was changed.
  pause
  exit /b 1
)

if not exist .env (
  set /p KEY=Paste the secret code the admin gave you and press Enter: 
  set /p USB=Type the letter of the USB drive, for example E, and press Enter: 
  mkdir "!USB!:\bis-backup" >nul 2>&1
  (
    echo DATA_KEY=!KEY!
    echo USB_BACKUP=!USB!:/bis-backup
  ) > .env
)

docker compose down -v
docker compose up --no-start --build
if errorlevel 1 goto failed
docker compose cp "%COPY%" app:/data/bis.db
if errorlevel 1 goto failed
docker compose up -d
if errorlevel 1 goto failed
call "%~dp0show-address.bat"
exit /b 0

:failed
echo.
echo Something went wrong. Take a photo of this window and send it to the person who set this up.
pause
exit /b 1
