"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DatabaseState, UserSession } from "@/types/retailens";

export interface SystemModes {
  databaseMode: "supabase" | "simulation";
  authMode: "supabase" | "simulation";
  aiPlannerMode: "gemini" | "deterministic";
  visionMode: "fastapi_opencv" | "simulation";
}

interface StoreContextValue {
  state: DatabaseState | null;
  session: UserSession | null;
  modes: SystemModes | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue>({
  state: null,
  session: null,
  modes: null,
  loading: true,
  error: null,
  refresh: async () => undefined,
});

export function useStoreData() {
  return useContext(StoreContext);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DatabaseState | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [modes, setModes] = useState<SystemModes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/store/state", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setState(data.state);
      setSession(data.session);
      setModes(data.modes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load store data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 20000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <StoreContext.Provider value={{ state, session, modes, loading, error, refresh }}>
      {children}
    </StoreContext.Provider>
  );
}

