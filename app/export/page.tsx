import Link from "next/link";
import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const userId = await getCurrentUserId();
  const [assets, valuations, transactions, incomeRecords] = await Promise.all([
    prisma.asset.count({ where: { userId } }),
    prisma.valuation.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId } }),
    prisma.incomeRecord.count({ where: { userId } }),
  ]);

  const btn =
    "inline-flex items-center rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Eksport danych</h1>
          <p className="text-sm text-slate-500">Przenośność + backup — Twoje dane, Twój plik</p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
        >
          ← Dashboard
        </Link>
      </header>

      <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md">
        <div className="mb-3 flex flex-wrap gap-4 text-sm text-slate-500">
          <span><b className="text-slate-200">{assets}</b> aktywów</span>
          <span><b className="text-slate-200">{valuations}</b> wycen</span>
          <span><b className="text-slate-200">{transactions}</b> transakcji</span>
          <span><b className="text-slate-200">{incomeRecords}</b> wpisów dochodowych</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <a className={btn} href="/api/export/json">⬇ Peły backup (JSON)</a>
          <a className={btn} href="/api/export/valuations">⬇ Wyceny (CSV)</a>
          <a className={btn} href="/api/export/transactions">⬇ Transakcje (CSV)</a>
          <a className={btn} href="/api/export/income">⬇ Dochód (CSV)</a>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          CSV z BOM (UTF-8) — otwiera się czysto w polskim Excelu. JSON zawiera wszystko
          (aktywa, wyceny, transakcje, kategorie, historia importów).
        </p>
      </section>
    </main>
  );
}
