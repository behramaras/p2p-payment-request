/** Formats remaining seconds as up to two non-zero units (e.g. "6 days 23 hours", "2 hours 14 minutes"). */
export function formatSecondsRemaining(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  if (sec === 0) return "Less than a minute";

  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);

  const parts: string[] = [];
  const push = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  };

  push(days, "day", "days");
  if (parts.length < 2) push(hours, "hour", "hours");
  if (parts.length < 2) push(minutes, "minute", "minutes");

  if (parts.length === 0) {
    const s = Math.max(1, sec % 60);
    return `${s} second${s === 1 ? "" : "s"}`;
  }

  return parts.join(" ");
}
