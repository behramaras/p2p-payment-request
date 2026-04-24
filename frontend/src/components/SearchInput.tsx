export function SearchInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (q: string) => void;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2">
      <span className="text-slate-600">{label}</span>
      <input
        type="search"
        className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by email…"
      />
    </label>
  );
}
