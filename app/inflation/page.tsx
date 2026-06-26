import Link from "next/link";
import { InflationForm } from "../components/InflationForm";
import { SyncEurostatButton } from "../components/SyncEurostatButton";
import { getInflationSeries } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function InflationPage() {
  const points = await getInflationSeries();
  const sorted = [...points].sort((a, b) => (a.month < b.month ? 1 : -1)); // najnowsze góra
  const latest = points.at(-1);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Inflacja (CPI)</h1>
          <p className="text-sm text-slate-500">
            Skumulowany index od miesiąca bazowego · deflacja wartości do realnej siły nabywczej
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
        >
          ← Dashboard
        </Link>
      </header>

      <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">
            Ustaw wskaźnik miesięczny
          </h2>
          {latest && (
            <span className="text-xs text-slate-500">
              skumulowana ({latest.month}): <b className="text-slate-200">{(latest.cumulativeIndex * 100).toFixed(1)}%</b>
            </span>
          )}
        </div>
        <InflationForm />
        <p className="mt-2 text-xs text-slate-500">
          Dane startowe są przykładowe (orientacyjne GUS) — podmień na aktualne.
          Edycja miesiąca przelicza wszystkie cumulativeIndex.
        </p>
        <div className="mt-3 border-t border-white/5 pt-3">
          <SyncEurostatButton />
          <p className="mt-1 text-xs text-slate-500">
            Eurostat HICP (Polska, base 2015=100) — prawdziwy miesięczny m/m z kolejnych
            indeksów. Bez klucza API. Zastępuje dane od 2015.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md">
        <h2 className="mb-2 text-sm font-semibold text-slate-300">
          Historia ({points.length} miesięcy)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Miesiąc</th>
                <th className="py-2 pr-3 text-right font-medium">CPI m/m</th>
                <th className="py-2 pr-3 text-right font-medium">Skumulowany</th>
                <th className="py-2 font-medium">Źródło</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.month} className="border-b border-white/5">
                  <td className="py-1.5 pr-3 text-slate-300">{p.month}</td>
                  <td
                    className={`py-1.5 pr-3 text-right tabular-nums ${
                      p.cpiMonthlyIndex >= 0 ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {(p.cpiMonthlyIndex * 100).toFixed(2)}%
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-300">
                    {(p.cumulativeIndex * 100).toFixed(2)}%
                  </td>
                  <td className="py-1.5 text-xs text-slate-500">{p.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
