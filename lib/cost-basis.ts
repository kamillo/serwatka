// FIFO cost basis — dokładny realized/unrealized P&L dla inwestycji z ilościami.
// Uzupełnia prosty ROI (lib/perf.ts): ten sam zysk całkowity, ale z podziałem
// na zrealizowany (zamknięte pozycje) i niezrealizowany (otwarte).
//
// Transakcje muszą być posortowane rosnąco po dacie (wywołujący).

export type FifoTx = {
  type: "BUY" | "SELL" | "DIVIDEND" | "INTEREST" | "FEE";
  quantity: number | null;
  price: number | null;
  amount: number;
};

export type FifoPerf = {
  remainingQty: number; // sztuki wciąż trzymane
  remainingBasis: number; // koszt FIFO otwartych lotów
  realizedGain: number; // P&L ze sprzedaży (FIFO)
  unrealizedGain: number; // currentValue − remainingBasis
  income: number; // dywidendy + odsetki
  totalGain: number; // realized + unrealized + income
  totalInvested: number; // Σ zakupów + opłat
  roiPct: number | null;
};

/**
 * Liczy FIFO. Zwraca null, gdy żadna transakcja nie ma ilości (FIFO bez sensu).
 */
export function computeFifoPerf(txs: FifoTx[], currentValue: number): FifoPerf | null {
  const hasQty = txs.some((t) => t.quantity != null && t.quantity > 0);
  if (!hasQty) return null;

  const lots: { qty: number; price: number }[] = [];
  let realizedGain = 0;
  let income = 0;
  let totalBuy = 0;
  let fees = 0;

  for (const t of txs) {
    switch (t.type) {
      case "BUY": {
        const qty = t.quantity ?? 0;
        const price = t.price ?? (qty > 0 ? t.amount / qty : 0);
        if (qty > 0) lots.push({ qty, price });
        totalBuy += t.amount;
        break;
      }
      case "SELL": {
        let toSell = t.quantity ?? 0;
        let cost = 0;
        while (toSell > 1e-9 && lots.length > 0) {
          const lot = lots[0];
          const take = Math.min(lot.qty, toSell);
          cost += take * lot.price;
          lot.qty -= take;
          toSell -= take;
          if (lot.qty <= 1e-9) lots.shift();
        }
        realizedGain += t.amount - cost;
        break;
      }
      case "DIVIDEND":
      case "INTEREST":
        income += t.amount;
        break;
      case "FEE":
        fees += t.amount;
        break;
    }
  }

  const remainingQty = lots.reduce((s, l) => s + l.qty, 0);
  const remainingBasis = lots.reduce((s, l) => s + l.qty * l.price, 0);
  const unrealizedGain = currentValue - remainingBasis;
  const totalGain = realizedGain + unrealizedGain + income;
  const totalInvested = totalBuy + fees;
  const roiPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : null;

  return {
    remainingQty,
    remainingBasis,
    realizedGain,
    unrealizedGain,
    income,
    totalGain,
    totalInvested,
    roiPct,
  };
}
