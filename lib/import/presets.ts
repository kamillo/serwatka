// Presety importu — "punkty startowe" mapowania pól dla znanych źródeł PL.
// Kolumny banków/maklerów różnią się między wydaniem a wydaniem, więc preset to
// SUGESTIA: wizard pozwala ręcznie dopasować każde pole po podglądzie pliku.

export type FieldKey =
  | "date" // data operacji/wyceny
  | "amount" // zmiana (do running balance) / wartość transakcji
  | "balance" // saldo bezpośrednio = snapshot
  | "currency"
  | "description"
  | "type" // typ transakcji (KUPNO/SPRZEDAŻ…) — tryb transakcji
  | "quantity" // ilość / nominal
  | "price"; // cena jednostkowa

export type Encoding = "utf-8" | "windows-1250" | "iso-8859-2";

export type Preset = {
  id: string;
  label: string;
  hint: string; // co mapuje ten preset
  delimiter?: string; // undefined = auto-detekcja
  encoding?: Encoding; // undefined = heurystyka
  skipRows?: number; // wiersze nagłówkowe do pominięcia
  hasHeader?: boolean; // domyślnie true
  dateFormat: string; // np. "DD.MM.YYYY", "YYYY-MM-DD"
  decimalSeparator: "," | ".";
  thousandSeparator: string; // " ", ".", "", "'"
  defaultCurrency: string;
  columnMap: Partial<Record<FieldKey, string>>; // kanoniczne → nazwa kolumny źródłowej
};

export const PRESETS: Preset[] = [
  {
    id: "generic",
    label: "Generic CSV",
    hint: "Dowolny plik — mapuj pola ręcznie",
    dateFormat: "DD.MM.YYYY",
    decimalSeparator: ",",
    thousandSeparator: " ",
    defaultCurrency: "PLN",
    columnMap: {},
  },
  {
    id: "mbank",
    label: "mBank — konto",
    hint: "Eksport mBank (Windows-1250, ; )",
    delimiter: ";",
    encoding: "windows-1250",
    skipRows: 0,
    hasHeader: true,
    dateFormat: "YYYY-MM-DD",
    decimalSeparator: ",",
    thousandSeparator: " ",
    defaultCurrency: "PLN",
    columnMap: {
      date: "Data operacji",
      amount: "Kwota",
      balance: "Saldo po operacji",
      currency: "Waluta",
      description: "Opis operacji",
    },
  },
  {
    id: "pko",
    label: "PKO BP — konto",
    hint: "Historia operacji PKO BP",
    delimiter: ";",
    encoding: "windows-1250",
    hasHeader: true,
    dateFormat: "DD.MM.YYYY",
    decimalSeparator: ",",
    thousandSeparator: " ",
    defaultCurrency: "PLN",
    columnMap: {
      date: "Data operacji",
      amount: "Kwota",
      currency: "Waluta",
      description: "Opis transakcji",
    },
  },
  {
    id: "xtb",
    label: "XTB — makler",
    hint: "Historia transakcji XTB (UTF-8, przecinek)",
    delimiter: ",",
    encoding: "utf-8",
    hasHeader: true,
    dateFormat: "YYYY-MM-DD",
    decimalSeparator: ".",
    thousandSeparator: "",
    defaultCurrency: "PLN",
    columnMap: {
      date: "Time",
      type: "Type",
      quantity: "Volume",
      price: "Open price",
      amount: "Amount",
      currency: "Currency",
      description: "Comment",
    },
  },
  {
    id: "mbank_bm",
    label: "mBank BM — makler",
    hint: "mBank Biuro Maklerskie",
    delimiter: ";",
    encoding: "windows-1250",
    hasHeader: true,
    dateFormat: "YYYY-MM-DD",
    decimalSeparator: ",",
    thousandSeparator: " ",
    defaultCurrency: "PLN",
    columnMap: {
      date: "Data",
      type: "Typ",
      quantity: "Ilość",
      price: "Cena",
      amount: "Kwota",
      description: "Opis",
    },
  },
  {
    id: "obligacje",
    label: "obligacjeskarbowe.pl",
    hint: "Rejestr obligacji skarbowych",
    delimiter: ";",
    encoding: "windows-1250",
    hasHeader: true,
    dateFormat: "YYYY-MM-DD",
    decimalSeparator: ",",
    thousandSeparator: " ",
    defaultCurrency: "PLN",
    columnMap: {
      date: "Data",
      amount: "Wartość",
      description: "Instrument",
    },
  },
];

export function getPreset(id: string | null | undefined): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** Lista dostępnych nazw kolumn kanonicznych + etykiety PL do UI mapowania. */
export const FIELD_LABELS: Record<FieldKey, string> = {
  date: "Data",
  amount: "Kwota (zmiana)",
  balance: "Saldo (snapshot)",
  currency: "Waluta",
  description: "Opis",
  type: "Typ transakcji",
  quantity: "Ilość",
  price: "Cena jednostkowa",
};
