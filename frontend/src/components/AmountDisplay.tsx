const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Displays integer cents as USD without floating the stored value. */
export function AmountDisplay({ cents }: { cents: number }) {
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  const text = fmt.format(dollars + remainder / 100);
  return <span className="tabular-nums">{text}</span>;
}
