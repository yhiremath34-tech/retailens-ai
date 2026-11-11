import React from "react";
import { StoreProvider } from "@/components/providers/StoreContext";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <DashboardShell>{children}</DashboardShell>
    </StoreProvider>
  );
}

