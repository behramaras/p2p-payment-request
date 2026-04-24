const styles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-900",
  declined: "bg-slate-200 text-slate-800",
  expired: "bg-slate-200 text-slate-600",
  cancelled: "bg-slate-200 text-slate-700",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = styles[status] ?? "bg-slate-100 text-slate-800";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}
