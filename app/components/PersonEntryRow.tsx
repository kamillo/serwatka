"use client";

import { useState } from "react";
import { IncomeEntryEditor } from "./IncomeEntryEditor";
import type { PersonRecord } from "@/lib/data";
import { formatMonthPL, formatPLN } from "@/lib/format";

const BTN =
  "rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5";

/** Wiersz tabeli szczegółów osoby z rozwijanym edytorem wpisu. */
export function PersonEntryRow({ personId, record }: { personId: string; record: PersonRecord }) {
  const [editing, setEditing] = useState(false);
  const t = record.totals;

  return (
    <>
      <tr className="border-b border-white/5">
        <td className="py-2 pr-3 capitalize text-slate-200">{formatMonthPL(record.month)}</td>
        <Cell v={record.income} />
        <Cell v={record.vat} />
        <Cell v={record.pit} />
        <Cell v={record.zus} />
        <Cell v={t.totalExpenses} />
        <td className={`py-2 pr-3 text-right tabular-nums font-medium ${t.net < 0 ? "text-red-400" : "text-emerald-400"}`}>
          {formatPLN(t.net)}
        </td>
        <td className="py-2 pr-3 text-right">
          <button onClick={() => setEditing((e) => !e)} className={BTN}>
            {editing ? "Zamknij" : "Edytuj"}
          </button>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={8} className="bg-white/[0.02] px-3 pb-3 pt-1">
            <IncomeEntryEditor
              personId={personId}
              month={record.month}
              record={record}
              onDone={() => setEditing(false)}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function Cell({ v }: { v?: number }) {
  return <td className="py-2 pr-3 text-right tabular-nums text-slate-300">{v == null ? "—" : formatPLN(v)}</td>;
}
