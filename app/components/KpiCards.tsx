import { formatPLN, formatPercent } from "@/lib/format";

type Props = {
  total: number;
  deltaMonthPct: number | null;
  assetCount: number;
};

export function KpiCards({ total, deltaMonthPct, assetCount }: Props) {
  const deltaTone =
    deltaMonthPct == null
      ? "text-slate-400"
      : deltaMonthPct >= 0
        ? "text-emerald-400"
        : "text-red-400";

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
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold text-slate-50 ${valueClass}`}>{value}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}
