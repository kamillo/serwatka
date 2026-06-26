import Link from "next/link";
import { ImportHistory } from "../components/ImportHistory";
import { ImportWizard } from "../components/ImportWizard";
import { getAssetsSnapshot } from "@/lib/data";
import { getImportHistory } from "@/lib/actions/import";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [assets, jobs] = await Promise.all([
    getAssetsSnapshot(),
    getImportHistory(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Import CSV</h1>
          <p className="text-sm text-slate-500">
            Wyciągi bankowe, maklerzy, obligacje → wyceny
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
        >
          ← Dashboard
        </Link>
      </header>

      <ImportWizard assets={assets} />

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md">
        <h2 className="mb-2 text-sm font-semibold text-slate-300">
          Historia importów
        </h2>
        <ImportHistory jobs={jobs} />
      </section>
    </main>
  );
}
