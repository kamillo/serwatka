"use client";

import { useActionState } from "react";
import { createAsset, type ActionResult } from "@/lib/actions/assets";
import type { Category } from "@prisma/client";

export function AddAssetForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult<{ id: string }> | null, fd: FormData) => {
    return createAsset({
      name: fd.get("name"),
      categoryId: (fd.get("categoryId") as string) || undefined,
      currency: fd.get("currency"),
    });
  }, null);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-400">Nazwa aktywa</span>
          <input
            type="text"
            name="name"
            required
            maxLength={100}
            placeholder="np. Konto mBank, IKE XTB…"
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Kategoria</span>
          <select
            name="categoryId"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          >
            <option value="">— bez kategorii —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Waluta</span>
          <input
            type="text"
            name="currency"
            defaultValue="PLN"
            maxLength={3}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 uppercase placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </label>
      </div>

      {state && !state.ok && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-emerald-400">✓ Aktywo dodane.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
      >
        {pending ? "Dodawanie…" : "Dodaj aktywo"}
      </button>
    </form>
  );
}
