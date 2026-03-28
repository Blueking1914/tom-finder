#!/usr/bin/env bash
set -e

echo ""
echo " ===================================================="
echo "  🔍 Tom Finder — Finding Breed Using Hybrid ML Model"
echo " ===================================================="
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "[ERROR] Python 3 not found. Install from python.org"
  exit 1
fi

# Check Node
if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js not found. Install from nodejs.org"
  exit 1
fi

echo "[1/4] Installing backend dependencies..."
cd "$(dirname "$0")/backend"
python3 -m pip install -r requirements.txt -q
cd ..

echo "[2/4] Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..

echo "[3/4] Starting FastAPI backend on :8000 ..."
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

echo "[4/4] Starting React frontend on :5173 ..."
sleep 3

cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Auto-open browser
sleep 2
if command -v open &>/dev/null; then
  open "http://localhost:5173"
elif command -v xdg-open &>/dev/null; then
  xdg-open "http://localhost:5173"
fi

echo ""
echo " ✅ App running at  → http://localhost:5173"
echo "    API docs        → http://localhost:8000/docs"
echo ""
echo " Press Ctrl+C to stop everything."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'Stopped.'" INT TERM
wait
