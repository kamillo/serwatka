# Plan implementacji: serwatka

## 0. Założenia i kontekst

- **Typ aplikacji:** osobisty tracker wartości netto, model single-user (prywatne finanse). Skala mała–średnia, ale dane wrażliwe (finansowe) → prywatność i poprawność na pierwszym miejscu.
- **Waluta bazowa:** PLN. Wielowalutowość jako wymóg (aktywa w USD/EUR/krypto).
- **Paradygmat danych:** snapshoty/wyceny (valuation-based), nie pełna księgowość transakcji. To upraszcza model i pasuje do wymogu „aktualizacja wartości istniejącego aktywa z datą".

---

## 1. Architektura i technologie

### 1.1 Proponowany stack (rekomendowany)

**Full-stack TypeScript — jedno repozytorium, jeden język.**

| Warstwa | Technologia | Uzasadnienie |
|---|---|---|
| **Frontend** | **Next.js 14+ (App Router) + TypeScript + Tailwind CSS** | SSR/SSG, routing, API w jednym; szybki start; dojrzały ekosystem |
| **Wykresy** | **Apache ECharts** (`echarts-for-react`) jako główne; opcjonalnie **Recharts** na proste KPI/sparkline | ECharts: stacked area, dual-axis (portfel + inflacja), zoom timeline — kluczowe dla FinTech |
| **Backend/API** | **Next.js Route Handlers** (lub wydzielony **Fastify/NestJS** gdy logika rośnie) | Wystarczające na MVP; czysty rozdział gdy trzeba |
| **Baza danych** | **PostgreSQL** (Supabase / Neon / self-hosted) | Relacyjna, okienkowe funkcje do „last known value", integralność danych finansowych |
| **ORM** | **Prisma** (szybki start) lub **Drizzle** (lżejszy, SQL-first) | Migracje, typowanie end-to-end |
| **Auth** | **Auth.js (NextAuth)** lub **Clerk** | Single-user + ew. rodzinne konta |
| **Import/parsing** | **PapaParse** + `iconv-lite` (kodowanie) | Auto-detekcja separatora, robust CSV |
| **Walidacja** | **Zod** | Schematy wejścia (formularze + import) |
| **Hosting** | **Vercel** (frontend+API) + zarządzany Postgres | Zero-config, darmowy tier na start |

> **Alternatywa Python (FastAPI + pandas + PostgreSQL):** przewaga `pandas` w czyszczeniu danych bankowych i agregacjach. Warto rozważyć **tylko jeśli** import stanie się domeną wymagającą ciężkiego ETL. Na MVP i przy tym zestawie funkcji — overkill. Rekomendacja: **TS end-to-end**, opcjonalny mikroserwis Python dla importu w fazie 4 jeśli się pojawi potrzeba.

### 1.2 Struktura bazy danych

Rdzeń: **Aktywa → Wyceny (szereg czasowy) → agregacja PLN**. Plus tabele makro (inflacja, kursy) i obsługa importu.

