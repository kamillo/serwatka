import Link from "next/link";
import { IncomeBreakdownChart } from "../components/IncomeBreakdownChart";
import { IncomeChart } from "../components/IncomeChart";
import { IncomeEntryForm } from "../components/IncomeEntryForm";
import { PeopleManager } from "../components/PeopleManager";
import {
  getIncomeAverages,
  getIncomeRecordByPerson,
  getIncomeSeries,
  getIncomeSeriesByPerson,
  getIncomeYearly,
  getPeople,
  INCOME_RANGE_PRESETS,
  type IncomeRangePreset,
  type IncomeRecordView,
  type PersonView,
} from "@/lib/data";
import { computeTotals } from "@/lib/income";
import { currentMonth, formatMonthPL, formatPercent, formatPLN, monthOffset } from "@/lib/format";

export const dynamic = "force-dynamic";

const CARD =
  "rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; avgRange?: string }>;
}) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const prev = monthOffset(month, -1);
  const next = monthOffset(month, 1);

  const year = Number(month.slice(0, 4));
  const avgRange: IncomeRangePreset =
    sp.avgRange === "3M" || sp.avgRange === "6M" || sp.avgRange === "YTD" || sp.avgRange === "1Y" || sp.avgRange === "MAX"
      ? sp.avgRange
      : "1Y";
  const qs = (m: string) => `?month=${m}${avgRange !== "1Y" ? `&avgRange=${avgRange}` : ""}`;
  const [people, recordByPerson, series, seriesByPerson, yearly, averages] = await Promise.all([
    getPeople(),
    getIncomeRecordByPerson(month),
    getIncomeSeries(),
    getIncomeSeriesByPerson(),
    getIncomeYearly(year),
    getIncomeAverages(avgRange),
  ]);

  // sumy dla miesiąca
  let sumIncome = 0,
    sumVat = 0,
    sumPit = 0,
    sumZus = 0,
    sumExp = 0,
    sumNet = 0;
  for (const p of people) {
    const r = recordByPerson[p.id];
    if (!r) continue;
    const t = computeTotals(r);
    sumIncome += r.income;
    sumVat += r.vat;
    sumPit += r.pit;
    sumZus += r.zus;
    sumExp += t.totalExpenses;
    sumNet += t.net;
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Dochód</h1>
          <p className="text-sm text-slate-500">Przychód, VAT, PIT, ZUS i wydatki — miesięcznie, per osoba</p>
          <Link href="/income/import" className="mt-1 inline-block text-xs text-emerald-400 hover:text-emerald-300">
            ⬆ Import CSV dochodu →
          </Link>
        </div>
        <div className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <Link href={qs(prev)} className="rounded-lg px-2.5 py-1 text-sm text-slate-300 hover:bg-white/5">
            ←
          </Link>
          <span className="px-2 text-sm font-medium capitalize text-slate-100">{formatMonthPL(month)}</span>
          <Link href={qs(next)} className="rounded-lg px-2.5 py-1 text-sm text-slate-300 hover:bg-white/5">
            →
          </Link>
          {month !== currentMonth() && (
            <Link href={qs(currentMonth())} className="ml-1 rounded-lg px-2.5 py-1 text-xs text-emerald-400 hover:bg-white/5">
              dziś
            </Link>
          )}
        </div>
      </header>

      {/* KPI miesiąca */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Przychód (łącznie)" value={formatPLN(sumIncome)} />
        <Kpi label="Potrącenia" value={formatPLN(sumVat + sumPit + sumZus + sumExp)} tone="amber" />
        <Kpi label="Netto (łącznie)" value={formatPLN(sumNet)} tone={sumNet >= 0 ? "pos" : "neg"} />
        <Kpi label="Wpisy" value={`${Object.keys(recordByPerson).length}/${people.length}`} />
      </div>

      {/* Tabela przeglądu miesiąca */}
      <section className={`mb-4 ${CARD}`}>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">
          {formatMonthPL(month)}
        </h2>
        {people.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">Dodaj osobę poniżej, aby zacząć.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Osoba</th>
                  <th className="py-2 pr-3 text-right font-medium">Przychód</th>
                  <th className="py-2 pr-3 text-right font-medium">VAT</th>
                  <th className="py-2 pr-3 text-right font-medium">PIT</th>
                  <th className="py-2 pr-3 text-right font-medium">ZUS</th>
                  <th className="py-2 pr-3 text-right font-medium">Wydatki</th>
                  <th className="py-2 pr-3 text-right font-medium">Netto</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const r = recordByPerson[p.id];
                  const t = r ? computeTotals(r) : null;
                  return (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="py-2 pr-3">
                        <Link href={`/income/${p.id}`} className="flex items-center gap-2 text-slate-200 hover:text-emerald-300">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.colorHex }} />
                          {p.name}
                        </Link>
                      </td>
                      <Cell v={r?.income} />
                      <Cell v={r?.vat} />
                      <Cell v={r?.pit} />
                      <Cell v={r?.zus} />
                      <Cell v={t?.totalExpenses} />
                      <td className={`py-2 pr-3 text-right tabular-nums font-medium ${t && t.net < 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {t ? formatPLN(t.net) : "—"}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-white/10 text-slate-100">
                  <td className="py-2 pr-3 font-semibold">Razem</td>
                  <Cell v={sumIncome} strong />
                  <Cell v={sumVat} strong />
                  <Cell v={sumPit} strong />
                  <Cell v={sumZus} strong />
                  <Cell v={sumExp} strong />
                  <td className={`py-2 pr-3 text-right tabular-nums font-bold ${sumNet < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {formatPLN(sumNet)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Wykres liniowy */}
      <section className={`mb-4 ${CARD}`}>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Dochód netto w czasie (per osoba)</h2>
        <IncomeChart months={seriesByPerson.months} persons={seriesByPerson.persons} />
      </section>

      {/* Rozkład przychodu (stacked bar) */}
      <section className={`mb-4 ${CARD}`}>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">
          Rozkład przychodu (Netto + potrącenia = przychód)
        </h2>
        <IncomeBreakdownChart series={series} />
      </section>

      {/* Średni dochód netto (zakres) */}
      <section className={`mb-4 ${CARD}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-300">Średni dochód netto</h2>
          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {INCOME_RANGE_PRESETS.map((p) => (
              <Link
                key={p.value}
                href={`?month=${month}&avgRange=${p.value}`}
                className={`rounded-md px-3 py-1 text-sm transition ${
                  p.value === avgRange ? "bg-white/10 font-medium text-slate-50" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
        {averages.totalMonths === 0 ? (
          <p className="py-4 text-sm text-slate-500">Brak wpisów w wybranym zakresie.</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              {averages.preset === "MAX"
                ? "Cały okres"
                : averages.fromMonth && averages.toMonth
                ? `${formatMonthPL(averages.fromMonth)} – ${formatMonthPL(averages.toMonth)}`
                : ""}
              {" · "}{averages.distinctMonths} mies. · {averages.persons.length} os.
            </p>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Kpi label="Śr. mies. netto / osoba" value={formatPLN(averages.avgMonthlyPerPerson)} tone={averages.avgMonthlyPerPerson >= 0 ? "pos" : "neg"} />
              <Kpi label="Śr. mies. netto (łącznie)" value={formatPLN(averages.avgMonthlyHousehold)} tone={averages.avgMonthlyHousehold >= 0 ? "pos" : "neg"} />
              <Kpi label="Łącznie netto (zakres)" value={formatPLN(averages.totalNet)} tone={averages.totalNet >= 0 ? "pos" : "neg"} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-medium">Osoba</th>
                    <th className="py-2 pr-3 text-right font-medium">M-cy</th>
                    <th className="py-2 pr-3 text-right font-medium">Śr. mies. netto</th>
                    <th className="py-2 pr-3 text-right font-medium">Łącznie netto</th>
                  </tr>
                </thead>
                <tbody>
                  {averages.persons.map((p) => (
                    <tr key={p.personId} className="border-b border-white/5">
                      <td className="py-2 pr-3">
                        <Link href={`/income/${p.personId}`} className="flex items-center gap-2 text-slate-200 hover:text-emerald-300">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.colorHex }} />
                          {p.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{p.months}</td>
                      <td className={`py-2 pr-3 text-right tabular-nums font-medium ${p.avgMonthly < 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {formatPLN(p.avgMonthly)}
                      </td>
                      <td className={`py-2 pr-3 text-right tabular-nums ${p.net < 0 ? "text-red-400" : "text-slate-300"}`}>
                        {formatPLN(p.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Agregaty roczne */}
      <section className={`mb-4 ${CARD}`}>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Rok {year}</h2>
        {yearly.rows.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">Brak wpisów dochodowych w {year}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Osoba</th>
                  <th className="py-2 pr-3 text-right font-medium">Przychód</th>
                  <th className="py-2 pr-3 text-right font-medium">VAT</th>
                  <th className="py-2 pr-3 text-right font-medium">PIT</th>
                  <th className="py-2 pr-3 text-right font-medium">ZUS</th>
                  <th className="py-2 pr-3 text-right font-medium">Wydatki</th>
                  <th className="py-2 pr-3 text-right font-medium">Netto</th>
                  <th className="py-2 pr-3 text-right font-medium">M-cy</th>
                  <th className="py-2 pr-3 text-right font-medium">Śr. mies.</th>
                  <th className="py-2 pr-3 text-right font-medium">Stopa ef.</th>
                </tr>
              </thead>
              <tbody>
                {yearly.rows.map((r) => (
                  <tr key={r.personId} className="border-b border-white/5">
                    <td className="py-2 pr-3">
                      <Link href={`/income/${r.personId}`} className="flex items-center gap-2 text-slate-200 hover:text-emerald-300">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.colorHex }} />
                        {r.name}
                      </Link>
                    </td>
                    <Cell v={r.income} />
                    <Cell v={r.vat} />
                    <Cell v={r.pit} />
                    <Cell v={r.zus} />
                    <Cell v={r.expenses} />
                    <td className={`py-2 pr-3 text-right tabular-nums font-medium ${r.net < 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {formatPLN(r.net)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{r.months}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-300">
                      {r.months > 0 ? formatPLN(r.net / r.months) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-400">
                      {r.effRate == null ? "—" : formatPercent(r.effRate)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-white/10">
                  <td className="py-2 pr-3 font-semibold text-slate-100">Razem</td>
                  <Cell v={yearly.total.income} strong />
                  <Cell v={yearly.total.vat} strong />
                  <Cell v={yearly.total.pit} strong />
                  <Cell v={yearly.total.zus} strong />
                  <Cell v={yearly.total.expenses} strong />
                  <td className={`py-2 pr-3 text-right tabular-nums font-bold ${yearly.total.net < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {formatPLN(yearly.total.net)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold text-slate-400">{yearly.total.months}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold text-slate-200">
                    {yearly.total.months > 0 ? formatPLN(yearly.total.net / yearly.total.months) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold text-slate-300">
                    {yearly.total.effRate == null ? "—" : formatPercent(yearly.total.effRate)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Wpis + osoby */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className={`lg:col-span-3 ${CARD}`}>
          <h2 className="mb-3 text-sm font-semibold text-slate-300">
            Wpis — {formatMonthPL(month)}
          </h2>
          <IncomeEntryForm key={month} people={people} month={month} recordByPerson={recordByPerson} />
        </section>
        <section className={`lg:col-span-2 ${CARD}`}>
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Osoby</h2>
          <PeopleManager people={people} />
        </section>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "amber";
}) {
  const c = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : tone === "amber" ? "text-amber-400" : "text-slate-100";
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
