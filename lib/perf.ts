// Wydajność nominalna aktywa (bez inflacji — real w fazie 3).
// Prosty model kosztu: wkład = ΣBUY + ΣFEE − ΣSELL; dochód = dywidendy + odsetki.

export type TxLike = {
  type: "BUY" | "SELL" | "DIVIDEND" | "INTEREST" | "FEE";
  amount: number;
};

export type PerfResult = {
  invested: number; // kapitał wkładu (net)
  current: number; // aktualna wartość (ostatnia wycena) lub 0
  realizedIncome: number; // dywidendy + odsetki
  gain: number; // zysk/strata nominalna
  roiPct: number | null; // gain / invested * 100 (null gdy brak wkładu)
  buys: number;
  sells: number;
};

export function computeNominalPerf(
  transactions: TxLike[],
  currentValue: number | null
): PerfResult {
  let buys = 0;
  let sells = 0;
  let fees = 0;
  let dividends = 0;
  let interest = 0;

  for (const t of transactions) {
    switch (t.type) {
      case "BUY":
        buys += t.amount;
        break;
      case "SELL":
        sells += t.amount;
        break;
      case "FEE":
        fees += t.amount;
        break;
      case "DIVIDEND":
        dividends += t.amount;
        break;
      case "INTEREST":
        interest += t.amount;
        break;
    }
  }

  const invested = buys + fees - sells;
  const realizedIncome = dividends + interest;
  const current = currentValue ?? 0;
  const gain = current - invested + realizedIncome;
  const roiPct = invested > 0 ? (gain / invested) * 100 : null;

  return { invested, current, realizedIncome, gain, roiPct, buys, sells };
}

/**
 * Realny zwrot: deflacja aktualnej wartości skumulowaną inflacją.
 * cumFrom = cumulativeIndex w miesiącu pierwszego zakupu, cumTo = teraz.
 * Zwraca null przy braku wkładu.
 */
export function realReturn(
  invested: number,
  currentValue: number,
  cumFrom: number,
  cumTo: number
): { realCurrent: number; realGain: number; realRoiPct: number } | null {
  if (invested <= 0) return null;
  const realCurrent = currentValue * (cumFrom / cumTo);
  const realGain = realCurrent - invested;
  return { realCurrent, realGain, realRoiPct: (realGain / invested) * 100 };
}
