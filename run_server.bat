@echo off
title Rubik's World Django & WebSockets Backend
echo =======================================================
echo   Rubik's World Backend (Django 5 + Daphne WebSockets)
echo =======================================================
echo.
echo REST API:      http://127.0.0.1:8000/api/
echo WebSockets:    ws://127.0.0.1:8000/ws/duel/<ROOM_CODE>/
echo Django Admin:  http://127.0.0.1:8000/admin/
echo.
call venv\Scripts\python.exe -m daphne -b 127.0.0.1 -p 8000 core.asgi:application
pause
