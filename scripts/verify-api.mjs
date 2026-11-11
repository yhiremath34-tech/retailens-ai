#!/usr/bin/env node
/**
 * End-to-end API & RBAC verification smoke script for a running RetaiLens AI server.
 * Usage: node scripts/verify-api.mjs --base-url http://127.0.0.1:3000
 */

const args = process.argv.slice(2);
const baseUrlIdx = args.indexOf("--base-url");
const BASE_URL = (baseUrlIdx !== -1 && args[baseUrlIdx + 1]) || "http://127.0.0.1:3000";

function assert(cond, message) {
  if (!cond) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function request(path, options = {}, cookieJar = null) {
  const headers = new Headers(options.headers || {});
  if (cookieJar && cookieJar.value) {
    headers.set("cookie", cookieJar.value);
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie && cookieJar) {
    const cookiePair = setCookie.split(";")[0];
    if (cookiePair) cookieJar.value = cookiePair;
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON response (e.g. HTML)
  }
  return { status: res.status, headers: res.headers, text, json };
}

async function main() {
  console.log(`[verify-api] Probing ${BASE_URL} ...`);

  // 1. Public pages & health
  const landing = await request("/");
  assert(landing.status === 200, `Expected 200 on /, got ${landing.status}`);
  assert(landing.text.includes("RetaiLens"), "Landing page missing RetaiLens branding");

  const arch = await request("/how-it-works");
  assert(arch.status === 200, `Expected 200 on /how-it-works, got ${arch.status}`);

  const removedLogin = await request("/login");
  assert(removedLogin.status === 404, `Expected 404 on removed /login route, got ${removedLogin.status}`);

  const health = await request("/api/health");
  assert(health.status === 200 && health.json?.ok === true, "Health check failed");
  console.log("[verify-api] Public pages & /api/health OK:", health.json.modes);

  // 2. Direct dashboard access without login screen
  const directState = await request("/api/store/state");
  assert(
    directState.status === 200 && Array.isArray(directState.json?.state?.products),
    `Expected 200 on direct /api/store/state, got ${directState.status}`
  );

  const directDash = await request("/dashboard");
  assert(directDash.status === 200, `Expected 200 on direct /dashboard, got ${directDash.status}`);
  console.log("[verify-api] Direct open dashboard access OK");

  // 3. Cashier RBAC enforcement (should be denied admin/approval mutations with 403)
  const cashierCookies = { value: "" };
  const cashierLogin = await request(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "cashier@retailens.demo", password: "demo1234" }),
    },
    cashierCookies
  );
  assert(cashierLogin.status === 200 && cashierCookies.value, "Cashier login failed");

  const cashierInvCreate = await request(
    "/api/inventory",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sku: "SKU-FORBID" }),
    },
    cashierCookies
  );
  assert(cashierInvCreate.status === 403, `Expected 403 for cashier POST /api/inventory, got ${cashierInvCreate.status}`);

  const cashierApprove = await request(
    "/api/approvals/dummy-id/decide",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved", notes: "test" }),
    },
    cashierCookies
  );
  assert(cashierApprove.status === 403, `Expected 403 for cashier approval, got ${cashierApprove.status}`);
  console.log("[verify-api] Cashier server-side RBAC 403 checks OK");

  // 4. Manager login & authenticated workflows
  const mgrCookies = { value: "" };
  const mgrLogin = await request(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "manager@retailens.demo", password: "demo1234" }),
    },
    mgrCookies
  );
  assert(mgrLogin.status === 200 && mgrCookies.value, "Manager login failed");

  const dashHtml = await request("/dashboard", {}, mgrCookies);
  assert(dashHtml.status === 200, `Expected 200 on authenticated /dashboard, got ${dashHtml.status}`);

  const storeState = await request("/api/store/state", {}, mgrCookies);
  const state = storeState.json?.state;
  assert(storeState.status === 200 && Array.isArray(state?.products), "Store state invalid");
  assert(state.products.length >= 20, "Expected seeded products >= 20");
  console.log(`[verify-api] Manager dashboard & state OK (${state.products.length} products)`);

  // 5. Inventory create & delete cycle
  const supplierId = state.suppliers[0].id;
  const created = await request(
    "/api/inventory",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "SKU-SMK-999",
        name: "Smoke Test Matcha Can",
        barcode: "8901425999991",
        category: "Beverages",
        sellingPrice: 320,
        costPrice: 200,
        availableQuantity: 25,
        minStockThreshold: 10,
        maxStockThreshold: 60,
        aisleLocation: "Aisle 1 - Coffee & Tea",
        batchNumber: "SMK-26-01",
        expiryDate: "2027-01-15",
        primarySupplierId: supplierId,
      }),
    },
    mgrCookies
  );
  assert(created.status === 201 && created.json?.product?.id, "Inventory create failed");
  const del = await request(`/api/inventory/${created.json.product.id}`, { method: "DELETE" }, mgrCookies);
  assert(del.status === 200, `Inventory delete failed (${del.status})`);
  console.log("[verify-api] Inventory create & delete cycle OK");

  // 6. Demo Scenarios A/B/C + Approval execution + Agent + Checkout + Pricing + Memory + Reset
  const scenA = await request(
    "/api/demo/scenario",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario: "frictionless_checkout" }),
    },
    mgrCookies
  );
  assert(scenA.status === 200, "Scenario A failed");

  const scenB = await request(
    "/api/demo/scenario",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario: "shelf_stockout" }),
    },
    mgrCookies
  );
  assert(scenB.status === 200, "Scenario B failed");

  const stateAfterB = await request("/api/store/state", {}, mgrCookies);
  const pendingPoApproval = stateAfterB.json?.state?.approvalRequests?.find(
    (r) => r.status === "pending" && r.actionType === "supplier_po_dispatch"
  );
  assert(pendingPoApproval, "Expected pending PO approval after Scenario B");

  const approvePo = await request(
    `/api/approvals/${pendingPoApproval.id}/decide`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved", notes: "Smoke test PO verification" }),
    },
    mgrCookies
  );
  assert(approvePo.status === 200 && approvePo.json?.executionResult?.executedAction === "purchase_order_dispatched", "Approval execution failed");

  const scenC = await request(
    "/api/demo/scenario",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario: "checkout_anomaly" }),
    },
    mgrCookies
  );
  assert(scenC.status === 200, "Scenario C failed");

  const agentRun = await request(
    "/api/agent/run",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        objective: "Check expiring Hill Farm Whole Milk SKU-MLK-002 pricing rules",
        triggerSource: "smoke_test",
      }),
    },
    mgrCookies
  );
  assert(agentRun.status === 201 && agentRun.json?.run?.id, "Agent run failed");

  const badge = await request("/api/product-badge?sku=SKU-COF-001&name=Coffee", {}, mgrCookies);
  assert(badge.status === 200 && badge.text.includes("<svg"), "Product badge SVG failed");

  const pricing = await request(
    "/api/pricing",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "scan", sku: "SKU-MLK-002" }),
    },
    mgrCookies
  );
  assert(pricing.status === 200, `Pricing scan failed (${pricing.status})`);

  const checkout = await request(
    "/api/checkout",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cameraId: "CAM-CHK-01",
        items: [{ sku: "SKU-COF-001", quantity: 1, visualConfidence: 96.8 }],
      }),
    },
    mgrCookies
  );
  assert(checkout.status === 201 && checkout.json?.session?.id, `Checkout failed (${checkout.status})`);

  const vision = await request(
    "/api/vision/analyze",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cameraId: "CAM-04", sku: "SKU-OLV-088", scenario: "low_stock" }),
    },
    mgrCookies
  );
  assert(vision.status === 200 && vision.json?.event?.id, `Vision analyze failed (${vision.status})`);

  if (health.json.modes?.visionMode === "fastapi_opencv") {
    const simRes = await fetch("http://127.0.0.1:8000/simulate-frame", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ camera_id: "CAM-04", scenario: "low_stock" }),
    });
    assert(simRes.ok, `FastAPI /simulate-frame failed (${simRes.status})`);
    const simJson = await simRes.json();
    const b64 = String(simJson.image_data_url || "").split(",")[1];
    assert(b64, "Missing base64 image from FastAPI /simulate-frame");
    const jpegBytes = Buffer.from(b64, "base64");
    const form = new FormData();
    form.append("file", new Blob([jpegBytes], { type: "image/jpeg" }), "shelf-low-stock.jpg");
    form.append("cameraId", "CAM-04");
    form.append("expectedSku", "SKU-OLV-088");
    const cvUpload = await request(
      "/api/vision/analyze",
      { method: "POST", body: form },
      mgrCookies
    );
    assert(
      cvUpload.status === 200 && cvUpload.json?.visionBackendMode === "fastapi_opencv",
      `Expected fastapi_opencv roundtrip, got ${cvUpload.status} / ${cvUpload.json?.visionBackendMode}`
    );
    console.log(
      "[verify-api] Live FastAPI OpenCV multipart roundtrip OK:",
      {
        occupancy: cvUpload.json.event?.shelfOccupancyPct,
        confidence: cvUpload.json.event?.confidencePct,
        anomaly: cvUpload.json.event?.anomalyFlag,
      }
    );
  }

  const memSave = await request(
    "/api/memory",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        category: "operational",
        sku: "SKU-COF-001",
        title: "Smoke Memory Entry",
        content: "Verified cross-session memory persistence via REST API.",
      }),
    },
    mgrCookies
  );
  assert(memSave.status === 201 && memSave.json?.memory?.id, `Memory POST failed (${memSave.status})`);

  const poDraft = await request(
    "/api/purchase-orders",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sku: "SKU-OLV-088", quantity: 24, reason: "Smoke test replenishment" }),
    },
    mgrCookies
  );
  assert(poDraft.status === 201 && poDraft.json?.result?.purchaseOrderId, `PO POST failed (${poDraft.status})`);

  const settingsPatch = await request(
    "/api/settings",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ minMarginPct: 12 }),
    },
    mgrCookies
  );
  assert(settingsPatch.status === 200 && settingsPatch.json?.rules?.minMarginPct === 12, `Settings PATCH failed (${settingsPatch.status})`);

  // Verify all 14 dashboard routes render HTTP 200 without Next error boundary
  const dashboardRoutes = [
    "/dashboard",
    "/dashboard/vision",
    "/dashboard/inventory",
    "/dashboard/checkout",
    "/dashboard/agent",
    "/dashboard/memory",
    "/dashboard/pricing",
    "/dashboard/suppliers",
    "/dashboard/purchase-orders",
    "/dashboard/approvals",
    "/dashboard/analytics",
    "/dashboard/timeline",
    "/dashboard/demo",
    "/dashboard/settings",
  ];
  for (const route of dashboardRoutes) {
    const page = await request(route, {}, mgrCookies);
    assert(page.status === 200, `Expected 200 on ${route}, got ${page.status}`);
    assert(!page.text.includes("__next_error__"), `Rendered __next_error__ on ${route}`);
  }
  console.log(`[verify-api] All ${dashboardRoutes.length} /dashboard/* SSR HTML routes verified (200 OK)`);

  const reset = await request(
    "/api/demo/scenario",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario: "reset" }),
    },
    mgrCookies
  );
  assert(reset.status === 200, "Demo reset failed");
  console.log("[verify-api] Scenarios A/B/C, HITL approval, pricing scan, and reset OK");

  console.log("[verify-api] ALL SMOKE CHECKS PASSED.");
}

main().catch((err) => {
  console.error("[verify-api] FAILED:", err);
  process.exit(1);
});

