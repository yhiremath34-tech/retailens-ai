-- ==============================================================================
-- RetaiLens AI — PostgreSQL Schema Migration (22 Tables + Indexes + RLS + RPC)
-- Autonomous Retail Operations & Intelligent Checkout Agent (Team NEXORA)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. STORES
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  gst_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 18.00 CHECK (gst_rate_pct >= 0 AND gst_rate_pct <= 50),
  operational_status TEXT NOT NULL DEFAULT 'active' CHECK (operational_status IN ('active', 'maintenance', 'closed')),
  is_demo_synthetic BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PROFILES (linked to auth.users when Supabase Auth is active)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('store_owner', 'store_manager', 'inventory_manager', 'cashier')),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  avg_lead_time_days INTEGER NOT NULL DEFAULT 3 CHECK (avg_lead_time_days >= 1),
  min_order_quantity INTEGER NOT NULL DEFAULT 10 CHECK (min_order_quantity >= 1),
  fulfillment_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 96.50 CHECK (fulfillment_rate_pct >= 0 AND fulfillment_rate_pct <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'onboarding')),
  api_endpoint_status TEXT NOT NULL DEFAULT 'mock_interface',
  is_synthetic BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  barcode TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  image_url TEXT,
  selling_price NUMERIC(10,2) NOT NULL CHECK (selling_price >= 0),
  cost_price NUMERIC(10,2) NOT NULL CHECK (cost_price >= 0),
  aisle_location TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  primary_supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  is_synthetic BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. INVENTORY
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  min_stock_threshold INTEGER NOT NULL DEFAULT 12 CHECK (min_stock_threshold >= 0),
  max_stock_threshold INTEGER NOT NULL DEFAULT 100 CHECK (max_stock_threshold >= 1),
  stock_status TEXT GENERATED ALWAYS AS (
    CASE
      WHEN available_quantity <= 0 THEN 'out_of_stock'
      WHEN available_quantity <= min_stock_threshold THEN 'low_stock'
      ELSE 'in_stock'
    END
  ) STORED,
  last_counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. INVENTORY MOVEMENTS
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale_deduction', 'restock', 'adjustment', 'expiry_writeoff', 'return')),
  quantity_delta INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  idempotency_key TEXT UNIQUE,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SUPPLIER PRODUCTS
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_sku TEXT NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0),
  lead_time_days INTEGER NOT NULL DEFAULT 3 CHECK (lead_time_days >= 1),
  moq INTEGER NOT NULL DEFAULT 10 CHECK (moq >= 1),
  UNIQUE (supplier_id, product_id)
);

-- 8. PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'dispatched', 'received', 'rejected', 'cancelled')),
  total_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_value >= 0),
  estimated_lead_time_days INTEGER NOT NULL DEFAULT 3,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  approved_by TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. PURCHASE ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  ordered_quantity INTEGER NOT NULL CHECK (ordered_quantity > 0),
  unit_cost NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0),
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0)
);

-- 10. CHECKOUT SESSIONS
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT NOT NULL UNIQUE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cashier_id TEXT NOT NULL,
  camera_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('active', 'verified', 'paused_review', 'disputed', 'completed', 'cancelled')),
  visual_confidence NUMERIC(5,2) NOT NULL DEFAULT 95.00,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  anomaly_reason TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. CHECKOUT ITEMS
CREATE TABLE IF NOT EXISTS public.checkout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id UUID NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  scanned_barcode TEXT,
  expected_price NUMERIC(10,2) NOT NULL,
  pos_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  visual_confidence NUMERIC(5,2) NOT NULL,
  match_status TEXT NOT NULL CHECK (match_status IN ('matched', 'barcode_mismatch', 'price_discrepancy', 'duplicate_scan', 'missing_scan', 'low_confidence'))
);

-- 12. CHECKOUT DISPUTES
CREATE TABLE IF NOT EXISTS public.checkout_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  checkout_session_id UUID NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  dispute_type TEXT NOT NULL CHECK (dispute_type IN ('barcode_mismatch', 'price_discrepancy', 'duplicate_scan', 'missing_scan', 'low_confidence')),
  description TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending_approval', 'resolved_override', 'resolved_dismissed')),
  resolution_notes TEXT,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. VISION EVENTS
CREATE TABLE IF NOT EXISTS public.vision_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  camera_id TEXT NOT NULL,
  feed_mode TEXT NOT NULL DEFAULT 'demo' CHECK (feed_mode IN ('demo', 'connected', 'upload')),
  event_type TEXT NOT NULL CHECK (event_type IN ('shelf_scan', 'stockout_detected', 'low_stock_detected', 'checkout_scan', 'anomaly_detected')),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sku TEXT,
  category TEXT,
  aisle TEXT,
  confidence_pct NUMERIC(5,2) NOT NULL CHECK (confidence_pct >= 0 AND confidence_pct <= 100),
  shelf_occupancy_pct NUMERIC(5,2),
  bounding_boxes JSONB NOT NULL DEFAULT '[]'::jsonb,
  anomaly_flag BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. AGENT RUNS
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  planner_mode TEXT NOT NULL DEFAULT 'deterministic' CHECK (planner_mode IN ('gemini', 'deterministic')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'awaiting_approval', 'completed', 'failed')),
  reasoning_summary TEXT,
  planned_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 15. AGENT TOOL EXECUTIONS
