import Link from "next/link";
import { CompareChart } from "../components/CompareChart";
import { getCompareAssets } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const assets = await getCompareAssets();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Porównanie aktywów</h1>
          <p className="text-sm text-slate-500">
            Znormalizowane do 100 przy pierwszej wycenie — względna wydajność w czasie
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
        >
          ← Dashboard
        </Link>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md">
        <CompareChart assets={assets} />
      </section>
    </main>
  );
}
