# RetaiLens AI — Autonomous Retail Operations & Intelligent Checkout Agent

**Hackathon:** PS-07 – Open Track · **Team:** NEXORA  
**Tagline:** *Your Store. One Autonomous Intelligence.*

RetaiLens AI is an autonomous retail operations platform that unites computer vision shelf/checkout monitoring, POS verification, real-time inventory accounting, expiry-aware dynamic pricing, persistent cross-session operational memory, supplier replenishment drafting, and Human-in-the-Loop (HITL) manager approvals in a unified enterprise command center.

---

## Transparency & Operating Modes

RetaiLens AI never fabricates external connectivity. Every subsystem detects credentials/availability at runtime and displays active runtime badges in the UI and `/api/health`:

| Subsystem | Connected Mode (When Configured) | Built-in Simulation Fallback (Default Out-of-the-Box) |
|---|---|---|
| **Database & Auth** | Supabase PostgreSQL (`001_schema.sql`), Supabase Auth, RLS, Storage | Atomic transactional local JSON store (`.data/retailens-db.json` in dev / `/tmp/retailens-db.json` in prod) + HMAC-SHA256 signed HTTP-only session cookies & `scrypt` password hashes |
| **AI Reasoning & Tools** | Gemini API (`GEMINI_API_KEY`) function calling with server-side Zod validation | Bounded deterministic ReAct planner executing the same 13 server-validated deterministic tools (`PERCEIVE -> REASON -> PLAN -> ACT -> OBSERVE -> REMEMBER`) |
| **Computer Vision** | Python FastAPI (`vision-service/`) OpenCV (+ optional Ultralytics YOLO weights) | Structured CV simulation mode + frame diagnostics with clear `[SIMULATION MODE]` labels |
| **External Integrations** | Custom supplier webhook / storage URLs | Mock supplier dispatch interface + synthetic Store 01 demo catalog (22 SKUs, 5 suppliers) |

---

## Architecture Overview

```
+-------------------------------------------------------------------------+
| Next.js 15 App Router + React 19 + Tailwind CSS v4 (Frontend & API)     |
|  - Landing (/), Architecture (/how-it-works), Auth (/login, /register)  |
|  - Protected Command Center (/dashboard/* — 14 operational workspaces)  |
|  - Route Middleware & Server-Side RBAC (store_owner, store_manager,     |
|    inventory_manager, cashier)                                          |
+-----------------------------+----------------------+--------------------+
                              |                      |
              REST / Tool Calls                Multipart Image / Stream
                              v                      v
+-----------------------------------+   +---------------------------------+
| Autonomous AI Orchestrator        |   | FastAPI CV Microservice         |
|  - PERCEIVE -> REASON -> PLAN     |   | (`vision-service/`)              |
|    -> ACT -> OBSERVE -> REMEMBER  |   |  - OpenCV contour, brightness,  |
|  - 13 Zod-validated deterministic |   |    shelf occupancy & barcode    |
|    tools (no raw LLM SQL access)  |   |    candidate estimation         |
|  - Human-in-the-Loop Safety Gates |   |  - Optional YOLO weights        |
+-----------------------------+-----+   +---------------------------------+
                              |
                              v
+-------------------------------------------------------------------------+
| Persistence Layer (`src/lib/db/repository.ts`)                          |
|  - Supabase PostgreSQL + `mutate_inventory_atomic` RPC + RLS            |
|  - OR Atomic Local JSON Transaction Store (Simulation Mode)             |
+-------------------------------------------------------------------------+
```

---

## Core Safety & Engineering Guarantees

1. **Human-in-the-Loop Approvals:** High-impact operations—supplier PO dispatches, dynamic discounts exceeding store autonomous threshold (`15%`), manual large inventory adjustments (`> 20` units), and checkout dispute overrides—are staged as `pending` in `approval_requests`. Only authenticated `store_owner` or `store_manager` accounts can execute or reject them (enforced server-side in `decideApprovalRequest` and `/api/approvals/[id]/decide`).
2. **Low-Confidence Mutation Block:** When checkout visual confidence is below `80%`, `mutate_pos_inventory_db` automatically refuses stock deduction (`status: "blocked"`), preserves database inventory, and routes the event to checkout dispute escalation.
3. **Minimum Margin Protection:** `calculate_dynamic_expiry_discount` enforces `recommendedPrice >= costPrice * (1 + minMarginPct / 100)` across all expiry tiers.
4. **Transactional & Idempotent Stock Ledger:** `mutate_inventory_atomic` (PostgreSQL RPC) and `applyAtomicInventoryDeltaInMemory` guarantee atomic stock updates, reject negative stock oversells, and deduplicate replays via `idempotencyKey`.

