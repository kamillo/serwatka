"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { renameAsset } from "@/lib/actions/assets";

const FIELD =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm font-normal text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30";

/** Nazwa aktywa z edycją w miejscu (✎ → input, Enter zapisuje, Esc anuluje). */
export function AssetNameEditor({
  id,
  name,
  href,
  fill = false,
}: {
  id: string;
  name: string;
  href?: string;
  /** Rozciągnij na całą szerokość komórki — ✎ wyrównany do prawej krawędzi (tabele). */
  fill?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function cancel() {
    setValue(name);
    setError(null);
    setEditing(false);
  }

  async function save() {
    if (value.trim() === name) return cancel();
    setPending(true);
    const res = await renameAsset(id, value);
    setPending(false);
    if (!res.ok) return setError(res.error);
    setError(null);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <span
        className={
          fill ? "flex w-full items-center justify-between gap-2" : "inline-flex items-center gap-1.5"
        }
      >
        {href ? (
          <Link href={href} className="text-slate-100 hover:underline">
            {name}
          </Link>
        ) : (
          name
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-md px-1 text-sm font-normal text-slate-500 hover:bg-white/5 hover:text-emerald-300"
          aria-label="Edytuj nazwę"
          title="Edytuj nazwę"
        >
          ✎
        </button>
      </span>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="inline-flex flex-wrap items-center gap-2"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && cancel()}
        maxLength={100}
        className={`${FIELD} ${fill ? "w-full min-w-40" : "w-64"}`}
        aria-label="Nazwa aktywa"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
      >
        {pending ? "Zapisywanie…" : "Zapisz"}
      </button>
      <button
        type="button"
        onClick={cancel}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-normal text-slate-300 hover:bg-white/5"
      >
        Anuluj
      </button>
      {error && <span className="text-xs font-normal text-red-400">{error}</span>}
    </form>
  );
}