```sql
-- 1. Użytkownik
users (
  id PK, email UNIQUE, base_currency DEFAULT 'PLN',
  created_at
)

-- 2. Aktywa (definicja, nie wartość)
assets (
  id PK, user_id FK,
  name,                        -- "Konto mBank", "IKE XTB", "Edukacyjna 3.0"
  category,                    -- ENUM: cash, stocks, bonds, real_estate, crypto, other
  currency,                    -- ISO 4217: PLN, USD, EUR...
  is_active BOOLEAN,           -- false gdy sprzedane/zamknięte
  created_at
)

-- 3. Historia wycen (SERDCE — szereg czasowy)
valuations (
  id PK, asset_id FK, user_id FK,
  value_original NUMERIC,      -- kwota w currency aktywa
  currency,                    -- redundancja dla bezpieczeństwa historii
  fx_rate_to_pln NUMERIC,      -- kurs użyty (audytowalność)
  fx_rate_date DATE,           -- data kursu (może ≠ valuation_date)
  value_pln NUMERIC,           -- value_original * fx_rate (denormalizacja dla wykresów)
  valuation_date DATE,         -- data wyceny
  source,                      -- ENUM: manual, import, csv_import
  source_ref,                  -- np. nazwa pliku / id importu
  note TEXT,
  created_at,
  UNIQUE (asset_id, valuation_date, source_ref)  -- ochrona duplikatów
)

-- 4. Kategorie (słownik, opcjonalnie enum)
categories ( id PK, name, color_hex, display_order )

-- 5. Dane makroekonomiczne — inflacja
macro_inflation (
  id PK,
  month DATE,                  -- pierwszy dzień miesiąca
  cpi_monthly_index NUMERIC,   -- wskaźnik miesiąca do miesiąca (np. 1.005 = +0.5% m/m)
  cumulative_index NUMERIC,    -- skumulowany od base_month (iloczyn)
  source,                      -- 'GUS' | 'manual'
  updated_at,
  UNIQUE (month)
)

-- 6. Kursy walut (cache NBP)
fx_rates (
  id PK, currency, rate_to_pln NUMERIC, rate_date DATE, source,
  UNIQUE (currency, rate_date, source)
)

-- 7. Importy (historia + konfiguracja mapowania)
import_jobs (
  id PK, user_id FK,
  filename, source_type,       -- 'mbank' | 'pko' | 'xtb' | 'generic'
  mapping_config JSONB,        -- zapisany preset (do ponownego użycia)
  status,                      -- 'pending' | 'preview' | 'committed' | 'failed'
  rows_total, rows_imported, rows_skipped,
  created_at
)

-- 8. (Opcjonalnie) Surowe transakcje — staging przed konwersją na wyceny
raw_transactions (
  id PK, import_job_id FK, user_id FK,
  raw_row JSONB,               -- oryginalny wiersz z pliku
  canonical JSONB,             -- po mapowaniu: {date, amount, currency, type...}
  status,                      -- 'pending' | 'mapped' | 'imported' | 'error'
  error_message
)
```

**Kluczowe decyzje projektowe:**
- `valuations` przechowuje **gotową wartość wyceny** (nie transakcję kupna/sprzedaży). Import z banku/brokera zamienia się na wyceny (saldo bieżące) podczas importu.
- `value_pln` denormalizowane dla wydajności wykresów; `fx_rate_*` + `currency` zachowane dla audytu i przeliczeń wstecz.
- `UNIQUE (asset_id, valuation_date, source_ref)` zapobiega dublom przy ponownym imporcie tego samego pliku.

---

## 2. Logika importu danych (NAJWAŻNIEJSZE)

Polskie pliki CSV są nierówne: separatory `,` `;` `\t`, separatory dziesiętne `,` vs `.`, kodowanie Windows-1250/ISO-8859-2 (nie UTF-8!), formaty dat `dd.mm.yyyy` / `yyyy-mm-dd`, nazwy kolumn po polsku/angielsku, znaki +/- dla wpływów/wydatków.

### 2.1 Mechanizm mapowania pól (field mapping) — wizard krok po kroku

Kreator importu w 6 krokach, **każdy z podglądem na żywo i walidacją przed zapisem**:

1. **Wybór źródła** — preset (`mBank`, `PKO BP`, `XTB`, `mBank BM`, `obligacjeskarbowe.pl`, `Generic CSV`) lub „nowy".
2. **Upload + parsing** — drag&drop pliku. PapaParse auto-detekuje separator/quote; `iconv-lite` wykrywa kodowanie. Feedback: „wykryto 312 wierszy, separator `;`, kodowanie Windows-1250".
3. **Podgląd surowy** — tabela pierwszych ~15 wierszy tak jak w pliku.
4. **Mapowanie pól** — dla każdego pola kanonicznego dropdown wyboru kolumny źródłowej + transformacji:
   - Pole kanoniczne: `date`, `amount`, `currency`, `transaction_type` (wpływ/wydatek), `category/asset`, `description`.
   - Transformacje: `parseDate(format)`, `parseAmount(decimalSep, thousandSep, signConvention)`.
   - Sugerowane automatycznie z presetu; edytowalne.
