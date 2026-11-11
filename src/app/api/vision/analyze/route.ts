import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getVisionServiceUrl } from "@/lib/env";
import { addAuditLog, getFullState, saveVisionEvent } from "@/lib/db/repository";
import { BoundingBox } from "@/types/retailens";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
]);

export async function POST(req: NextRequest) {
  const auth = await requireApiSession("view_dashboard");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const contentType = req.headers.get("content-type") || "";
    const state = await getFullState();

    // Case 1: Multipart upload of real frame / media
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const cameraId = String(form.get("cameraId") || "CAM-UPLOAD-01");
      const expectedSku = form.get("expectedSku") ? String(form.get("expectedSku")) : undefined;

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No image or video file uploaded." }, { status: 400 });
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Uploaded file exceeds 10MB security limit." }, { status: 413 });
      }
      if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `Unsupported media MIME type '${file.type}'. Allowed: JPEG, PNG, WebP, MP4, WebM.` },
          { status: 400 }
        );
      }

      // Attempt real FastAPI OpenCV inference first
      let visionBackendMode: "fastapi_opencv" | "simulation" = "simulation";
      let boxes: BoundingBox[] = [];
      let confidencePct = 89.4;
      let occupancyPct = 74.0;
      let anomalyFlag = false;
      let notes = "";

      const prod =
        state.products.find((p) => p.sku === expectedSku) ||
        state.products.find((p) => p.sku === "SKU-OLV-088") ||
        state.products[0];

      if (file.type.startsWith("image/")) {
        try {
          const forwardForm = new FormData();
          forwardForm.append("file", file);
          forwardForm.append("camera_id", cameraId);
          if (expectedSku) forwardForm.append("expected_sku", expectedSku);

          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 3500);
          const cvRes = await fetch(`${getVisionServiceUrl()}/analyze-frame`, {
            method: "POST",
            body: forwardForm,
            signal: controller.signal,
          });
          clearTimeout(t);

          if (cvRes.ok) {
            const cvJson = await cvRes.json();
            visionBackendMode = "fastapi_opencv";
            boxes = cvJson.bounding_boxes ?? [];
            confidencePct = Number(cvJson.confidence_pct ?? 90);
            occupancyPct = Number(cvJson.shelf_occupancy_pct ?? 75);
            anomalyFlag = Boolean(cvJson.anomaly_flag);
            notes = `Processed via FastAPI OpenCV (${cvJson.engine}, ${cvJson.resolution})`;
          }
        } catch {
          // FastAPI CV service offline -> transparent simulation fallback
        }
      }

      if (visionBackendMode === "simulation") {
        // Compute deterministic, file-signature-aware simulation analysis
        const buffer = Buffer.from(await file.arrayBuffer());
        const entropySeed = buffer.subarray(0, Math.min(256, buffer.length)).reduce((a, b) => a + b, 0);
        occupancyPct = Number((40 + (entropySeed % 55)).toFixed(1));
        confidencePct = Number((82 + (entropySeed % 15)).toFixed(1));
        anomalyFlag = occupancyPct < 45;
        boxes = [
          {
            label: prod.name,
            sku: prod.sku,
            confidence: confidencePct,
            x: 18,
            y: 22,
            width: 34,
            height: 52,
            status: anomalyFlag ? "low_stock" : "ok",
          },
          {
            label: anomalyFlag ? "Low Shelf Density Gap" : "Secondary Shelf Facing",
            sku: prod.sku,
            confidence: Number((confidencePct - 3.2).toFixed(1)),
            x: 56,
            y: 22,
            width: 28,
            height: 52,
            status: anomalyFlag ? "stockout" : "ok",
          },
        ];
        notes = `SIMULATION FALLBACK (OpenCV FastAPI offline): Analyzed uploaded ${file.name} (${Math.round(file.size / 1024)} KB).`;
      }

      const event = await saveVisionEvent({
        cameraId,
        feedMode: "upload",
        eventType: anomalyFlag ? "low_stock_detected" : "shelf_scan",
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        category: prod.category,
        aisle: prod.aisleLocation,
        confidencePct,
        shelfOccupancyPct: occupancyPct,
        boundingBoxes: boxes,
        anomalyFlag,
        notes,
      });

      await addAuditLog({
        actorId: auth.session.id,
        actorRole: auth.session.role,
        eventCategory: "vision",
        action: "media_frame_analyzed",
        entityType: "vision_event",
        entityId: event.id,
        summary: `Analyzed uploaded media (${file.name}) on ${cameraId} via ${visionBackendMode}.`,
        details: { visionBackendMode, confidencePct, occupancyPct },
      });

      return NextResponse.json({ visionBackendMode, event });
    }

    // Case 2: JSON camera simulation scan
    const body = await req.json();
    const cameraId = String(body.cameraId || "CAM-04");
    const sku = String(body.sku || "SKU-OLV-088");
    const scenario = String(body.scenario || "low_stock");

    const prod = state.products.find((p) => p.sku === sku) ?? state.products[0];
    const isAnomaly = scenario === "anomaly";
    const isStockout = scenario === "stockout" || prod.availableQuantity === 0;
    const isLow = scenario === "low_stock" || prod.stockStatus === "low_stock";

    const confidencePct = isAnomaly ? 63.2 : 94.8;
    const occupancyPct = isStockout ? 0 : isLow ? 18.0 : 84.5;

    const boxes: BoundingBox[] = [
      {
        label: prod.name,
        sku: prod.sku,
        confidence: confidencePct,
        x: 16,
        y: 24,
        width: 28,
        height: 48,
        status: isAnomaly ? "anomaly" : isStockout ? "stockout" : isLow ? "low_stock" : "ok",
      },
      {
        label: isLow || isStockout ? "Missing Facings Detected" : "Verified Stock Facings",
        sku: prod.sku,
        confidence: 91.4,
        x: 48,
        y: 24,
        width: 36,
        height: 48,
        status: isLow || isStockout ? "stockout" : "ok",
      },
    ];

    const event = await saveVisionEvent({
      cameraId,
      feedMode: "demo",
      eventType: isAnomaly
        ? "anomaly_detected"
        : isStockout
        ? "stockout_detected"
        : isLow
        ? "low_stock_detected"
        : "shelf_scan",
      productId: prod.id,
      sku: prod.sku,
      productName: prod.name,
      category: prod.category,
      aisle: prod.aisleLocation,
      confidencePct,
      shelfOccupancyPct: occupancyPct,
      boundingBoxes: boxes,
      anomalyFlag: isAnomaly || isStockout || isLow,
      notes: `[SIMULATED DEMO FEED] ${cameraId} scanned ${prod.sku} (${scenario}).`,
    });

    return NextResponse.json({ visionBackendMode: "simulation", event });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Vision analysis failed." },
      { status: 500 }
    );
  }
}

