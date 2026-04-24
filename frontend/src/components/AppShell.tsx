import { Outlet, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";

export function AppShell() {
  const navigate = useNavigate();

  async function logout() {
    await apiFetch("/api/auth/session", { method: "DELETE" });
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <h1 className="text-lg font-semibold">Payment requests</h1>
          <button
            type="button"
            className="text-sm text-slate-700 underline"
            onClick={() => void logout()}
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