5. **Walidacja + transformacja** — podgląd wierszy po mapowaniu. Panel błędów (czerwony — blokujący) vs ostrzeżeń (żółty — oznaczony).
6. **Przypisanie do aktywów + zatwierdzenie** — mapowanie wykrytych wartości kolumn na istniejące `assets` (lub tworzenie nowych). Podsumowanie: „142 do importu, 3 pominięte, 5 duplikatów". Commit.

**Preset = zapisana konfiguracja JSON:**
```json
{
  "name": "mBank konto",
  "delimiter": ";",
  "encoding": "windows-1250",
  "dateFormat": "DD.MM.YYYY",
  "decimalSeparator": ",",
  "thousandSeparator": " ",
  "headerRows": 0,
  "skipRows": 38,
  "columnMap": {
    "date": "Data operacji",
    "amount": "Kwota",
    "currency": "Waluta",
    "description": "Opis operacji"
  },
  "amountTransform": "signPreserved"
}
```
Presets wbudowane dla znanych źródeł + zapisywanie własnych (użytkownik mapuje raz, potem 1 kliknięcie).

**Reprezentacja kanoniczna (pośrednia, wewnętrzna):**
```ts
type CanonicalRow = {
  date: string; amount: number; currency: string;
  type: 'credit'|'debit'|'valuation'; category?: string;
  description?: string; raw: Record<string,string>;
}
```

### 2.2 Konwersja walut na PLN

- Każda wycena/transakcja zapisuje **oryginalną walutę i kwotę** + przelicza na PLN.
- **Źródło kursów:** NBP API (Średnie kursy walut, **tabela A**, mid), bez klucza:
  - `https://api.nbp.pl/api/exchangerates/rates/a/{CODE}/{YYYY-MM-DD}/?format=json`
  - NBP publikuje **dni robocze** — brak weekendów/świąt.
- **Logika wyboru kursu (data):**
  1. Kurs z `valuation_date`.
  2. Jeśli brak (weekend/święto) → **ostatni dzień roboczy ≤ data** (LKV kursu).
  3. Zapisz `fx_rate_date` (faktycznie użyta data) dla audytu.
- **Cache:** zapis do `fx_rates`; kolejne importy/operacje czytają z bazy (limit wywołań API NBP — bardzo zalecane).
- **Aktywa wielowalutowe** (np. akcje USD): pozycja trzymana w walucie oryginalnej; agregacja do PLN odbywa się w zapytaniu wykresu po kursie z danej daty.
- Audytowalność: `fx_rate_to_pln` + `fx_rate_date` na każdej wycenie → pełna odtwarzalność.

### 2.3 Fallback daty (brak precyzyjnej daty w pliku)

Hierarchia ustalania daty wiersza:

1. **Data operacji** (najdokładniejsza) — preferowana.
2. **Data księgowania / data waluty** — gdy brak operacyjnej.
3. **Tylko miesiąc/rok** (np. rejestr obligacji czasem bez dnia) → **ostatni dzień miesiąca**, flaga `date_estimated = true`, w podglądzie wyróżnione do ręcznej korekty.
4. **Brak jakiejkolwiek daty** → wiersz oznaczony błędem (czerwony), **nie importowany** dopóki użytkownik nie poda daty lub nie odrzuci wiersza.
5. **Konflikt dwóch dat** (np. operacja vs księgowanie różniące się o weekend) → użyj operacyjnej, księgowanie do `note`.

Zasada: **żaden wiersz z niepewną/brakującą datą nie trafia do bazy bez potwierdzenia w podglądzie.**

---

## 3. Logika wycen i inflacji

### 3.1 Dane o inflacji — źródło i aktualizacja

