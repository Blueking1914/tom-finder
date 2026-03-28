@echo off
echo.
echo  ====================================================
echo   Tom Finder - Finding Breed Using Hybrid ML Model
echo  ====================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.10+ from python.org
    pause & exit /b 1
)

:: Check Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from nodejs.org
    pause & exit /b 1
)

echo [1/4] Installing backend dependencies...
cd backend
python -m pip install -r requirements.txt --quiet
cd ..

echo [2/4] Installing frontend dependencies...
cd frontend
call npm install --silent
cd ..

echo [3/4] Starting FastAPI backend on port 8000...
start "Tom Finder Backend" cmd /k "cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo [4/4] Starting React frontend on port 5173...
timeout /t 4 /nobreak >nul
start "Tom Finder Frontend" cmd /k "cd frontend && npm run dev"

:: Auto-open browser
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo  Browser opened at http://localhost:5173
echo  Backend API docs: http://localhost:8000/docs
echo.
echo  To stop: close both terminal windows.
pause
