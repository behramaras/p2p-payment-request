import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "../api/client";
import { FilterBar } from "../components/FilterBar";
import { RequestCard } from "../components/RequestCard";
import { SearchInput } from "../components/SearchInput";
import type { Summary } from "../types";

type Tab = "sent" | "received";

const RECIPIENT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildListUrl(tab: Tab, status: string, q: string): string {
  const base = tab === "sent" ? "/api/payment-requests/sent" : "/api/payment-requests/received";
  const p = new URLSearchParams();
  if (status) p.set("status", status);
  if (q.trim()) p.set("q", q.trim());
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

export function DashboardPage() {
  const [tab, setTab] = useState<Tab>("sent");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [recipient, setRecipient] = useState("");
  /** Dollar amount as typed in the form (e.g. "12.34"). */
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [createdShareUrl, setCreatedShareUrl] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState<"Copy link" | "Copied!">("Copy link");
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function validateRecipientEmail(raw: string): string | null {
    const t = raw.trim();
    if (!t || !RECIPIENT_EMAIL_RE.test(t)) {
      return "Please enter a valid recipient email address";
    }
    return null;
  }

  function validateAmountDollars(raw: string): string | null {
    const t = raw.trim();
    if (!t) return "Enter an amount.";
    if (t.endsWith(".")) return "Complete the amount or remove the trailing decimal (e.g. 10.50).";
    if (!/^\d+(\.\d{1,2})?$/.test(t) && !/^\d+$/.test(t)) {
      return "Use digits only, with at most 2 decimal places (e.g. 10.50).";
    }
    const frac = t.includes(".") ? (t.split(".")[1] ?? "") : "";
    if (frac.length > 2) return "At most 2 decimal places.";
    const n = Number(t);
    if (!Number.isFinite(n)) return "Enter a valid number.";
    if (n < 0.01) return "Amount must be greater than 0.";
    return null;
  }

  function dollarsToCents(dollarsStr: string): number {
    return Math.round(Number(dollarsStr.trim()) * 100);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch<Summary[]>(buildListUrl(tab, status, q));
      setRows(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [tab, status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  async function copyShareLink() {
    if (!createdShareUrl) return;
    try {
      await navigator.clipboard.writeText(createdShareUrl);
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = createdShareUrl;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      } catch {
        return;
      }
    }
    setCopyLabel("Copied!");
    if (copyResetTimerRef.current !== null) {
      clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = setTimeout(() => {
      setCopyLabel("Copy link");
      copyResetTimerRef.current = null;
    }, 2000);
  }

  function getFastApiDetail(body: unknown): unknown {
    if (body && typeof body === "object" && "detail" in body) {
      return (body as { detail: unknown }).detail;
    }
    return body;
  }

  function detailToPlainMessage(detail: unknown): string {
    if (detail == null) return "";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: string }).msg);
          }
          return "";
        })
        .filter(Boolean)
        .join(" ");
    }
    if (typeof detail === "object" && detail !== null && "message" in detail) {
      return String((detail as { message: string }).message);
    }
    return "";
  }

  async function createRequest(e: FormEvent) {
    e.preventDefault();
    setCreatedShareUrl(null);
    setCopyLabel("Copy link");
    if (copyResetTimerRef.current !== null) {
      clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = null;
    }
    setRecipientError(null);
    setAmountError(null);
    setFormError(null);

    const recipientErr = validateRecipientEmail(recipient);
    if (recipientErr) {
      setRecipientError(recipientErr);
      return;
    }

    const amountErr = validateAmountDollars(amount);
    if (amountErr) {
      setAmountError(amountErr);
      return;
    }
    const cents = dollarsToCents(amount);
    if (cents < 1) {
      setAmountError("Amount must be greater than 0.");
      return;
    }
    try {
      const res = await apiFetch<{ id: string; share_url: string }>("/api/payment-requests", {
        method: "POST",
        json: { recipient_email: recipient.trim(), amount_cents: cents, note: note || undefined },
      });
      setRecipient("");
      setAmount("");
      setNote("");
      setRecipientError(null);
      setAmountError(null);
      setFormError(null);

      const sentData = await apiFetch<Summary[]>(buildListUrl("sent", status, q));
      setTab("sent");
      setRows(sentData);
      setCreatedShareUrl(res.share_url);
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        if (e.status === 422) {
          setFormError("Please check all fields and try again");
          return;
        }
        if (e.status === 400) {
          const detail = getFastApiDetail(e.body);
          const combined = `${JSON.stringify(e.body ?? "")} ${detailToPlainMessage(detail)}`.toLowerCase();
          if (combined.includes("self")) {
            setFormError(null);
            setRecipientError("You cannot send a request to yourself");
          } else {
            setRecipientError(null);
            const msg = detailToPlainMessage(detail).trim();
            setFormError(msg || "We couldn’t create this request. Please try again.");
          }
          return;
        }
        setFormError("Something went wrong. Please try again.");
        return;
      }
      setFormError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">New request</h2>
        <form className="mt-3 flex flex-col gap-2" onSubmit={(e) => void createRequest(e)}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Recipient email</span>
            <input
              data-testid="create-recipient"
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                setRecipientError(null);
                setFormError(null);
              }}
            />
          </label>
          {recipientError && <p className="text-sm text-red-600">{recipientError}</p>}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Amount</span>
            <input
              data-testid="create-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountError(null);
                setFormError(null);
              }}
            />
          </label>
          {amountError && <p className="text-sm text-red-600">{amountError}</p>}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Note</span>
            <input
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="Optional"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setFormError(null);
              }}
            />
          </label>
          <button
            data-testid="create-submit"
            type="submit"
            className="rounded bg-slate-900 py-2 text-sm font-medium text-white"
          >
            Create
          </button>
        </form>
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
        {createdShareUrl && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-sm font-medium text-emerald-900">Request created successfully!</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                data-testid="create-share-url"
                readOnly
                className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                value={createdShareUrl}
                aria-label="Share link"
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                data-testid="copy-share-link"
                className="shrink-0 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                onClick={() => void copyShareLink()}
              >
                {copyLabel}
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          className={`px-3 py-2 text-sm font-medium ${tab === "sent" ? "border-b-2 border-slate-900" : "text-slate-600"}`}
          onClick={() => setTab("sent")}
        >
          Sent
        </button>
        <button
          type="button"
          className={`px-3 py-2 text-sm font-medium ${tab === "received" ? "border-b-2 border-slate-900" : "text-slate-600"}`}
          onClick={() => setTab("received")}
        >
          Received
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <FilterBar value={status} onChange={setStatus} />
        <SearchInput
          value={q}
          onChange={setQ}
          label={tab === "sent" ? "Recipient" : "Sender"}
        />
      </div>

      {loading && <p className="text-sm text-slate-600">Loading…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
      {!loading && rows.length === 0 && (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
          No requests match. Try another filter or create one above.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id}>
            <RequestCard row={r} />
          </li>
        ))}
      </ul>
    </div>
  );
}
