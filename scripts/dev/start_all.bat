@echo off
REM Start all Kissan Rehnuma development services.
REM See scripts/dev/start_all.py for details.

cd /d "%~dp0\..\.."
python scripts\dev\start_all.py

pause
