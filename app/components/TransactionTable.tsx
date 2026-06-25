"use client";

import { useTransition } from "react";
import { deleteTransaction } from "@/lib/actions/transactions";
import { formatDate, formatPLN } from "@/lib/format";

type Tx = {
  id: string;
  type: "BUY" | "SELL" | "DIVIDEND" | "INTEREST" | "FEE";
  date: string;
  quantity: number | null;
  price: number | null;
  amount: number;
  note: string | null;
};

const TYPE_LABEL: Record<Tx["type"], string> = {
  BUY: "Zakup",
  SELL: "Sprzedaż",
  DIVIDEND: "Dywidenda",
  INTEREST: "Odsetki",
  FEE: "Opłata",
};

export function TransactionTable({ transactions }: { transactions: Tx[] }) {
  const [pending, startTransition] = useTransition();

  if (transactions.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">
        Brak transakcji. Dodaj pierwszą poniżej lub zaimportuj historię zakupów.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800">
            <th className="py-2 pr-3 font-medium">Data</th>
            <th className="py-2 pr-3 font-medium">Typ</th>
            <th className="py-2 pr-3 text-right font-medium">Ilość</th>
            <th className="py-2 pr-3 text-right font-medium">Cena</th>
            <th className="py-2 pr-3 text-right font-medium">Kwota</th>
            <th className="py-2 pr-3 font-medium">Notatka</th>
            <th className="py-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-b border-gray-100 dark:border-neutral-800/60">
              <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{formatDate(t.date)}</td>
              <td className="py-2 pr-3">{TYPE_LABEL[t.type]}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-gray-500">
                {t.quantity ?? "—"}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-gray-500">
                {t.price != null ? formatPLN(t.price) : "—"}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatPLN(t.amount)}</td>
              <td className="py-2 pr-3 max-w-[200px] truncate text-gray-500">{t.note || "—"}</td>
              <td className="py-2 text-right">
                <button
                  disabled={pending}
                  onClick={() => {
                    startTransition(() => {
                      void deleteTransaction(t.id);
                    });
                  }}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Usuń
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
