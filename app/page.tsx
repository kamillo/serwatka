import { AddAssetForm } from "./components/AddAssetForm";
import { AddEntryForm } from "./components/AddEntryForm";
import { AssetTable } from "./components/AssetTable";
import { CategoryDonut } from "./components/CategoryDonut";
import { CategoryStackedChart } from "./components/CategoryStackedChart";
import { KpiCards } from "./components/KpiCards";
import { NetWorthChart } from "./components/NetWorthChart";
import { RangeSelector } from "./components/RangeSelector";
import {
  RANGE_PRESETS,
  getAssetsSnapshot,
  getCategories,
  getInflationSeries,
  getNetWorthSeries,
  type RangePreset,
} from "@/lib/data";
import { valueAtOffset } from "@/lib/lkv";

export const dynamic = "force-dynamic";

const CARD =
  "rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md";

function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${CARD} ${className}`}>
      {title && (
        <h2 className="mb-3 text-sm font-semibold text-slate-300">{title}</h2>
      )}
      {children}
    </section>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const preset: RangePreset = RANGE_PRESETS.some((p) => p.value === sp.range)
    ? (sp.range as RangePreset)
    : "MAX";

  const [series, assets, categories, inflation] = await Promise.all([
    getNetWorthSeries(preset),
    getAssetsSnapshot(),
    getCategories(),
    getInflationSeries(),
  ]);

  const last = series[series.length - 1];
  const total = last?.total ?? 0;
  const monthAgo = valueAtOffset(series, 30);
  const deltaMonthPct =
    total > 0 && monthAgo != null && monthAgo > 0
      ? ((total - monthAgo) / monthAgo) * 100
      : null;
  const activeCount = assets.filter((a) => a.isActive).length;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">
            Wartość netto
          </h1>
          <p className="text-sm text-slate-500">
            Struktura aktywów i realna zmiana w czasie
          </p>
        </div>
        <RangeSelector current={preset} />
      </header>

      <div className="mb-4">
        <KpiCards total={total} deltaMonthPct={deltaMonthPct} assetCount={activeCount} />
      </div>

      <Card title="Wartość netto w czasie" className="mb-4">
        <NetWorthChart series={series} inflation={inflation} />
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Podział aktywów (teraz)">
          <CategoryDonut assets={assets} />
        </Card>
        <Card title="Kompozycja w czasie">
          <CategoryStackedChart series={series} categories={categories} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card title="Dodaj wycenę" className="lg:col-span-2">
          <AddEntryForm assets={assets} />
        </Card>
        <Card title="Aktywa" className="lg:col-span-3">
          <AssetTable assets={assets} />
        </Card>
      </div>

      <details className={`mt-4 ${CARD}`}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">
          + Dodaj nowe aktywo
        </summary>
        <div className="mt-3">
          <AddAssetForm categories={categories} />
        </div>
      </details>
    </main>
  );
}
