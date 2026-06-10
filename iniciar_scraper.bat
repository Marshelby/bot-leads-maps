@echo off
set "ROOT=%~dp0"

start "Backend FastAPI" cmd /k "title Backend FastAPI && cd /d "%ROOT%" && call venv\Scripts\activate && uvicorn backend.main:app --reload"
start "Frontend Vite" cmd /k "title Frontend Vite && cd /d "%ROOT%" && npm run dev"
