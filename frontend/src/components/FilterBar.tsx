import type { RequestStatus } from "../types";

const STATUSES: (RequestStatus | "")[] = ["", "pending", "paid", "declined", "expired", "cancelled"];

export function FilterBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (status: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center">
      <span className="text-slate-600">Status</span>
      <select
        className="rounded border border-slate-300 bg-white px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {STATUSES.map((s) => (
          <option key={s || "all"} value={s}>
            {s ? s : "All"}
          </option>
        ))}
      </select>
    </label>
  );
}
