"use client";

import { useTransition } from "react";
import { undoImport, type ImportJobView } from "@/lib/actions/import";
import { formatDate } from "@/lib/format";

export function ImportHistory({ jobs }: { jobs: ImportJobView[] }) {
  const [pending, startTransition] = useTransition();

  if (jobs.length === 0) {
    return <p className="py-4 text-sm text-slate-500">Brak importów.</p>;
  }

  return (
    <ul className="divide-y divide-white/5">
      {jobs.map((j) => (
        <li key={j.id} className="flex items-center justify-between py-2">
          <div>
            <div className="text-sm font-medium text-slate-200">{j.filename}</div>
            <div className="text-xs text-slate-500">
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
            className="rounded-lg border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            Cofnij
          </button>
        </li>
      ))}
    </ul>
  );
}
