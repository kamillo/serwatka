<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# serwatka — wiedza o projekcie

## Co to jest
Osobisty tracker finansowy: **wartość netto** (aktywa / wyceny / transakcje + FX + inflacja) oraz moduł **Dochód** (przychód / podatek / ZUS / wydatki per osoba, miesięcznie).
Plany: `PLAN_IMPLEMENTACJI.md` (net worth) + `PLAN_DOCHOD.md` (dochód). Status faz jest tam w checklistach.

## Stack
Next.js 16 (App Router, TS) · React 19 · Tailwind v4 · Prisma 6 + SQLite (dev) · ECharts 6 · Zod 4 · Vitest 4.

## Krytyczne ograniczenia (nauczki — czytaj ZANIM piszesz kod)
1. **Prisma 6, nie 7.** v7 usunęła `url` z `datasource` — trzymamy v6 (klasyczny `url = env("DATABASE_URL")` w `prisma/schema.prisma`).
2. **`"use server"` pliki eksportują TYLKO async functions.** Schematy Zod i inne stałe muszą być **nieeksportowane** (lokalne w pliku) lub przeniesione do modułu nie-use-server (np. `lib/income.ts`). Błął w runtime (nie w `tsc`/`build`) → `found object` / `is not a function`. Pułapka powtarzana — sprawdź: `grep -nE "^export const|^export let|^export var|^export \{" lib/actions/*.ts` (powinno być puste).
3. **Po migracji schematu ZRESTARTUJ `next dev`.** Dev cache'uje `@prisma/client`; stary klient → `prisma.<model>` undefined (HTTP 500). `tsc`/smoke (świeży `tsx`) działają, dev nie — to sygnał do restartu.
4. **Nie uruchamiaj `npm run build` podczas `next dev`.** Clobberuje `.next` i psuje dev. Do typów użyj `npx tsc --noEmit`.
5. **SQLite dev** (brak Dockera/Postgresa lokalnie). LKV (forward-fill szeregu) liczone w TS (`lib/lkv.ts`), nie w SQL (brak `generate_series`).
6. **FX (NBP) + inflacja (Eurostat)** — keyless, fetch live; cache w bazie (`fx_rates`, `macro_inflation`).

## Model danych (Prisma)
- **Net worth**: `Asset` → `Valuation` (snapshot, szereg czasowy; `valuePln` precomputowane z `convertToPln`) + `Transaction` (historia zakupów, FIFO). Plus `Category`, `ImportJob`.
- **Dochód**: `Person` → `IncomeRecord` (1 / osoba × miesiąc: `income`/`tax`/`zus`; `@@unique([personId, month])`) → `IncomeExpense` (linie „innych wydatków").
- **Makro**: `FxRate` (NBP tabela A), `MacroInflation` (Eurostat HICP: `cpiMonthlyIndex` m/m + `cumulativeIndex`).
- Wszystko scope'owane po `userId`.

## Auth
Dev single-user: `lib/auth.ts` → `getCurrentUserId()` zwraca seedowanego `dev@networth.local`. Placeholder pod Auth.js (interfejs gotowy do podmiany).

## Kluczowe pliki
- `lib/`: `lkv.ts` (forward-fill), `fx.ts` (NBP, `convertToPln`), `inflation.ts` (cumulative + real), `income.ts` (netto/serie + `PERSON_COLORS`), `perf.ts` (ROI), `cost-basis.ts` (FIFO), `format.ts`.
- `lib/import/`: `parse.ts` (PapaParse + iconv-lite), `transform.ts` (`parseDate`/`parseAmount`/`mapType`), `presets.ts`.
- `lib/actions/*.ts` — server actions (`assets`, `valuations`, `transactions`, `import`, `inflation`, `income`). Wszystkie `"use server"` — patrz pułapka #2.
- `lib/data.ts` — zapytania do stron (serwer).
- `app/components/` — UI (wykresy ECharts, formularze, wizardy, Nav, Logo).
- Strony: `app/page.tsx` (dashboard), `app/import`, `app/inflation`, `app/income` (+ `income/import`), `app/compare`, `app/export`, `app/assets/[id]`.
- `prisma/`: `schema.prisma`, `seed.ts` (demo net worth + dochód), `seed-inflation.ts`.
- `scripts/`: `smoke-*.ts` (smoke), `wipe.ts`.

## Komendy
- `npm run dev` · `npm test` (vitest) · `npx tsx scripts/smoke-*.ts`
- DB: `db:wipe` (czyści wszystko) · `db:demo` (dane testowe: aktywa+wyceny+transakcje+dochód) · `db:inflation` · `db:fresh` (demo+inflacja) · `db:studio` · `db:reset` (migrate reset)
- Typy bez psucia dev: `npx tsc --noEmit` (ignoruj błędy z `res/` — to pliki użytkownika, nie część apki)

## Testowanie server actions w `tsx` (smoke)
Akcje wołają `revalidatePath` — poza runtime Next rzuca to **po** zakończeniu transakcji. W smoke: `try { await akcja(...) } catch {}` i weryfikuj stan DB — zapisy już się wykonały.

## UI
Sleek dark (slate-950 + glow emerald/cyan), glass cards (`rounded-2xl border-white/10 bg-white/[0.04] backdrop-blur-md`), przyciski gradient emerald→cyan, logo-kropla w Nav. **Dark-only** (wymuszona klasa `.dark`). Inputy/selecty: `h-9 px-2` (stała wysokość). Brak light-theme.

## Notatki
- `res/` — zasoby designu użytkownika (logo SVG, `serwatka_logo_dashboard.tsx` z tsc-error). **Nie** część apki; ignoruj w build/tsc.
- Pamięć agenta: `~/.claude/projects/-Users-kamillo-Developer-serwatka/memory/` (preferencje pracy, np. przenoszenie plików pojedynczo).