CREATE TABLE IF NOT EXISTS public.agent_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  input_args JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_status TEXT NOT NULL CHECK (execution_status IN ('validated', 'executed', 'blocked', 'awaiting_approval', 'failed')),
  result JSONB,
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. AGENT MEMORY
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('inventory', 'supplier', 'checkout', 'pricing', 'operational')),
  sku TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  relevance_score NUMERIC(4,2) NOT NULL DEFAULT 0.85 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  influence_note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. APPROVAL REQUESTS
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('supplier_po_dispatch', 'checkout_dispute_override', 'inventory_adjustment', 'high_impact_price_change')),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sku TEXT,
  reference_id TEXT NOT NULL,
  proposed_change TEXT NOT NULL,
  financial_impact NUMERIC(12,2) NOT NULL DEFAULT 0,
  agent_explanation TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. APPROVAL DECISIONS
CREATE TABLE IF NOT EXISTS public.approval_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  decided_by_user_id TEXT NOT NULL,
  decided_by_name TEXT NOT NULL,
  decided_by_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'changes_requested')),
  notes TEXT,
  execution_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. PRICING RULES
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  min_margin_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  auto_approve_max_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  expiry_alert_window_days INTEGER NOT NULL DEFAULT 10,
  po_auto_approve_limit NUMERIC(12,2) NOT NULL DEFAULT 5000.00,
  inventory_adjust_approval_threshold INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. PRICE RECOMMENDATIONS
CREATE TABLE IF NOT EXISTS public.price_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  original_price NUMERIC(10,2) NOT NULL,
  recommended_price NUMERIC(10,2) NOT NULL,
  discount_pct NUMERIC(5,2) NOT NULL,
  expiry_risk TEXT NOT NULL CHECK (expiry_risk IN ('low', 'medium', 'high', 'critical')),
  expected_impact TEXT NOT NULL,
  reason TEXT NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'pending_approval', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  event_category TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'success')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_path TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON public.inventory(stock_status);
CREATE INDEX IF NOT EXISTS idx_movements_product ON public.inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vision_created ON public.vision_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_cat ON public.agent_memory(category, sku);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approval_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- TRANSACTIONAL INVENTORY MUTATION RPC (Idempotent + Atomic)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.mutate_inventory_atomic(
  p_store_id UUID,
  p_product_id UUID,
  p_quantity_delta INTEGER,
  p_movement_type TEXT,
  p_reason TEXT,
  p_reference_type TEXT,
  p_reference_id TEXT,
  p_idempotency_key TEXT,
  p_performed_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing RECORD;
  v_before INTEGER;
  v_after INTEGER;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.inventory_movements WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'idempotent_replay', true,
        'movement_id', v_existing.id,
        'quantity_before', v_existing.quantity_before,
        'quantity_after', v_existing.quantity_after
      );
    END IF;
  END IF;

  SELECT available_quantity INTO v_before
  FROM public.inventory
  WHERE product_id = p_product_id AND store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory record not found for product %', p_product_id;
  END IF;

  v_after := v_before + p_quantity_delta;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient stock: available %, delta %', v_before, p_quantity_delta;
  END IF;

  UPDATE public.inventory
  SET available_quantity = v_after, updated_at = NOW()
  WHERE product_id = p_product_id AND store_id = p_store_id;

  INSERT INTO public.inventory_movements (
    store_id, product_id, movement_type, quantity_delta, quantity_before, quantity_after,
    reason, reference_type, reference_id, idempotency_key, performed_by
  ) VALUES (
    p_store_id, p_product_id, p_movement_type, p_quantity_delta, v_before, v_after,
    p_reason, p_reference_type, p_reference_id, p_idempotency_key, p_performed_by
  );

  RETURN jsonb_build_object(
    'idempotent_replay', false,
    'quantity_before', v_before,
    'quantity_after', v_after
  );
END;
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vision_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to read current user's role safely
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Authenticated store staff can read store operational tables
CREATE POLICY "Staff read stores" ON public.stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.current_user_role() IN ('store_owner', 'store_manager'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Staff read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers edit products" ON public.products FOR ALL TO authenticated
  USING (public.current_user_role() IN ('store_owner', 'store_manager', 'inventory_manager'))
  WITH CHECK (public.current_user_role() IN ('store_owner', 'store_manager', 'inventory_manager'));

CREATE POLICY "Staff read inventory" ON public.inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers edit inventory" ON public.inventory FOR ALL TO authenticated
  USING (public.current_user_role() IN ('store_owner', 'store_manager', 'inventory_manager'))
  WITH CHECK (public.current_user_role() IN ('store_owner', 'store_manager', 'inventory_manager'));

CREATE POLICY "Staff read movements" ON public.inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read supplier_products" ON public.supplier_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read purchase_orders" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read purchase_order_items" ON public.purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read checkout_sessions" ON public.checkout_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read checkout_items" ON public.checkout_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read checkout_disputes" ON public.checkout_disputes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read vision_events" ON public.vision_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read agent_runs" ON public.agent_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read agent_tool_executions" ON public.agent_tool_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read agent_memory" ON public.agent_memory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read approval_requests" ON public.approval_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers decide approvals" ON public.approval_decisions FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('store_owner', 'store_manager'));
CREATE POLICY "Staff read approval_decisions" ON public.approval_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read pricing_rules" ON public.pricing_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/Managers edit pricing_rules" ON public.pricing_rules FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('store_owner', 'store_manager'))
  WITH CHECK (public.current_user_role() IN ('store_owner', 'store_manager'));
CREATE POLICY "Staff read price_recommendations" ON public.price_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read notifications" ON public.notifications FOR SELECT TO authenticated USING (true);

