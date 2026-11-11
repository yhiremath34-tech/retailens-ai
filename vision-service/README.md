# RetaiLens AI — Python Computer Vision Microservice

FastAPI + OpenCV (+ optional Ultralytics YOLO weights) service for shelf occupancy analysis, bounding-box detection, and barcode validation.

## Local Setup

```bash
cd vision-service
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Set `VISION_SERVICE_URL=http://127.0.0.1:8000` in the Next.js `.env.local` file.

