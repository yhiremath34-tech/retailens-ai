import { UserRole } from "@/types/retailens";

export const ROLE_LABELS: Record<UserRole, string> = {
  store_owner: "Store Owner",
  store_manager: "Store Manager",
  inventory_manager: "Inventory Manager",
  cashier: "Cashier",
};

export type PermissionAction =
  | "view_dashboard"
  | "manage_inventory"
  | "delete_inventory"
  | "process_checkout"
  | "run_agent"
  | "approve_requests"
  | "manage_pricing_rules"
  | "apply_high_impact_price"
  | "create_po"
  | "dispatch_po"
  | "manage_settings"
  | "run_demo";

const ROLE_PERMISSIONS: Record<UserRole, Set<PermissionAction>> = {
  store_owner: new Set([
    "view_dashboard",
    "manage_inventory",
    "delete_inventory",
    "process_checkout",
    "run_agent",
    "approve_requests",
    "manage_pricing_rules",
    "apply_high_impact_price",
    "create_po",
    "dispatch_po",
    "manage_settings",
    "run_demo",
  ]),
  store_manager: new Set([
    "view_dashboard",
    "manage_inventory",
    "delete_inventory",
    "process_checkout",
    "run_agent",
    "approve_requests",
    "manage_pricing_rules",
    "apply_high_impact_price",
    "create_po",
    "dispatch_po",
    "manage_settings",
    "run_demo",
  ]),
  inventory_manager: new Set([
    "view_dashboard",
    "manage_inventory",
    "run_agent",
    "create_po",
    "run_demo",
  ]),
  cashier: new Set([
    "view_dashboard",
    "process_checkout",
    "run_demo",
  ]),
};

export function hasPermission(role: UserRole, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

export function canApproveSensitiveActions(role: UserRole): boolean {
  return hasPermission(role, "approve_requests");
}