---

## 13 Deterministic Agent Tools (`src/lib/agent/tools.ts`)

1. `analyze_checkout_and_shelf_feed` — Inspects CV shelf occupancy, confidence, and POS barcode alignment.
2. `get_inventory_status` — Reads stock quantities, thresholds, expiry days remaining, and supplier mappings.
3. `get_product_history` — Retrieves historical inventory movements and vision events for a SKU.
4. `retrieve_agent_memory` — Queries persistent cross-session operational memories (`agent_memory`).
5. `save_agent_memory` — Stores structured insights (`inventory`, `supplier`, `checkout`, `pricing`, `operational`).
6. `detect_stock_depletion_velocity` — Computes daily burn rate, days-of-cover vs supplier lead time, and safety reorder qty.
7. `get_supplier_lead_times` — Reads supplier fulfillment rates, MOQs, and delivery lead times.
8. `mutate_pos_inventory_db` — Executes idempotent transactional inventory deductions (blocked at `<80%` confidence).
9. `calculate_dynamic_expiry_discount` — Computes expiry-aware discounts bounded by `minMarginPct` rules.
10. `dispatch_supplier_purchase_order` — Drafts replenishment POs and routes dispatch through Manager Approval Center.
11. `create_checkout_dispute` — Logs POS/camera anomaly sessions and escalation approval requests.
12. `generate_store_operational_report` — Produces store-wide SKU health, risk value, and approval summary.
13. `request_human_approval` — Explicitly queues arbitrary operational exceptions for human sign-off.

---

## Local Setup & Installation

### 1. Prerequisites
- Node.js `>= 20` (tested on `v22.23.2`)
- npm `>= 10`
- Python `>= 3.10` (optional — required only for the standalone FastAPI OpenCV microservice)

### 2. Install Frontend & Next.js Backend

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without any external env vars set, the app automatically runs in clearly labelled **Simulation Mode** with seeded Store 01 retail data.

### 3. Optional: Python Computer Vision Microservice (`vision-service/`)

```bash
cd vision-service
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
# source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Ensure `VISION_SERVICE_URL=http://127.0.0.1:8000` is set in `.env.local`. Next.js `/api/vision/analyze` and `/api/health` will automatically detect and route real uploaded image frames through FastAPI + OpenCV!

### 4. Optional: Connected Supabase PostgreSQL & Auth

