import Link from "next/link";
import { notFound } from "next/navigation";
import { IncomeChart } from "@/app/components/IncomeChart";
import { PersonEntryRow } from "@/app/components/PersonEntryRow";
import { getPersonDetail } from "@/lib/data";
import { formatPLN } from "@/lib/format";

export const dynamic = "force-dynamic";

const CARD =
  "rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md";

export default async function PersonDetailPage({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  const detail = await getPersonDetail(personId);
  if (!detail) notFound();

  const { person, records, netTotal, months, avgMonthly } = detail;

  // seria do wykresu: chronologicznie rosnąco
  const asc = [...records].reverse();
  const chartMonths = asc.map((r) => r.month);
  const chartPersons = [{ personId: person.id, name: person.name, colorHex: person.colorHex, net: asc.map((r) => r.totals.net) }];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/income" className="text-xs text-emerald-400 hover:text-emerald-300">
            ← Dochód
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-lg font-bold tracking-tight text-slate-100">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: person.colorHex }} />
            {person.name}
          </h1>
          <p className="text-sm text-slate-500">Przychód, podatki i wydatki — miesięcznie</p>
        </div>
      </header>

      {/* KPI osoby */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Śr. mies. netto" value={formatPLN(avgMonthly)} tone={avgMonthly >= 0 ? "pos" : "neg"} />
        <Kpi label="Łącznie netto" value={formatPLN(netTotal)} tone={netTotal >= 0 ? "pos" : "neg"} />
        <Kpi label="Miesięcy" value={String(months)} />
        <Kpi label="Śr. roc. netto" value={formatPLN(avgMonthly * 12)} tone={avgMonthly >= 0 ? "pos" : "neg"} />
      </div>

      {/* Wykres netto w czasie */}
      <section className={`mb-4 ${CARD}`}>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Dochód netto w czasie</h2>
        <IncomeChart months={chartMonths} persons={chartPersons} />
      </section>

      {/* Tabela per miesiąc */}
      <section className={`mb-4 ${CARD}`}>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Miesięcznie</h2>
        {records.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">Brak wpisów dla tej osoby.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Miesiąc</th>
                  <th className="py-2 pr-3 text-right font-medium">Przychód</th>
                  <th className="py-2 pr-3 text-right font-medium">VAT</th>
                  <th className="py-2 pr-3 text-right font-medium">PIT</th>
                  <th className="py-2 pr-3 text-right font-medium">ZUS</th>
                  <th className="py-2 pr-3 text-right font-medium">Wydatki</th>
                  <th className="py-2 pr-3 text-right font-medium">Netto</th>
                  <th className="py-2 pr-3 text-right font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <PersonEntryRow key={r.id} personId={person.id} record={r} />
                ))}
                <tr className="border-t border-white/10">
                  <td className="py-2 pr-3 font-semibold text-slate-100">Razem</td>
                  <Cell v={records.reduce((s, r) => s + r.income, 0)} strong />
                  <Cell v={records.reduce((s, r) => s + r.vat, 0)} strong />
                  <Cell v={records.reduce((s, r) => s + r.pit, 0)} strong />
                  <Cell v={records.reduce((s, r) => s + r.zus, 0)} strong />
                  <Cell v={records.reduce((s, r) => s + r.totals.totalExpenses, 0)} strong />
                  <td className={`py-2 pr-3 text-right tabular-nums font-bold ${netTotal < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {formatPLN(netTotal)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const c = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-slate-100";
  return (
    <div className={CARD.replace("p-4", "p-3")}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}

function Cell({ v, strong }: { v?: number; strong?: boolean }) {
  return (
    <td className={`py-2 pr-3 text-right tabular-nums ${strong ? "font-semibold text-slate-100" : "text-slate-300"}`}>
      {v == null ? "—" : formatPLN(v)}
    </td>
  );
}
