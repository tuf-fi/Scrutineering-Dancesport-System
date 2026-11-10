@echo off
rem Shows the address everyone types on their phone or laptop.
echo.
echo BOSS is running. On the venue Wi-Fi, everyone opens one of these addresses:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=*" %%b in ("%%a") do echo    http://%%b
)
echo.
echo Staff:   add /staff-access        Compere: add /compere        Adjudicators: scan their card
echo Check that it works: open the address followed by /api/health on a phone. It should say "mode":"venue".
pause