1. Create a Supabase project and open the SQL Editor.
2. Run [`supabase/migrations/001_schema.sql`](./supabase/migrations/001_schema.sql) to create all 22 tables, indexes, RLS policies, and the `mutate_inventory_atomic` stored procedure.
3. Run [`supabase/seed.sql`](./supabase/seed.sql) to load Store 01 synthetic catalog, suppliers, movements, memories, and pending approvals.
4. Create users in Supabase Auth and map their UUIDs in the `profiles` table with one of `store_owner`, `store_manager`, `inventory_manager`, or `cashier`.
5. Populate `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

---

## Demo Accounts & Hackathon Walkthrough (`/login`, `/dashboard/demo`)

In Simulation Mode, the login page provides quick one-click demo fill buttons (`demo1234` password for all seeded roles):

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Store Owner** | `owner@retailens.demo` | `demo1234` | Full access including approvals, PO dispatch, settings, delete |
| **Store Manager** | `manager@retailens.demo` | `demo1234` | Full operations + Manager Approval Center + PO dispatch |
| **Inventory Manager** | `inventory@retailens.demo` | `demo1234` | Inventory CRUD, pricing scan, draft POs (`cannot` self-approve) |
| **Cashier** | `cashier@retailens.demo` | `demo1234` | Checkout lane simulation & store view (`403` on admin/inventory edits/approvals) |

### Hackathon Demo Scenarios (`/dashboard/demo` & `/api/demo/scenario`)
- **Scenario A — Frictionless Checkout:** `CAM-CHK-01` detects `Monsoon Reserve Coffee (SKU-COF-001)` at `97.8%` confidence, matches POS barcode `8901425001011`, and autonomously deducts stock via idempotent ledger transaction.
- **Scenario B — Shelf Stockout -> PO Draft -> Human Approval:** `CAM-04` detects `Cold Pressed Olive Oil (SKU-OLV-088)` at low shelf occupancy; agent queries depletion velocity + lead time, drafts supplier PO, logs persistent memory, and pauses in **Approval Center** (`/dashboard/approvals`) for Manager authorization.
- **Scenario C — Checkout Barcode Anomaly & Safety Halt:** `CAM-CHK-02` detects `Clover Greek Yogurt (SKU-YOG-006)` at low confidence (`62.5%`) mismatched against scanned milk barcode; safety boundary blocks inventory deduction and escalates a checkout dispute ticket.

---

## API Reference (Next.js App Router)

All protected routes verify the signed session cookie (`retailens_session`) or Supabase Auth JWT and enforce RBAC role checks server-side:

- `GET /api/health` — Returns service readiness and runtime mode flags (`databaseMode`, `authMode`, `aiPlannerMode`, `visionMode`).
- `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`, `POST /api/auth/forgot-password`, `GET /api/auth/session` — Authentication lifecycle.
- `GET /api/store/state` — Full hydrated store command-center snapshot (requires `view_dashboard`).
- `GET/POST /api/inventory` & `PATCH/DELETE /api/inventory/[id]` — Inventory CRUD + atomic stock delta logging.
- `POST /api/vision/analyze` — Frame inspection (multipart JPEG/PNG/WebP upload -> FastAPI OpenCV or simulation fallback).
- `POST /api/checkout` — POS + vision verification checkout endpoint with automatic anomaly detection and GST invoice computation.
- `POST /api/agent/run` — Executes ReAct autonomous agent workflow for an operational objective.
- `GET/POST /api/memory` — Lists and creates persistent `agent_memory` entries.
- `POST /api/pricing` — Scans expiring inventory (`action: "scan"`) and applies/queues margin-safe dynamic discounts (`action: "apply"`).
- `POST /api/purchase-orders` — Drafts a replenishment Purchase Order and creates a manager approval request.
- `POST /api/approvals/[id]/decide` — Executes (`approved`), rejects (`rejected`), or requests revisions (`changes_requested`) on a pending HITL request (strictly `store_owner` / `store_manager` only).
- `PATCH /api/settings` — Updates store configuration & pricing margin rules (`store_owner` / `store_manager`).
- `POST /api/demo/scenario` — Runs `frictionless_checkout`, `shelf_stockout`, `checkout_anomaly`, or `reset`.
- `GET /api/product-badge?sku=...&name=...` — Serves dynamic SVG shelf/product thumbnails.

---

## Verification Commands

```bash
npm run typecheck   # TypeScript strict check (tsc --noEmit)
npm run lint        # ESLint Next.js Core Web Vitals + TypeScript check
npm test            # Vitest automated unit & integration tests (tests/retailens.test.ts)
npm run build       # Production Next.js build verification
npm run start       # Run production server locally
node scripts/verify-api.mjs --base-url http://127.0.0.1:3000  # End-to-end API & RBAC smoke test
```

---

## Deployment Guide

1. **GitHub:** Push repository to GitHub (`git init && git add . && git commit -m "feat: RetaiLens AI initial platform"`).
2. **Supabase:** Provision Supabase project, run `001_schema.sql` & `seed.sql`, and configure Google OAuth redirect URLs if `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`.
3. **Python FastAPI CV Service:** Deploy `vision-service/` as a container/web service on Render, Railway, or Google Cloud Run (`uvicorn main:app --host 0.0.0.0 --port $PORT`).
4. **Vercel (Next.js App):** Connect the GitHub repository in Vercel, add environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `VISION_SERVICE_URL`, `RETAILENS_AUTH_SECRET`), and deploy.

