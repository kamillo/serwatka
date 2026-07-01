This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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

## Komendy

| Komenda | Co robi |
|---|---|
| `npm run db:wipe` | Usuwa wszystkie dane (wyceny, transakcje, aktywa, kategorie, user, FX, inflacja, importy) — zachowuje schemat |
| `npm run db:demo` | Importuje dane testowe: 6 aktywów, 54 wyceny, 4 transakcje (akcje → demo FIFO/ROI). Czyści tabele przed seedem |
| `npm run db:inflation` | Importuje inflację (41 miesięcy z cpi.json) |
| `npm run db:fresh` | Wszystko w jednym: demo + inflacja (czysta demonstracja) |
| `npm run db:studio` | Prisma Studio — przeglądanie/edycja bazy w przeglądarce (localhost:5555) |
| `npm run db:reset` | Pełny reset (drop DB + remigracja + seed) — cięższy |

