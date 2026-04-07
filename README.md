# 🐾 PawSense — AI Pet Intelligence 

Upload a photo of any cat or dog. PawSense detects the species, identifies the breed,
assesses visible health conditions, reads emotions, and uses Claude AI to give you expert insights —
price, lifespan, origin, care tips and more.

---

## ⚡ Quick Start

### 1. Add your Anthropic API key
Open `backend/.env` and paste your key:
```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
```
Get a key at https://console.anthropic.com

### 2. Run the app

**Windows:**
```
Double-click start.bat
```

**Mac / Linux:**
```bash
chmod +x start.sh && ./start.sh
```

**VS Code terminal (any OS):**
```bash
# Terminal 1 — Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

### 3. Browser opens automatically
→ http://localhost:5173

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🐾 Breed Detection | EfficientNetV2-S classifies 120+ dog breeds and 20 cat breeds |
| 🏥 Health Assessment | Image statistics-based health heuristics |
| 😊 Emotion Detection | Detects Happy, Calm, Anxious, Playful, Tired, Aggressive |
| 🐕 Multi-Pet Detection | YOLOv8 detects and analyzes each pet individually |
| 🤖 AI Insights | Claude Sonnet provides origin, price, lifespan, care tips |
| 📸 Webcam Mode | Live camera capture and analysis |
| 🗣️ Voice Readout | Text-to-speech reads results aloud |
| 📄 PDF Export | Download a branded analysis report |
| 🏥 Vet Finder | Find nearby veterinary clinics via geolocation |
| 📜 History | Last 10 analyses saved in browser, click to restore |

---

## 🧠 How It Works

```
Photo upload / Webcam capture
    │
    ▼
YOLOv8 (multi-pet detection)
    │  └─ Crop each pet individually
    │
    ▼
EfficientNetV2-S (timm, ImageNet pretrained)
    │  ├─ Cat vs Dog classification
    │  ├─ Breed identification
    │  ├─ Health heuristic from image statistics
    │  └─ Emotion heuristic from color/contrast analysis
    │
    ▼
Claude Sonnet (Anthropic API)
    │  ├─ Origin & habitat
    │  ├─ Price range (USD)
    │  ├─ Lifespan
    │  ├─ Temperament
    │  ├─ Care tips
    │  ├─ Health advice
    │  └─ Fun fact
    │
    ▼
React Dashboard (animated cards)
    ├─ Confidence bar
    ├─ Health badges (green / yellow / red)
    ├─ Emotion emoji badge
    ├─ Multi-pet grid
    ├─ Voice readout + PDF export
    └─ Nearby vet finder
```

## 📁 Project Structure

```
pawsense/
├── backend/
│   ├── main.py            ← FastAPI + EfficientNetV2 + YOLOv8 + Claude
│   ├── requirements.txt
│   └── .env               ← Add ANTHROPIC_API_KEY here
├── frontend/
│   ├── src/
│   │   ├── App.jsx        ← Full React UI with all features
│   │   ├── main.jsx
│   │   └── index.css      ← Dark theme design system
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── start.bat              ← Windows launcher (auto-opens browser)
├── start.sh               ← Mac/Linux launcher (auto-opens browser)
└── README.md
```

## 🔧 Requirements

- Python 3.10+
- Node.js 18+
- ~3 GB disk (PyTorch + timm + YOLO model weights)
- Anthropic API key (free tier works)

## 🛠 API Endpoints

| Method | Path      | Description                               |
|--------|-----------|-------------------------------------------|
| GET    | /         | API status check                          |
| GET    | /health   | Simple health check                       |
| GET    | /ready    | Returns 200 only after models are loaded  |
| POST   | /analyze  | Upload image → full multi-pet analysis    |

## 📝 Notes

- First startup downloads ~150 MB of model weights (EfficientNetV2-S + YOLOv8n). Subsequent starts are instant.
- Models are pre-loaded at server startup — no cold-start delay on first request.
- Without an API key the vision model still runs — you just won't get the AI insight cards.
- Works on CPU — no GPU required.
- CORS is open (`*`) for development; restrict `allow_origins` in production.
