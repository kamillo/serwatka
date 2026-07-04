import Link from "next/link";
import { IncomeImportWizard } from "@/app/components/IncomeImportWizard";
import { getPeople } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function IncomeImportPage() {
  const people = await getPeople();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Import CSV dochodu</h1>
          <p className="text-sm text-slate-500">Miesięczne wpisy z pliku → rekordy dochodowe</p>
        </div>
        <Link
          href="/income"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
        >
          ← Dochód
        </Link>
      </header>

      <IncomeImportWizard existingPeople={people} />
    </main>
  );
}
