import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, setAuthToken } from "../api/client";
import type { TokenOut } from "../types";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const { token } = await apiFetch<TokenOut>("/api/auth/session", { method: "POST", json: { email } });
      setAuthToken(token);
      navigate("/", { replace: true });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Login failed");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600">Enter your email (mock auth, no password).</p>
      <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
        <input
          data-testid="login-email"
          type="email"
          required
          className="rounded border border-slate-300 px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          data-testid="login-submit"
          type="submit"
          className="rounded bg-slate-900 py-2 text-sm font-medium text-white"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
