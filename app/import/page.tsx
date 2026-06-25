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
          <h1 className="text-xl font-semibold">Import CSV</h1>
          <p className="text-sm text-gray-500">
            Wyciągi bankowe, maklerzy, obligacje → wyceny
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-neutral-700"
        >
          ← Dashboard
        </Link>
      </header>

      <ImportWizard assets={assets} />

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Historia importów
        </h2>
        <ImportHistory jobs={jobs} />
      </section>
    </main>
  );
}
