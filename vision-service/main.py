import base64
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from detector import YOLOShelfDetector

app = FastAPI(
    title="RetaiLens AI Computer Vision Microservice",
    version="1.0.0",
    description="OpenCV + YOLO-compatible retail shelf occupancy, product detection, and barcode validation service.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

detector = YOLOShelfDetector()


class SimulateRequest(BaseModel):
    camera_id: str = "CAM-04"
    scenario: str = "low_stock"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "retailens-vision-fastapi",
        "engine": "ultralytics_yolo" if detector.yolo_model else "opencv_cv_pipeline",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/analyze-frame")
async def analyze_frame(
    file: UploadFile = File(...),
    camera_id: str = Form("CAM-UPLOAD-01"),
    expected_sku: Optional[str] = Form(None),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded frame is empty.")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Uploaded media exceeds 10MB limit.")

    try:
        result = detector.analyze_image(content, camera_id=camera_id, expected_sku=expected_sku)
        result["timestamp"] = datetime.now(timezone.utc).isoformat()
        return result
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/simulate-frame")
def simulate_frame(req: SimulateRequest):
    raw_bytes, analysis = detector.generate_synthetic_frame(
        camera_id=req.camera_id, scenario=req.scenario
    )
    b64 = base64.b64encode(raw_bytes).decode("ascii")
    analysis["image_data_url"] = f"data:image/jpeg;base64,{b64}"
    analysis["timestamp"] = datetime.now(timezone.utc).isoformat()
    return analysis


@app.websocket("/ws/stream/{camera_id}")
async def stream_camera(websocket: WebSocket, camera_id: str):
    await websocket.accept()
    try:
        _, analysis = detector.generate_synthetic_frame(camera_id=camera_id, scenario="normal")
        analysis["timestamp"] = datetime.now(timezone.utc).isoformat()
        await websocket.send_json(analysis)
        while True:
            msg = await websocket.receive_text()
            scenario = msg.strip() or "normal"
            _, next_analysis = detector.generate_synthetic_frame(
                camera_id=camera_id, scenario=scenario
            )
            next_analysis["timestamp"] = datetime.now(timezone.utc).isoformat()
            await websocket.send_json(next_analysis)
    except WebSocketDisconnect:
        return

