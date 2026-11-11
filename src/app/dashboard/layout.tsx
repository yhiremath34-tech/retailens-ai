import React from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { StoreProvider } from "@/components/providers/StoreContext";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <StoreProvider>
      <DashboardShell>{children}</DashboardShell>
    </StoreProvider>
  );
}

