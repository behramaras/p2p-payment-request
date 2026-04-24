import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api/client";
import type { UserOut } from "./types";

const AuthContext = createContext<UserOut | null>(null);

export function useAuthUser() {
  return useContext(AuthContext);
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    apiFetch<UserOut>("/api/me")
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) navigate("/login", { replace: true });
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!ready) {
    return <div className="p-6 text-center text-slate-600">Loading…</div>;
  }
  if (!user) return null;
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
