@echo off
cd /d "%~dp0web"
echo MyBodyTrack local preview: http://localhost:8000
start "" http://localhost:8000
py -m http.server 8000 --bind 127.0.0.1
if errorlevel 1 python -m http.server 8000 --bind 127.0.0.1
pause