- **GUS** publikuje miesięczny wskaźnik CPI, ale **API wymaga klucza** (API GUS/BDL) i jest toporne. NBP nie wystawia bezpośrednio indeksu inflacji.
- **Rekomendacja hybrydowa (pragmatyczna):**
  1. **Bootstrap z pliku JSON w repo** — tablica miesięcznych wskaźników CPI m/m (12 wartości/rok, niewielki wolumen, łatwa konserwacja). Aktualizacja raz na kwartał commit.
  2. **Ręczny formularz wprowadzania** — dla najnowszych miesięcy brakujących w JSON (UX: admin/ustawienia → wpisz wskaźnik).
  3. **(Faza 4) Integracja API GUS** — automatyczne pobieranie gdy warto dla skalowania.
- **Przechowywanie:** `macro_inflation` z `cpi_monthly_index` (m/m) i **wyliczanym** `cumulative_index` od miesiąca bazowego:
  - `cumulative_index[m] = Π_{i=base..m} (1 + monthly_index[i])` (iloczyn).
  - Trigger/job przelicza cumulative przy wstawce nowego miesiąca.

### 3.2 Nakładanie inflacji na wykres

- **Wartość realna (oczyszczona z inflacji):** `real_value[t] = nominal_value[t] / cumulative_index[t]` (bazując w dacie startu portfela, indeks=1 na starcie).
- Na głównym wykresie **dwie linie**: nominalna wartość netto + wartość realna (inflation-adjusted). Przełącznik: nominalna / realna / obie.
- Alternatywnie: linia „skumulowanej inflacji" znormalizowana do wartości startowej portfela (żeby było wizualnie porównywalne na jednej osi). ECharts dual-axis rozwiązuje to czysto.

### 3.3 Last Known Value (LKV) — wycena w dniach bez wpisu

Problem: użytkownik wpisuje wyceny rzadko (np. co miesiąc), wykres musi być ciągły dziennie.

**Algorytm forward-fill:**
- Dla każdej daty `d` w zakresie `[pierwsza_wycena, dziś]`: wartość = **najnowsza wycena z daty ≤ d** (dla danego aktywa).
- Suma po aktywach (w PLN) = całkowita wartość netto na dzień `d`.

**Implementacja PostgreSQL** (czyste, wydajne):
```sql
SELECT d::date AS date,
       COALESCE(SUM(lv.value_pln), 0) AS total_net_worth
FROM generate_series($1, $2, INTERVAL '1 day') AS d
LEFT JOIN LATERAL (
  SELECT v.value_pln, v.asset_id
  FROM valuations v
  WHERE v.valuation_date <= d AND v.user_id = $uid
  ORDER BY v.valuation_date DESC
  LIMIT 1                     -- LKV per aktywo
) lv ON true
GROUP BY d
ORDER BY d;
```
- **Przed pierwszą wyceną** → NULL (nie pokazujemy, brak danych).
- **Aktywo zamknięte/sprzedane** → `is_active=false` + ostatnia wycena pozostaje LKV, lub wpisz 0 w dacie zamknięcia (wyraźna decyzja UX).
- **Kategorie** tego samego dnia: suma LKV per kategoria → stacked area / donut.

---

## 4. Projekt UX/UI

