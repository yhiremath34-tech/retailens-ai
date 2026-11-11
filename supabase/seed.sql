-- ==============================================================================
-- RetaiLens AI — Synthetic Retail Seed Data (Retail Demo Market - Store 01)
-- NOTE: All records seeded here are explicitly marked as synthetic demo data.
-- ==============================================================================

INSERT INTO public.stores (id, code, name, location, timezone, gst_rate_pct, operational_status, is_demo_synthetic)
VALUES (
  '11111111-1111-4111-8111-111111111101',
  'STORE-01',
  'Retail Demo Market – Store 01',
  'Bengaluru Indiranagar Flagship (Synthetic Demo)',
  'Asia/Kolkata',
  18.00,
  'active',
  TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pricing_rules (id, store_id, min_margin_pct, auto_approve_max_discount_pct, expiry_alert_window_days, po_auto_approve_limit, inventory_adjust_approval_threshold)
VALUES (
  '90909090-9090-4909-8909-909090909001',
  '11111111-1111-4111-8111-111111111101',
  10.00, 15.00, 10, 5000.00, 10
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.suppliers (id, store_id, name, contact_name, contact_email, contact_phone, avg_lead_time_days, min_order_quantity, fulfillment_rate_pct, status, is_synthetic)
VALUES
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101', 'Nilgiri Estate Roasters & Tea Co.', 'Aarav Menon', 'orders@nilgiriroasters.example', '+91-98450-11220', 3, 20, 98.40, 'active', TRUE),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111101', 'Sahyadri Valley Dairy Collective', 'Priya Kulkarni', 'dispatch@sahyadridairy.example', '+91-98201-44310', 1, 24, 96.80, 'active', TRUE),
  ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111101', 'Verona & Deccan Gourmet Imports', 'Rohan Deshmukh', 'supply@deccangourmet.example', '+91-99002-77891', 4, 15, 94.20, 'active', TRUE),
  ('22222222-2222-4222-8222-222222222204', '11111111-1111-4111-8111-111111111101', 'MilletCraft Wholefoods Pvt Ltd', 'Neha Krishnan', 'fulfillment@milletcraft.example', '+91-98860-55109', 2, 30, 97.50, 'active', TRUE),
  ('22222222-2222-4222-8222-222222222205', '11111111-1111-4111-8111-111111111101', 'FreshHarvest Cold-Chain Logistics', 'Vikram Sethi', 'ops@freshharvest.example', '+91-98111-33490', 2, 18, 92.60, 'active', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (id, store_id, sku, name, barcode, category, selling_price, cost_price, aisle_location, batch_number, expiry_date, primary_supplier_id, is_synthetic)
VALUES
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111101', 'SKU-COF-001', 'Monsoon Reserve Coffee', '8901425001011', 'Beverages', 540.00, 360.00, 'Aisle 1 - Coffee & Tea', 'MRC-26-A1', CURRENT_DATE + 180, '22222222-2222-4222-8222-222222222201', TRUE),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111101', 'SKU-MLK-002', 'Hill Farm Whole Milk', '8901425001028', 'Dairy', 85.00, 58.00, 'Aisle 3 - Chilled Dairy', 'HFM-26-D4', CURRENT_DATE + 2, '22222222-2222-4222-8222-222222222202', TRUE),
  ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111101', 'SKU-OLV-088', 'Cold Pressed Olive Oil', '8901425001088', 'Gourmet Pantry', 920.00, 640.00, 'Aisle 4 - Oils & Condiments', 'CPO-26-G8', CURRENT_DATE + 240, '22222222-2222-4222-8222-222222222203', TRUE),
  ('33333333-3333-4333-8333-333333333304', '11111111-1111-4111-8111-111111111101', 'SKU-SNK-004', 'Millet & Sea Salt Bites', '8901425001042', 'Healthy Snacks', 145.00, 92.00, 'Aisle 2 - Artisanal Snacks', 'MSB-26-S2', CURRENT_DATE + 75, '22222222-2222-4222-8222-222222222204', TRUE),
  ('33333333-3333-4333-8333-333333333305', '11111111-1111-4111-8111-111111111101', 'SKU-TEA-005', 'Wild Citrus Green Tea', '8901425001059', 'Beverages', 295.00, 185.00, 'Aisle 1 - Coffee & Tea', 'WGT-26-T5', CURRENT_DATE + 145, '22222222-2222-4222-8222-222222222201', TRUE),
  ('33333333-3333-4333-8333-333333333306', '11111111-1111-4111-8111-111111111101', 'SKU-YOG-006', 'Clover Greek Yogurt', '8901425001066', 'Dairy', 160.00, 105.00, 'Aisle 3 - Chilled Dairy', 'CGY-26-D9', CURRENT_DATE + 3, '22222222-2222-4222-8222-222222222202', TRUE),
  ('33333333-3333-4333-8333-333333333307', '11111111-1111-4111-8111-111111111101', 'SKU-BAK-007', 'Sourdough Country Loaf', '8901425001073', 'Bakery', 180.00, 110.00, 'Aisle 5 - Fresh Bakery', 'SCL-26-B1', CURRENT_DATE + 1, '22222222-2222-4222-8222-222222222205', TRUE),
  ('33333333-3333-4333-8333-333333333308', '11111111-1111-4111-8111-111111111101', 'SKU-HON-008', 'Forest Multiflora Raw Honey', '8901425001080', 'Gourmet Pantry', 460.00, 310.00, 'Aisle 4 - Oils & Condiments', 'FMH-26-P3', CURRENT_DATE + 320, '22222222-2222-4222-8222-222222222203', TRUE),
  ('33333333-3333-4333-8333-333333333309', '11111111-1111-4111-8111-111111111101', 'SKU-ALM-009', 'Unsweetened Almond Milk', '8901425001097', 'Beverages', 265.00, 175.00, 'Aisle 3 - Chilled Dairy', 'UAM-26-C2', CURRENT_DATE + 45, '22222222-2222-4222-8222-222222222202', TRUE),
  ('33333333-3333-4333-8333-333333333310', '11111111-1111-4111-8111-111111111101', 'SKU-CHZ-010', 'Aged Cheddar Block 200g', '8901425001103', 'Dairy', 340.00, 230.00, 'Aisle 3 - Chilled Dairy', 'ACB-26-D7', CURRENT_DATE + 5, '22222222-2222-4222-8222-222222222202', TRUE),
  ('33333333-3333-4333-8333-333333333311', '11111111-1111-4111-8111-111111111101', 'SKU-PAS-011', 'Artisanal Bronze-Die Fusilli', '8901425001110', 'Gourmet Pantry', 240.00, 155.00, 'Aisle 4 - Oils & Condiments', 'ABF-26-G2', CURRENT_DATE + 290, '22222222-2222-4222-8222-222222222203', TRUE),
  ('33333333-3333-4333-8333-333333333312', '11111111-1111-4111-8111-111111111101', 'SKU-GRN-012', 'Roasted Quinoa Crunch', '8901425001127', 'Healthy Snacks', 195.00, 128.00, 'Aisle 2 - Artisanal Snacks', 'RQC-26-S5', CURRENT_DATE + 95, '22222222-2222-4222-8222-222222222204', TRUE),
  ('33333333-3333-4333-8333-333333333313', '11111111-1111-4111-8111-111111111101', 'SKU-JCE-013', 'Cold-Pressed Valencia Orange Juice', '8901425001134', 'Beverages', 150.00, 95.00, 'Aisle 3 - Chilled Dairy', 'VOJ-26-F3', CURRENT_DATE + 4, '22222222-2222-4222-8222-222222222205', TRUE),
  ('33333333-3333-4333-8333-333333333314', '11111111-1111-4111-8111-111111111101', 'SKU-BAR-014', 'Dark Cacao & Almond Protein Bar', '8901425001141', 'Healthy Snacks', 110.00, 68.00, 'Aisle 2 - Artisanal Snacks', 'DCP-26-S8', CURRENT_DATE + 120, '22222222-2222-4222-8222-222222222204', TRUE),
  ('33333333-3333-4333-8333-333333333315', '11111111-1111-4111-8111-111111111101', 'SKU-SAU-015', 'Sun-Dried Tomato Pesto', '8901425001158', 'Gourmet Pantry', 380.00, 250.00, 'Aisle 4 - Oils & Condiments', 'STP-26-G4', CURRENT_DATE + 60, '22222222-2222-4222-8222-222222222203', TRUE),
  ('33333333-3333-4333-8333-333333333316', '11111111-1111-4111-8111-111111111101', 'SKU-OAT-016', 'Steel-Cut Himalayan Oats', '8901425001165', 'Breakfast & Grains', 220.00, 140.00, 'Aisle 2 - Artisanal Snacks', 'SHO-26-M1', CURRENT_DATE + 210, '22222222-2222-4222-8222-222222222204', TRUE),
  ('33333333-3333-4333-8333-333333333317', '11111111-1111-4111-8111-111111111101', 'SKU-BTR-017', 'Cultured Grass-Fed Butter', '8901425001172', 'Dairy', 290.00, 195.00, 'Aisle 3 - Chilled Dairy', 'CGB-26-D6', CURRENT_DATE + 14, '22222222-2222-4222-8222-222222222202', TRUE),
  ('33333333-3333-4333-8333-333333333318', '11111111-1111-4111-8111-111111111101', 'SKU-KOM-018', 'Ginger Turmeric Kombucha', '8901425001189', 'Beverages', 175.00, 112.00, 'Aisle 1 - Coffee & Tea', 'GTK-26-B7', CURRENT_DATE + 9, '22222222-2222-4222-8222-222222222205', TRUE),
  ('33333333-3333-4333-8333-333333333319', '11111111-1111-4111-8111-111111111101', 'SKU-MUF-019', 'Blueberry Oat Muffin Pack', '8901425001196', 'Bakery', 165.00, 98.00, 'Aisle 5 - Fresh Bakery', 'BOM-26-B3', CURRENT_DATE + 2, '22222222-2222-4222-8222-222222222205', TRUE),
  ('33333333-3333-4333-8333-333333333320', '11111111-1111-4111-8111-111111111101', 'SKU-MATCHA-020', 'Ceremonial Grade Matcha Tin', '8901425001202', 'Beverages', 780.00, 520.00, 'Aisle 1 - Coffee & Tea', 'CMT-26-T2', CURRENT_DATE + 270, '22222222-2222-4222-8222-222222222201', TRUE),
  ('33333333-3333-4333-8333-333333333321', '11111111-1111-4111-8111-111111111101', 'SKU-TRFL-021', 'Black Truffle Sea Salt', '8901425001219', 'Gourmet Pantry', 610.00, 410.00, 'Aisle 4 - Oils & Condiments', 'BTS-26-G9', CURRENT_DATE + 365, '22222222-2222-4222-8222-222222222203', TRUE),
  ('33333333-3333-4333-8333-333333333322', '11111111-1111-4111-8111-111111111101', 'SKU-SAL-022', 'Hydroponic Baby Spinach 200g', '8901425001226', 'Fresh Produce', 95.00, 58.00, 'Aisle 5 - Fresh Produce', 'HBS-26-F9', CURRENT_DATE + 2, '22222222-2222-4222-8222-222222222205', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.inventory (store_id, product_id, available_quantity, min_stock_threshold, max_stock_threshold)
VALUES
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333301', 34, 12, 80),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333302', 18, 15, 70),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333303', 4, 12, 48),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333304', 42, 15, 90),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333305', 29, 10, 60),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333306', 22, 10, 50),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333307', 11, 8, 30),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333308', 19, 8, 45),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333309', 6, 10, 48),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333310', 14, 8, 40),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333311', 28, 10, 60),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333312', 0, 12, 50),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333313', 16, 12, 45),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333314', 55, 20, 120),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333315', 9, 10, 35),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333316', 31, 12, 70),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333317', 21, 10, 50),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333318', 19, 12, 55),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333319', 8, 10, 30),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333320', 14, 6, 30),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333321', 12, 5, 25),
  ('11111111-1111-4111-8111-111111111101', '33333333-3333-4333-8333-333333333322', 13, 10, 36)
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO public.agent_memory (id, store_id, category, sku, title, content, relevance_score, influence_note)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', '11111111-1111-4111-8111-111111111101', 'inventory', 'SKU-OLV-088', 'Evening Gourmet Pantry Surge Pattern', 'Cold Pressed Olive Oil experiences 2.4x higher depletion between 17:30 and 20:30 on weekdays; stock below 10 units triggers stockout before next-day delivery.', 0.96, 'Triggered proactive reorder quantity of 36 units instead of minimum 15 MOQ.'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', '11111111-1111-4111-8111-111111111101', 'supplier', 'SKU-OLV-088', 'Verona & Deccan Lead-Time Drift', 'Verona & Deccan Gourmet Imports averaged 4.2 days delivery on recent gourmet oil orders (nominal SLA: 4 days), requiring a 5-day safety buffer.', 0.91, 'Added +1 day safety buffer in dispatch_supplier_purchase_order calculation.'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', '11111111-1111-4111-8111-111111111101', 'checkout', 'SKU-YOG-006', 'Chilled Cup Glare & Barcode Misread', 'Condensation on Clover Greek Yogurt & Hill Farm Milk lids under Lane 02 lighting produced 3 low-confidence visual classifications over the past 14 days.', 0.89, 'Agent automatically halts inventory mutation below 80% confidence on chilled dairy.'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04', '11111111-1111-4111-8111-111111111101', 'pricing', 'SKU-MLK-002', '48-Hour Dairy Markdown Conversion', 'A 22% dynamic expiry markdown applied 48 hours before expiration cleared 91% of remaining Hill Farm Whole Milk units while preserving 14% gross margin.', 0.94, 'Used as historical elasticity baseline in calculate_dynamic_expiry_discount.'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05', '11111111-1111-4111-8111-111111111101', 'operational', 'SKU-COF-001', 'Manager Approval Threshold Preference', 'Store Manager Ananya Sharma approved PO-2026-1038 within 8 minutes when reorder rationale included daily depletion velocity and supplier fulfillment rate.', 0.87, 'Structured approval payloads now attach velocity metrics and supplier reliability evidence.')
ON CONFLICT (id) DO NOTHING;

