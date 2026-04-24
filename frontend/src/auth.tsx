import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch, clearAuthToken } from "./api/client";
import type { UserOut } from "./types";

const AuthContext = createContext<UserOut | null>(null);

export function useAuthUser() {
  return useContext(AuthContext);
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<UserOut>("/api/me")
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) clearAuthToken();
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <div className="p-6 text-center text-slate-600">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
