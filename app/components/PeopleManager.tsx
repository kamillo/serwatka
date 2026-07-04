"use client";

import { useActionState, useTransition } from "react";
import { createPerson, deletePerson } from "@/lib/actions/income";
import { PERSON_COLORS } from "@/lib/income";
import type { ActionResult } from "@/lib/actions/assets";
import type { PersonView } from "@/lib/data";

const FIELD =
  "mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30";

export function PeopleManager({ people }: { people: PersonView[] }) {
  const [pending, startTransition] = useTransition();
  const [state, formAction, adding] = useActionState(
    async (_prev: ActionResult<{ id: string }> | null, fd: FormData) => {
      return createPerson({ name: fd.get("name"), colorHex: fd.get("colorHex") });
    },
    null
  );

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Imię / nazwa</span>
          <input name="name" required maxLength={80} placeholder="np. Kamil" className={`${FIELD} w-40`} />
        </label>
        <div className="block">
          <span className="block text-xs font-medium text-slate-400">Kolor</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {PERSON_COLORS.map((c) => (
              <label key={c} className="block cursor-pointer">
                <input
                  type="radio"
                  name="colorHex"
                  value={c}
                  defaultChecked={c === PERSON_COLORS[0]}
                  className="peer sr-only"
                />
                <span
                  className="block h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-slate-950 ring-transparent transition hover:scale-110 peer-checked:ring-white"
                  style={{ backgroundColor: c }}
                />
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 h-9 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
        >
          {adding ? "…" : "+ Dodaj"}
        </button>
      </form>
      {state && !state.ok && <p className="text-sm text-red-400">{state.error}</p>}

      {people.length > 0 && (
        <ul className="space-y-1">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-slate-200">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.colorHex }} />
                {p.name}
              </span>
              <button
                disabled={pending}
                onClick={() => {
                  if (confirm(`Usunąć osobę „${p.name}" i jej wpisy dochodowe?`)) {
                    startTransition(() => {
                      void deletePerson(p.id);
                    });
                  }
                }}
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
