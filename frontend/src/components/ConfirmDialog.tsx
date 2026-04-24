import type { ReactNode } from "react";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1 text-sm"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-50"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