### 4.1 Główny Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  [Wartość netto]  [Δ miesiąc]  [Real (po inflacji)]  [Aktywa]│  ← KPI na górze (4 karty)
│    482 300 PLN     +3,2%        −1,1%               9       │
├─────────────────────────────────────────────────────────────┤
│  [1M][6M][YTD][1R][MAX]  ☐ Real  ☑ Nominal  ☐ Inflacja    │
│ ┌─────────────────────────────────────────────────────────┐         │
│ │        WYKRES AREA: wartość netto w czasie      │  ← duży, centralny
│ │        (linia nominalna + opcjonalnie real)      │         │
│ └─────────────────────────────────────────────────────────┘         │
├──────────────────────────┬──────────────────────────────────┤
│  Podział aktywów (donut) │   Kompozycja w czasie (stacked)  │
│  gotówka 28%             │   ───────────────────            │
│  akcje 35%               │   (ewolucja udziału kategorii)   │
│  obligacje 22%           │                                  │
│  nieruch. 10% / krypto 5%│                                  │
├──────────────────────────┴──────────────────────────────────┤
│  Lista aktywów (tabela)            [＋ Dodaj wpis] [⬆ Import]│
│  Aktywo | Kategoria | Waluta | Wartość | Δ | Ostatnia wycena │
└─────────────────────────────────────────────────────────────┘
```

- **KPI na górze:** wartość netto (duża), zmiana miesiąc, zmiana realna vs inflacja, liczba aktywów. Sparkline w każdej karcie.
- **Wykres główny** z przełącznikami (nominal/real/inflacja) i zakresem dat.
- **Dwa wykresy struktury:** donut (stan obecny) + stacked area (ewolucja w czasie).
- **CTA:** „Dodaj wpis" (formularz) + „Import" (wizard) zawsze widoczne.

### 4.2 Flow importu CSV (minimalizacja błędów)

```
[Kliknij Import]
   → [Wybierz preset: mBank / PKO / XTB / ... / Generic]
   → [Drag&drop pliku] → natychmiast: „312 wierszy, ; , Windows-1250"
   → [Podgląd surowy 15 wierszy]
   → [Mapowanie pól] auto-suggest z presetu, edytowalne, live-preview wartości
   → [Walidacja] błędy (czerwony, blok) / ostrzeżenia (żółty, flag)
   → [Przypisz aktywa] kolumny/wartości → istniejące/nowe aktywa
   → [Podsumowanie] „142 do importu, 3 pominięte, 5 duplikatów [pomiń/nadpisz/zatrzymaj oba]"
   → [Zatwierdź] → ekran sukcesu + link „zobacz na wykresie"
