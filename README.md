# serwatka — net worth tracker

Osobisty tracker wartości netto: wykres wartości w czasie, struktura aktywów, import wyciągów CSV (banki/maklerzy/obligacje), wielowalutowość (NBP) i realna zmiana vs inflacja (Eurostat HICP).

## Stack

Next.js 16 (App Router, TS) · React 19 · Tailwind v4 · Prisma 6 + SQLite (dev) · ECharts · Zod · Vitest. Dane makro: NBP (FX, bez klucza) + Eurostat (HICP, bez klucza).

## Szybki start

```bash
npm install
cp .env.example .env          # DATABASE_URL="file:./dev.db" (lub ustaw ręcznie)
npx prisma migrate dev        # migracje + wygenerowanie klienta
npm run db:fresh              # dane demonstracyjne (aktywa + wyceny + transakcje + inflacja)
npm run dev                   # http://localhost:3000
```

Testy: `npm test` · smoke: `npx tsx scripts/smoke-*.ts`

## Komendy bazy danych

| Komenda | Co robi |
|---|---|
| `npm run db:wipe` | Usuwa wszystkie dane (wyceny, transakcje, aktywa, kategorie, user, FX, inflacja, importy) — zachowuje schemat |
| `npm run db:demo` | Importuje dane testowe: 6 aktywów, 54 wyceny, 4 transakcje (akcje → demo FIFO/ROI). Czyści tabele przed seedem |
| `npm run db:inflation` | Importuje inflację (41 miesięcy z `cpi.json`) |
| `npm run db:fresh` | Wszystko w jednym: demo + inflacja (czysta demonstracja) |
| `npm run db:studio` | Prisma Studio — przeglądanie/edycja bazy w przeglądarce (`localhost:5555`) |
| `npm run db:reset` | Pełny reset (drop DB + remigracja + seed) — cięższy |

> Po `db:demo` inflacja jest pusta (demo czyści wszystko). Prawdziwą inflację Eurostat pobierzesz w UI: **Inflacja → ⟳ Sync z Eurostat**, albo `db:fresh` (z `cpi.json`).

## Funkcje

- **Dashboard** — wartość netto w czasie (nominalnie / realnie po inflacji / linia inflacji), KPI, podział aktywów (donut + kompozycja w czasie), tabela aktywów.
- **Aktywa i wyceny** — ręczne dodawanie; klik w aktywo → szczegóły: wykres wycen, transakcje, ROI nominalny + realny, P&L FIFO.
- **Donut kategorii** — klik w kategorię pokazuje aktywa w niej (z udziałem %).
- **Import CSV** — 3 tryby: wyceny (saldo / running balance) i transakcje (historia zakupów). Mapowanie pól, presety (mBank, PKO, XTB, mBank BM, obligacje), detekcja kodowania (Win-1250/UTF-8), walidacja, duplikaty, cofanie importu.
- **FX (NBP)** — automatyczna konwersja na PLN (cache + LKV kursu dla weekendów).
- **Inflacja (Eurostat HICP)** — prawdziwy miesięczny m/m; realna wartość i realny ROI.
- **Eksport** — pełny backup JSON + CSV (wyceny, transakcje), BOM pod polski Excel.

## Deployment na Proxmox VE (LXC)

Jednolinijkowiec — tworzy lub aktualizuje kontener LXC z aplikacją:

```bash
bash -c "$(wget -qLO - https://raw.githubusercontent.com/kamillo/serwatka/refs/heads/master/scripts/serwatka-proxmox.sh)"
```

Kontener: Ubuntu 24.04, Node.js 20, SQLite. Aplikacja dostępna pod IP kontenera na porcie 3000.

**Zmienne (opcjonalne):**

| Zmienna | Domyślnie | Opis |
|---|---|---|
| `CT_ID` | `300` | ID kontenera w Proxmox |
| `RAM` | `1024` | MB RAM |
| `DISK_SIZE` | `4` | GB dysku |
| `NET_MODE` | `dhcp` | `dhcp` lub `static` |
| `GIT_REPO` | `""` | URL do repo (jeśli puste — kopiuje z lokalnych plików) |

**Aktualizacja:** ponowne uruchomienie tego samego skryptu wykrywa istniejący kontener i wykonuje update (pull kodu, rebuild, migracje, restart).

Po instalacji aplikacja dostępna pod `http://<IP-kontenera>:3000`.
