import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuthUser } from "../auth";
import { AmountDisplay } from "../components/AmountDisplay";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { StatusBadge } from "../components/StatusBadge";
import type { Detail } from "../types";
import { formatSecondsRemaining } from "../utils/formatDuration";

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthUser();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const idemRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setErr(null);
    try {
      const d = await apiFetch<Detail>(`/api/payment-requests/${id}`);
      setDetail(d);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user || !id) return null;

  if (err && !detail) {
    return (
      <div className="p-4">
        <p className="text-red-600">{err}</p>
        <button type="button" className="mt-2 text-sm underline" onClick={() => navigate("/")}>
          Back
        </button>
      </div>
    );
  }
  if (!detail) return <p className="p-4 text-slate-600">Loading…</p>;

  const isRecipient = user.email === detail.recipient_email;
  const isSender = user.email === detail.sender_email;
  const pending = detail.status === "pending";
  const canPay = isRecipient && pending;
  const canDecline = isRecipient && pending;
  const canCancel = isSender && pending;

  async function onPayConfirm() {
    if (!id) return;
    idemRef.current ??= crypto.randomUUID();
    const key = idemRef.current;
    setPayLoading(true);
    try {
      await Promise.all([
        apiFetch<Detail>(`/api/payment-requests/${id}/pay`, {
          method: "POST",
          headers: { "Idempotency-Key": key },
        }),
        delay(2300),
      ]);
      setPayOpen(false);
      idemRef.current = null;
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Pay failed");
    } finally {
      setPayLoading(false);
    }
  }

  async function decline() {
    if (!id) return;
    try {
      await apiFetch(`/api/payment-requests/${id}/decline`, { method: "POST" });
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Decline failed");
    }
  }

  async function cancel() {
    if (!id) return;
    try {
      await apiFetch(`/api/payment-requests/${id}/cancel`, { method: "POST" });
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Cancel failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="self-start text-sm text-slate-600 underline" onClick={() => navigate("/")}>
        ← Dashboard
      </button>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <AmountDisplay cents={detail.amount_cents} />
          <StatusBadge status={detail.status} />
        </div>
        {detail.note?.trim() ? (
          <div className="mt-2">
            <p className="text-sm text-slate-500">Note</p>
            <p className="text-sm text-slate-700">{detail.note.trim()}</p>
          </div>
        ) : null}
        <dl className="mt-3 space-y-1 text-sm">
          <div>
            <dt className="text-slate-500">From</dt>
            <dd>{detail.sender_email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">To</dt>
            <dd>{detail.recipient_email}</dd>
          </div>
          {pending && detail.seconds_until_expiry != null && (
            <div>
              <dt className="text-slate-500">Expires in</dt>
              <dd>{formatSecondsRemaining(detail.seconds_until_expiry)}</dd>
            </div>
          )}
        </dl>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          data-testid="pay-btn"
          className="rounded border border-slate-300 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canPay}
          onClick={() => setPayOpen(true)}
        >
          Pay
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canDecline}
          onClick={() => void decline()}
        >
          Decline
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canCancel}
          onClick={() => void cancel()}
        >
          Cancel
        </button>
      </div>

      <ConfirmDialog
        open={payOpen}
        title="Confirm payment"
        confirmLabel="Confirm pay"
        loading={payLoading}
        onCancel={() => {
          if (!payLoading) setPayOpen(false);
        }}
        onConfirm={() => void onPayConfirm()}
      >
        This simulates paying the request (no real money).
      </ConfirmDialog>
    </div>
  );
}
