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
          <span className="text-xs font-medium text-gray-500">Nazwa aktywa</span>
          <input
            type="text"
            name="name"
            required
            maxLength={100}
            placeholder="np. Konto mBank, IKE XTB…"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Kategoria</span>
          <select
            name="categoryId"
            defaultValue=""
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
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
          <span className="text-xs font-medium text-gray-500">Waluta</span>
          <input
            type="text"
            name="currency"
            defaultValue="PLN"
            maxLength={3}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm uppercase dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      {state && !state.ok && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-emerald-600">✓ Aktywo dodane.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        {pending ? "Dodawanie…" : "Dodaj aktywo"}
      </button>
    </form>
  );
}
