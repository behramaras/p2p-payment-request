import { Link } from "react-router-dom";
import type { Summary } from "../types";
import { AmountDisplay } from "./AmountDisplay";
import { StatusBadge } from "./StatusBadge";

export function RequestCard({ row }: { row: Summary }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-slate-600">{row.counterparty_email}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <AmountDisplay cents={row.amount_cents} />
          <StatusBadge status={row.status} />
        </div>
      </div>
      <Link
        to={`/requests/${row.id}`}
        className="shrink-0 rounded border border-slate-300 px-3 py-1 text-center text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        View
      </Link>
    </article>
  );
}
