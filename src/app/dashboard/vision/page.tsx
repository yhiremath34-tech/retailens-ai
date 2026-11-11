"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Camera, Eye, Scan, Upload, Video } from "lucide-react";
import { useStoreData } from "@/components/providers/StoreContext";
import {
  PanelCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";
import { formatRelativeTime } from "@/lib/utils";
import { BoundingBox } from "@/types/retailens";

const STORE_CAMERAS = [
  { id: "CAM-01", label: "CAM-01 • Aisle 1 (Coffee & Tea)", sku: "SKU-COF-001" },
  { id: "CAM-02", label: "CAM-02 • Aisle 2 (Artisanal Snacks)", sku: "SKU-GRN-012" },
  { id: "CAM-03", label: "CAM-03 • Aisle 3 (Chilled Dairy)", sku: "SKU-MLK-002" },
  { id: "CAM-04", label: "CAM-04 • Aisle 4 (Oils & Condiments)", sku: "SKU-OLV-088" },
  { id: "CAM-CHK-01", label: "CAM-CHK-01 • Checkout Lane 01", sku: "SKU-COF-001" },
  { id: "CAM-CHK-02", label: "CAM-CHK-02 • Checkout Lane 02", sku: "SKU-YOG-006" },
];

export default function VisionPage() {
  const { state, modes, refresh } = useStoreData();
  const { pushToast } = useToast();

  const [mode, setMode] = useState<"demo" | "connected">("demo");
  const [selectedCamera, setSelectedCamera] = useState(STORE_CAMERAS[3].id);
  const [scenarioPreset, setScenarioPreset] = useState<"normal" | "low_stock" | "stockout" | "anomaly">("low_stock");
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [activeBoxes, setActiveBoxes] = useState<BoundingBox[] | null>(null);
  const [lastBackendMode, setLastBackendMode] = useState<string>("simulation");

  const camMeta = STORE_CAMERAS.find((c) => c.id === selectedCamera) ?? STORE_CAMERAS[0];
  const latestEventForCam = useMemo(() => {
    if (!state) return null;
    return (
      state.visionEvents.find((e) => e.cameraId === selectedCamera) ??
      state.visionEvents[0] ??
      null
    );
  }, [state, selectedCamera]);

  const boxesToShow = activeBoxes ?? latestEventForCam?.boundingBoxes ?? [];

  async function runSimulatedScan() {
    setAnalyzing(true);
    setUploadedPreviewUrl(null);
    try {
      const res = await fetch("/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cameraId: selectedCamera,
          sku: camMeta.sku,
          scenario: scenarioPreset,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setActiveBoxes(data.event.boundingBoxes);
      setLastBackendMode(data.visionBackendMode);
      await refresh();
      pushToast({
        kind: data.event.anomalyFlag ? "warning" : "success",
        title: `Frame analyzed (${selectedCamera})`,
        message: `Confidence ${data.event.confidencePct}% • Occupancy ${data.event.shelfOccupancyPct ?? "N/A"}%`,
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Vision scan failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setUploadedPreviewUrl(url);
    } else {
      setUploadedPreviewUrl(null);
    }

    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cameraId", selectedCamera);
      formData.append("expectedSku", camMeta.sku);

      const res = await fetch("/api/vision/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Media upload failed");

      setActiveBoxes(data.event.boundingBoxes);
      setLastBackendMode(data.visionBackendMode);
      await refresh();
      pushToast({
        kind: "success",
        title: `Uploaded media processed (${data.visionBackendMode === "fastapi_opencv" ? "FastAPI OpenCV" : "Simulation Fallback"})`,
        message: `Confidence ${data.event.confidencePct}% • Occupancy ${data.event.shelfOccupancyPct}%`,
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Upload analysis failed",
        message: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setAnalyzing(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Live Computer Vision Monitoring"
        subtitle="Inspect aisle shelves and checkout lanes with bounding boxes, occupancy estimation, and OpenCV/YOLO-compatible frame uploads."
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              type="button"
              onClick={() => setMode("demo")}
              className={mode === "demo" ? "border-sky-400 bg-sky-300 text-slate-950 font-semibold hover:bg-sky-400" : ""}
            >
              <Eye className="h-4 w-4" />
              Mode 1: Demo Simulation
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => setMode("connected")}
              className={mode === "connected" ? "border-sky-400 bg-sky-300 text-slate-950 font-semibold hover:bg-sky-400" : ""}
            >
              <Video className="h-4 w-4" />
              Mode 2: Connected / Upload
            </SecondaryButton>
          </div>
        }
      />

      {/* Mode Disclaimer Banner */}
      <PanelCard className="border-sky-200 bg-sky-50/70 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-sky-950">
            <Camera className="h-4 w-4 shrink-0 text-sky-700" />
            {mode === "demo" ? (
              <span>
                <strong>DEMO MODE ACTIVE:</strong> Displaying simulated shelf/checkout bounding-box telemetry. No unauthorized external CCTV feed is claimed.
              </span>
            ) : (
              <span>
                <strong>CONNECTED CAMERA / UPLOAD PIPELINE:</strong> Upload a permitted shelf or product image/video to analyze via{" "}
                {modes?.visionMode === "fastapi_opencv"
                  ? "Connected Python FastAPI + OpenCV Service"
                  : "Server Simulation Fallback (start Python vision-service on port 8000 for live OpenCV inference)"}.
              </span>
            )}
          </div>
          <StatusBadge tone={modes?.visionMode === "fastapi_opencv" ? "green" : "amber"}>
            CV Engine: {modes?.visionMode === "fastapi_opencv" ? "OpenCV FastAPI Online" : lastBackendMode}
          </StatusBadge>
        </div>
      </PanelCard>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Camera Viewport */}
        <PanelCard className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="cam-select" className="sr-only">
                Camera Feed
              </label>
              <select
                id="cam-select"
                value={selectedCamera}
                onChange={(e) => {
                  setSelectedCamera(e.target.value);
                  setActiveBoxes(null);
                }}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900"
              >
                {STORE_CAMERAS.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label}
                  </option>
                ))}
              </select>

              {mode === "demo" && (
                <select
                  aria-label="Simulation scenario preset"
                  value={scenarioPreset}
                  onChange={(e) =>
                    setScenarioPreset(e.target.value as "normal" | "low_stock" | "stockout" | "anomaly")
                  }
                  className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900"
                >
                  <option value="normal">Healthy Shelf (85%)</option>
                  <option value="low_stock">Low Stock Alert (18%)</option>
                  <option value="stockout">Empty Shelf Stockout (0%)</option>
                  <option value="anomaly">Low-Confidence Anomaly (63%)</option>
                </select>
              )}
            </div>

            {mode === "demo" ? (
              <PrimaryButton type="button" onClick={runSimulatedScan} disabled={analyzing}>
                <Scan className="h-4 w-4" />
                {analyzing ? "Scanning Frame..." : "Capture & Analyze Frame"}
              </PrimaryButton>
            ) : (
              <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border border-sky-400 bg-sky-300 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-sky-400">
                <Upload className="h-4 w-4" />
                {analyzing ? "Processing..." : "Upload Test Image / Video"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            )}
          </div>

          {/* Interactive Annotated Frame Surface */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {uploadedPreviewUrl ? (
              <Image
                src={uploadedPreviewUrl}
                alt="Uploaded retail frame for computer vision analysis"
                fill
                unoptimized
                className="object-contain"
              />
            ) : (
              <svg
                viewBox="0 0 800 450"
                className="h-full w-full"
                role="img"
                aria-label={`Simulated store camera feed ${selectedCamera}`}
              >
                <rect width="800" height="450" fill="#f8fafc" />
                {/* Store shelf architecture */}
                <line x1="40" y1="150" x2="760" y2="150" stroke="#cbd5e1" strokeWidth="6" />
                <line x1="40" y1="335" x2="760" y2="335" stroke="#94a3b8" strokeWidth="8" />
                <line x1="40" y1="40" x2="40" y2="410" stroke="#cbd5e1" strokeWidth="4" />
                <line x1="760" y1="40" x2="760" y2="410" stroke="#cbd5e1" strokeWidth="4" />
                {/* Live product facings using studio product photos */}
                {[0, 1, 2, 3, 4].map((slot) => {
                  const occupied =
                    scenarioPreset === "normal"
                      ? true
                      : scenarioPreset === "low_stock"
                      ? slot === 0
                      : scenarioPreset === "anomaly"
                      ? slot < 3
                      : false;
                  return (
                    <g key={slot} transform={`translate(${88 + slot * 128}, 182)`}>
                      {occupied ? (
                        <>
                          <rect
                            width="98"
                            height="146"
                            rx="10"
                            fill="#ffffff"
                            stroke="#7dd3fc"
                            strokeWidth="2"
                          />
                          <image
                            href={`/products/${camMeta.sku}.jpg`}
                            x="9"
                            y="10"
                            width="80"
                            height="104"
                            preserveAspectRatio="xMidYMid meet"
                          />
                          <text
                            x="49"
                            y="132"
                            textAnchor="middle"
                            fill="#0369a1"
                            fontSize="10"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {camMeta.sku.replace("SKU-", "")}
                          </text>
                        </>
                      ) : (
                        <rect
                          width="98"
                          height="146"
                          rx="10"
                          fill="#f1f5f9"
                          stroke="#94a3b8"
                          strokeDasharray="6 6"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Overlay HUD */}
            <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between text-[11px] font-mono">
              <span className="rounded bg-white/90 px-2 py-1 text-sky-900 ring-1 ring-sky-200 shadow-xs">
                {selectedCamera} • {mode === "demo" ? "SIMULATION OVERLAY" : "UPLOAD / OPENCV"}
              </span>
              <span className="rounded bg-white/90 px-2 py-1 text-slate-800 ring-1 ring-slate-200 shadow-xs">
                Occupancy: {latestEventForCam?.shelfOccupancyPct ?? 80}% • Conf:{" "}
                {latestEventForCam?.confidencePct ?? 94}%
              </span>
            </div>

            {/* Bounding Boxes Overlay */}
            {boxesToShow.map((box, idx) => {
              const color =
                box.status === "stockout"
                  ? "border-rose-500 bg-rose-500/10 text-rose-900"
                  : box.status === "low_stock" || box.status === "anomaly"
                  ? "border-amber-500 bg-amber-500/10 text-amber-950"
                  : "border-emerald-500 bg-emerald-500/10 text-emerald-950";
              return (
                <div
                  key={`${box.sku}-${idx}`}
                  style={{
                    left: `${box.x}%`,
                    top: `${box.y}%`,
                    width: `${box.width}%`,
                    height: `${box.height}%`,
                  }}
                  className={`pointer-events-none absolute rounded-md border-2 ${color}`}
                >
                  <span className="inline-block rounded-br bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                    {box.sku} ({box.confidence}%)
                  </span>
                </div>
              );
            })}
          </div>
        </PanelCard>

        {/* Camera Telemetry Inspector */}
        <PanelCard className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-950">Active Detection Telemetry</h2>
          {latestEventForCam ? (
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <Image
                  src={`/products/${latestEventForCam.sku || camMeta.sku}.jpg`}
                  alt={latestEventForCam.productName || camMeta.sku}
                  width={52}
                  height={52}
                  unoptimized
                  className="h-13 w-13 shrink-0 rounded-lg border border-slate-200 bg-white p-0.5 object-contain"
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">
                    {latestEventForCam.productName || camMeta.label}
                  </p>
                  <p className="font-mono text-[11px] font-semibold text-sky-700">
                    {latestEventForCam.sku || camMeta.sku}
                  </p>
                </div>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Camera ID</span>
                <span className="font-mono font-semibold text-slate-900">{latestEventForCam.cameraId}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Detected SKU</span>
                <span className="font-mono font-semibold text-sky-700">{latestEventForCam.sku || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Confidence Score</span>
                <span className="font-semibold text-slate-900">{latestEventForCam.confidencePct}%</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Shelf Occupancy</span>
                <span className="font-semibold text-slate-900">
                  {latestEventForCam.shelfOccupancyPct !== null
                    ? `${latestEventForCam.shelfOccupancyPct}%`
                    : "Checkout Lane"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Category / Aisle</span>
                <span className="text-right text-slate-800">
                  {latestEventForCam.category} • {latestEventForCam.aisle}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timestamp</span>
                <span className="text-slate-700">{formatRelativeTime(latestEventForCam.createdAt)}</span>
              </div>

              {latestEventForCam.anomalyFlag && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Anomaly Flagged
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed">{latestEventForCam.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-600">No vision events captured yet.</p>
          )}
        </PanelCard>
      </div>

      {/* Vision Events Log Table */}
      <PanelCard>
        <h2 id="vision-table-title" className="mb-4 text-sm font-semibold text-slate-950">
          Recent Computer Vision Detection Stream
        </h2>
        <div tabIndex={0} role="region" aria-labelledby="vision-table-title" className="table-wrapper">
          <table className="retail-table retail-table-responsive text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-3 py-2.5">Camera</th>
                <th className="px-3 py-2.5">Event</th>
                <th className="px-3 py-2.5">SKU / Product</th>
                <th className="px-3 py-2.5">Aisle</th>
                <th className="px-3 py-2.5">Confidence</th>
                <th className="px-3 py-2.5">Occupancy</th>
                <th className="px-3 py-2.5">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(state?.visionEvents ?? []).slice(0, 12).map((ev) => (
                <tr key={ev.id} className="hover:bg-sky-50/40">
                  <th className="px-3 py-2.5 font-mono font-semibold text-sky-700">{ev.cameraId}</th>
                  <td data-label="Event" className="px-3 py-2.5">
                    <StatusBadge tone={ev.anomalyFlag ? "amber" : "green"}>{ev.eventType}</StatusBadge>
                  </td>
                  <td data-label="SKU" className="px-3 py-2.5 text-slate-800">
                    {ev.sku} {ev.productName ? `• ${ev.productName}` : ""}
                  </td>
                  <td data-label="Aisle" className="px-3 py-2.5 text-slate-600">{ev.aisle}</td>
                  <td data-label="Confidence" className="px-3 py-2.5 font-mono text-slate-900">
                    {ev.confidencePct}%
                  </td>
                  <td data-label="Occupancy" className="px-3 py-2.5 text-slate-700">
                    {ev.shelfOccupancyPct !== null ? `${ev.shelfOccupancyPct}%` : "—"}
                  </td>
                  <td data-label="Time" className="px-3 py-2.5 text-slate-500">
                    {formatRelativeTime(ev.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>
  );
}

