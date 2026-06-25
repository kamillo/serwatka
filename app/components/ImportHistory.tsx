"use client";

import { useTransition } from "react";
import { undoImport, type ImportJobView } from "@/lib/actions/import";
import { formatDate } from "@/lib/format";

export function ImportHistory({ jobs }: { jobs: ImportJobView[] }) {
  const [pending, startTransition] = useTransition();

  if (jobs.length === 0) {
    return <p className="py-4 text-sm text-gray-400">Brak importów.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-neutral-800/60">
      {jobs.map((j) => (
        <li key={j.id} className="flex items-center justify-between py-2">
          <div>
            <div className="text-sm font-medium">{j.filename}</div>
            <div className="text-xs text-gray-400">
              {j.sourceType} · {formatDate(j.createdAt)} · {j.rowsImported} wycen
              {j.rowsSkipped > 0 && ` · ${j.rowsSkipped} pominięto`}
            </div>
          </div>
          <button
            disabled={pending}
            onClick={() => {
              if (
                confirm(
                  `Cofnąć import „${j.filename}"? Usunie ${j.rowsImported} wycen powiązanych z tym importem.`
                )
              ) {
                startTransition(() => {
                  void undoImport(j.id);
                });
              }
            }}
            className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900"
          >
            Cofnij
          </button>
        </li>
      ))}
    </ul>
  );
}
