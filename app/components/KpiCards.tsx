import { formatPLN, formatPercent } from "@/lib/format";

type Props = {
  total: number;
  deltaMonthPct: number | null;
  assetCount: number;
};

export function KpiCards({ total, deltaMonthPct, assetCount }: Props) {
  const deltaTone =
    deltaMonthPct == null
      ? "text-gray-400"
      : deltaMonthPct >= 0
        ? "text-emerald-600"
        : "text-red-600";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card label="Wartość netto" value={formatPLN(total)} sub="łączna, PLN" />
      <Card
        label="Zmiana (30 dni)"
        value={deltaMonthPct == null ? "—" : formatPercent(deltaMonthPct)}
        sub={deltaMonthPct == null ? "brak danych" : "nominalnie"}
        valueClass={deltaTone}
      />
      <Card label="Aktywa" value={String(assetCount)} sub="pozycji" />
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  valueClass = "",
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</div>
      <div className="text-xs text-gray-400">{sub}</div>
    </div>
  );
}
