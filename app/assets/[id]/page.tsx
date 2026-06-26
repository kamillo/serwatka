import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssetDetail, getInflationSeries } from "@/lib/data";
import { computeNominalPerf, realReturn } from "@/lib/perf";
import { computeFifoPerf } from "@/lib/cost-basis";
import { cumulativeForDate } from "@/lib/inflation";
import { formatPLN, formatPercent, todayISO } from "@/lib/format";
import { AddTransactionForm } from "@/app/components/AddTransactionForm";
import { AssetValuationChart } from "@/app/components/AssetValuationChart";
import { TransactionTable } from "@/app/components/TransactionTable";

export const dynamic = "force-dynamic";

export default async function AssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getAssetDetail(id);
  if (!detail) notFound();

  const currentValue = detail.valuations.at(-1)?.value ?? null;
  const perf = computeNominalPerf(detail.transactions, currentValue);

  const inflation = await getInflationSeries();
  const firstTxDate = detail.transactions[0]?.date; // posortowane asc
  const real =
    firstTxDate && perf.invested > 0 && inflation.length > 0
      ? realReturn(
          perf.invested,
          currentValue ?? 0,
          cumulativeForDate(inflation, firstTxDate),
          cumulativeForDate(inflation, todayISO())
        )
      : null;

  const fifo = computeFifoPerf(detail.transactions, currentValue ?? 0);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">
            ← Dashboard
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-lg font-bold tracking-tight text-slate-100">
            {detail.name}
            <span
              className="rounded-full px-2 py-0.5 text-xs text-white"
              style={{ backgroundColor: detail.colorHex }}
            >
              {detail.categoryName}
            </span>
            {!detail.isActive && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                ukryte
              </span>
            )}
          </h1>
        </div>
      </header>

      {/* KPI wydajności */}
      <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">
            Wydajność (nominalna)
          </h2>
          <span className="text-xs text-slate-500">
            real zdeflowany inflacją od pierwszego zakupu
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Metric label="Wkład (net)" value={formatPLN(perf.invested)} />
          <Metric
            label="Wartość teraz"
            value={currentValue == null ? "—" : formatPLN(currentValue)}
          />
          <Metric
            label="Zysk / strata"
            value={formatPLN(perf.gain)}
            tone={perf.gain >= 0 ? "pos" : "neg"}
          />
          <Metric
            label="ROI nominalny"
            value={perf.roiPct == null ? "—" : formatPercent(perf.roiPct)}
            tone={perf.roiPct == null ? undefined : perf.roiPct >= 0 ? "pos" : "neg"}
          />
          <Metric
            label="ROI realny"
            value={real == null ? "—" : formatPercent(real.realRoiPct)}
            tone={real == null ? undefined : real.realRoiPct >= 0 ? "pos" : "neg"}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Wkład = Σ zakupów + opłat − Σ sprzedaży · {detail.transactions.length} transakcji
          {perf.realizedIncome > 0 && ` · ${formatPLN(perf.realizedIncome)} dochodu (dywidendy/odsetki)`}
        </p>
      </section>

      {fifo && (
        <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">
              P&amp;L (FIFO)
            </h2>
            <span className="text-xs text-slate-500">{fifo.remainingQty} szt. w portfelu</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Koszt bieżący (FIFO)" value={formatPLN(fifo.remainingBasis)} />
            <Metric
              label="Zrealizowany P&L"
              value={formatPLN(fifo.realizedGain)}
              tone={fifo.realizedGain >= 0 ? "pos" : "neg"}
            />
            <Metric
              label="Niezrealizowany P&L"
              value={formatPLN(fifo.unrealizedGain)}
              tone={fifo.unrealizedGain >= 0 ? "pos" : "neg"}
            />
            <Metric
              label="ROI (FIFO)"
              value={fifo.roiPct == null ? "—" : formatPercent(fifo.roiPct)}
              tone={fifo.roiPct == null ? undefined : fifo.roiPct >= 0 ? "pos" : "neg"}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            FIFO (pierwsze weszło, pierwsze wyszło) · zysk całkowity {formatPLN(fifo.totalGain)}
            {fifo.income > 0 && ` · ${formatPLN(fifo.income)} dochodu`}
          </p>
        </section>
      )}

      {/* Wykres wycen */}
      <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md">
        <h2 className="mb-2 text-sm font-semibold text-slate-300">
          Wyceny w czasie
        </h2>
        <AssetValuationChart points={detail.valuations} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Transakcje */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md lg:col-span-3">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            Historia transakcji
          </h2>
          <TransactionTable transactions={detail.transactions} />
        </section>

        {/* Dodaj transakcję */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">
            Dodaj transakcję
          </h2>
          <AddTransactionForm assetId={detail.id} />
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const toneClass =
    tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-slate-200";
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
