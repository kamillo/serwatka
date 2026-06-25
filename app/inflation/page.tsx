import Link from "next/link";
import { InflationForm } from "../components/InflationForm";
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
          <h1 className="text-xl font-semibold">Inflacja (CPI)</h1>
          <p className="text-sm text-gray-500">
            Skumulowany index od miesiąca bazowego · deflacja wartości do realnej siły nabywczej
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-neutral-700"
        >
          ← Dashboard
        </Link>
      </header>

      <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Ustaw wskaźnik miesięczny
          </h2>
          {latest && (
            <span className="text-xs text-gray-400">
              skumulowana ({latest.month}): <b>{(latest.cumulativeIndex * 100).toFixed(1)}%</b>
            </span>
          )}
        </div>
        <InflationForm />
        <p className="mt-2 text-xs text-gray-400">
          Dane startowe są przykładowe (orientacyjne GUS) — podmień na aktualne.
          Edycja miesiąca przelicza wszystkie cumulativeIndex.
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Historia ({points.length} miesięcy)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800">
                <th className="py-2 pr-3 font-medium">Miesiąc</th>
                <th className="py-2 pr-3 text-right font-medium">CPI m/m</th>
                <th className="py-2 pr-3 text-right font-medium">Skumulowany</th>
                <th className="py-2 font-medium">Źródło</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.month} className="border-b border-gray-100 dark:border-neutral-800/60">
                  <td className="py-1.5 pr-3">{p.month}</td>
                  <td
                    className={`py-1.5 pr-3 text-right tabular-nums ${
                      p.cpiMonthlyIndex >= 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {(p.cpiMonthlyIndex * 100).toFixed(2)}%
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-gray-500">
                    {(p.cumulativeIndex * 100).toFixed(2)}%
                  </td>
                  <td className="py-1.5 text-xs text-gray-400">{p.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