```

**Zasady UX:** nigdy destruktywnie bez podglądu · zawsze odwracalne (`import_job_id` → usuń import) · duplikaty wykrywane przed zapisem · preset skraca ścieżkę do 2 kliknięć przy kolejnym imporcie.

---

## 5. Roadmapa implementacji (fazy + checklisty)

### Faza 1 — MVP: ręczne śledzenie + dashboard (2–3 tyg.) ✅ UKOŃCZONE

> Realizacja: Next.js 16 + React 19 + Tailwind 4 + Prisma 6 + ECharts 6 + Zod 4 + Vitest.
> Baza: **SQLite** (decyzja dev — brak Dockera/Postgresa lokalnie); LKV liczony w **TS** (`lib/lkv.ts`), przenośny na Postgres.
> Auth: **dev single-user** (`lib/auth.ts`) — placeholder pod Auth.js w fazie 4.

- [x] Inicjalizacja projektu: Next.js + TS + Tailwind + Prisma (+ SQLite dev)
- [x] Schemat bazy: `users`, `assets`, `valuations`, `categories` + migracja `init`
- [x] Autentykacja — dev single-user (placeholder, interfejs gotowy pod Auth.js)
- [x] CRUD aktywów (tworzenie, edycja, kategoria, waluta, aktyw/nieaktyw)
- [x] Formularz dodawania wyceny (data, kwota, waluta, opis) z walidacją Zod
- [x] Algorytm Last Known Value — implementacja TS (forward-fill) + testy vitest
- [x] Główny wykres area: wartość netto w czasie (ECharts)
- [x] KPI na górze dashboardu (netto, Δ 30 dni, liczba aktywów)
- [x] Wykres struktury: donut + stacked area per kategoria
- [x] Lista aktywów (tabela) + ukrywanie/usuwanie (cascade wycen)
- [x] Wybór zakresu dat (1M/6M/YTD/1R/MAX) + auto-gęstość próbkowania
- [x] Testy jednostkowe LKV (`lib/lkv.test.ts`, 9/9 zielone)

### Faza 2 — Silnik importu CSV (3–4 tyg.) ⭐ rdzeń ✅ UKOŃCZONE

> Parsowanie po stronie serwera (iconv-lite + PapaParse), wizard mapowania po stronie klienta.
> Weryfikacja: build zielony, 22 testy (9 LKV + 13 transform), smoke test round-trip commit/undo, endpoint HTTP poprawnie dekoduje Win-1250 + polskie znaki.

- [x] Tabela `import_jobs` (+ migracja). `raw_transactions` pominięte (opcjonalne) — wiersze kanoniczne żyją w stanie wizarda po stronie klienta.
- [x] Upload plików (input + limit 10 MB + typ `.csv/.txt`) — `POST /api/import/parse`
- [x] Parsing: PapaParse + auto-detekcja separatora
- [x] Wykrywanie/normalizacja kodowania (iconv-lite: heurystyka UTF-8 → fallback Win-1250 + BOM)
- [x] Mechanizm mapowania pól (dropdowny per pole + live preview)
- [x] Presety wbudowane: generic, mBank, PKO, XTB, mBank BM, obligacjeskarbowe.pl
- [x] Walidacja: daty (`dd.mm.yyyy`, `yyyy-mm-dd`), kwot (`1 234,56`, nawesy, znak), z wykrywaniem przepełnienia daty
- [x] Fallback daty (brak dnia → ostatni dzień miesiąca, `dateEstimated`; brak daty → błąd blokujący)
- [x] Panel błędów (czerwony, blok) vs ostrzeżeń (żółty, flag) w wizardzie
- [x] Przypisanie wierszy do aktywów (jedno aktywo docelowe na import)
- [x] Detekcja duplikatów (przed zapisem, data+aktywo) + polityka **pomiń / nadpisz** (opcja „oba" odroczona)
- [~] Zapisywanie własnych presetów — `mappingConfig` (JSONB) persystowane per import; UI „zapisz jako preset" do wielokrotnego użytku — odroczone do fazy 4
- [x] Konwersja importu → wyceny: **saldo direct** (snapshot) lub **running balance** (skumulowana suma)
- [x] Cofanie importu (po `import_job_id`) + historia importów

### Faza 2.5 — Model hybrydowy: transakcje (dodana na żądanie) ✅ UKOŃCZONE

> Gotówka = wyceny (snapshot). Inwestycje (obligacje/akcje/ETF) = transakcje (historia zakupów) + wyceny (wartość teraz).
> Cel: zestawienie wydajności — ROI nominalny teraz, **real vs inflacja w Fazie 3**.
> Weryfikacja: build zielony, 28 testów, smoke transakcji (import XTB-like → 3 tx → ROI 7.89% → undo).

- [x] Model `Transaction` (type BUY/SELL/DIVIDEND/INTEREST/FEE, quantity, price, amount) + enum + migracja
- [x] Transform: pola `type`/`quantity`/`price` + `mapType` (KUPNO→BUY, SPRZEDAŻ→SELL, dywidenda/odsetki/opłata) + testy
- [x] `commitImport` — tryb `target: "valuations" | "transactions"` (transakcje: append, bez dedup)
- [x] `undoImport` usuwa też transakcje powiązane z importem
- [x] Wizard: selektor trybu (wyceny/transakcje), warunkowe pola type/ilość/cena, adaptacyjny preview, commit z `target`
- [x] Widok aktywa `/assets/[id]`: KPI wydajności (wkład, wartość teraz, zysk/strata, ROI), mini-wykres wycen, tabela transakcji + usuwanie, formularz dodawania transakcji
- [x] Link z tabeli aktywów → `/assets/[id]`
- [x] ROI nominalny (`lib/perf.ts`): wkład = ΣBUY + ΣFEE − ΣSELL; dochód = dywidendy + odsetki; zysk = wartość − wkład + dochód

**Uproroszczenia (do Faz 3–5):** koszt prosty (Σ, bez FIFO/średniego kosztu — dokładne dla buy-and-hold); wielowalutowość transakcji (FX) w Fazie 3; **report real-vs-inflacja** w Fazie 3 (razem z danymi inflacji); ceny rynkowe na żywo w Fazie 5.

### Faza 3 — Wielowalutowość + inflacja (2–3 tyg.) ✅ UKOŃCZONE

> FX live (NBP tabela A, cache + walk-back), inflacja offline (JSON + cumulative).
> Weryfikacja: build zielony, 37 testów, smoke FX live (USD 3.94 / EUR 4.37), 41 miesięcy inflacji, dashboard z linią realną, real ROI na `/assets/[id]`.

- [x] Tabele: `fx_rates`, `macro_inflation` (+ migracja)
- [x] Integracja NBP API (tabela A, mid) + cache w bazie (`lib/fx.ts`)
- [x] Logika wyboru kursu: LKV kursu (≤7 dni) dla weekendów/świąt + walk-back po NBP
- [x] `value_original` + `value_pln` + `fx_rate_*` na wycenach i transakcjach (convertToPln)
- [x] Agregacja wielowalutowa do PLN (valuePln w LKV + wykresie)
- [x] Bootstrap inflacji z JSON (`lib/inflation/cpi.json`, ~2023–2026) + `seed-inflation.ts`
- [x] `cumulative_index` = ∏(1+cpi m/m) od base; recalc przy edycji (`lib/inflation.ts`)
- [x] Ręczny formularz wpisu/edycji wskaźnika (`/inflation` + `setInflationRate`)
- [x] Linia realna na wykresie głównym (deflacja cumulative) + panel `/inflation`
- [x] Przełącznik nominal / real / inflacja na dashboardzie
- [x] **Report real-vs-inflacja**: ROI realny na `/assets/[id]` (deflacja wartości aktualnej inflacją od pierwszego zakupu)
- [x] Aplikacja FX w import (`prefetchFxRange` + `convertToPln` per wiersz, oba tryby)

**Notki:** dane CPI przykładowe (orientacyjne GUS) — podmień przez `/inflation`; FX cache stale LKV ≤7 dni; real ROI uproszczony (bez deflacji dywidend, bez FIFO — Faza 4).

### Faza 4 — UX, analityka, jakość (2–3 tyg.)

- [ ] Polishing dashboardu (responsywność, dark mode)
- [ ] Szczegółowy widok aktywa (historia wycen, mini-wykres)
- [ ] Filtry i porównania (aktywo vs aktywo, kategoria vs kategoria)
- [ ] Eksport danych własnych (CSV/JSON) — przenośność
- [ ] (opcjonalnie) Integracja API GUS dla auto-aktualizacji inflacji
- [ ] (opcjonalnie) Mikroserwis Python dla trudnych ETL, jeśli potrzeba
- [ ] Audyt bezpieczeństwa (dane finansowe: szyfrowanie, backup, RLS Postgres)
- [ ] Testy E2E (Playwright) dla flow importu
- [ ] Monitoring błędów (Sentry) + logowanie

### Faza 5 (opcjonalnie) — Automatyzacja i rozszerzenia (ciągłe)

- [ ] PWA / mobile-friendly (lub aplikacja mobilna)
- [ ] Auto-import harmonogramem (OCR wyciągów / integracje bankowe PSD2 — ambitne)
- [ ] Ceny rynkowe na żywo (akcje, krypto) dla wycen bieżących
- [ ] Cele/prognozy (cele oszczędnościowe, projekcje)
- [ ] Współdzielenie rodzinne (wielu użytkowników, uprawnienia)
- [ ] Powiadomienia (przypomnienie o comiesięcznej wycenie)

---

**Podsumowanie technologiczne:** Next.js (TS) + PostgreSQL + Prisma + ECharts + PapaParse + NBP API. Rdzeń = `valuations` (szereg czasowy) + LKV (forward-fill) + wizard importu z presetami i mapowaniem pól + hybrydowa inflacja (JSON+ręcznie+API). MVP w ~3 tyg., pełny produkt w ~10–12 tyg.
