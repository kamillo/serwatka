#!/usr/bin/env bash
# serwatka — Net Worth Tracker | Proxmox VE LXC Installer
#
# Instalacja:
#   bash -c "$(wget -qLO - https://raw.githubusercontent.com/kamillo/serwatka/refs/heads/master/scripts/serwatka-proxmox.sh)"
#
# Aktualizacja (re-run z tym samym CT_ID):
#   bash -c "$(wget -qLO - https://raw.githubusercontent.com/kamillo/serwatka/refs/heads/master/scripts/serwatka-proxmox.sh)"

set -euo pipefail

# ─── Kolory ──────────────────────────────────────────────────────────
YW='\033[33m'; GN='\033[32m'; RD='\033[31m'; BL='\033[36m'; CL='\033[m'

# ─── Pomocnicze ──────────────────────────────────────────────────────
msg_info()  { echo -e " ${YW}[INFO]${CL} $*"; }
msg_ok()    { echo -e " ${GN}[OK]${CL}   $*"; }
msg_error() { echo -e " ${RD}[ERR]${CL}  $*"; }
header()    { echo -e "\n ${BL}━━━ $* ━━━${CL}\n"; }

trap 'msg_error "Błąd na linii $LINENO."' ERR

# ─── Konfiguracja ────────────────────────────────────────────────────
CT_ID="${CT_ID:-300}"
CT_NAME="${CT_NAME:-serwatka}"
TEMPLATE="${TEMPLATE:-ubuntu-24.04-standard}"
DISK_SIZE="${DISK_SIZE:-8}"
RAM="${RAM:-1024}"
SWAP="${SWAP:-512}"
APP_DIR="/opt/serwatka"
NODE_VERSION="${NODE_VERSION:-20}"
SERVICE_PORT="${SERVICE_PORT:-3000}"
BRIDGE="${BRIDGE:-vmbr0}"
NET_MODE="${NET_MODE:-dhcp}"
CT_IP="${CT_IP:-192.168.1.200/24}"
CT_GW="${CT_GW:-192.168.1.1}"
GIT_REPO="${GIT_REPO:-https://github.com/kamillo/serwatka.git}"

# ─── Sprawdzenia wstępne ─────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  msg_error "Skrypt wymaga roota (uruchom z sudo lub jako root)."
  exit 1
fi

if ! command -v pct &>/dev/null; then
  msg_error "Brak pct — skrypt musi być uruchomiony na hoście Proxmox VE."
  exit 1
fi

# ─── Wykrywanie storage (wg konwencji community-scripts) ─────────────
# Preferuj: local-lvm (rootfs) + local (szablony) — domyślne w Proxmox.
# Fallback: pierwszy storage obsługujący dany content type.
detect_storage() {
  local content="$1" preferred="$2"
  if pvesm status -content "$content" 2>/dev/null | awk 'NR>1{print $1}' | grep -qx "$preferred"; then
    echo "$preferred"
    return
  fi
  pvesm status -content "$content" 2>/dev/null | awk 'NR>1{print $1; exit}'
}

CONTAINER_STORAGE="${CONTAINER_STORAGE:-$(detect_storage rootdir local-lvm)}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-$(detect_storage vztmpl local)}"

if [[ -z "${CONTAINER_STORAGE}" ]]; then
  msg_error "Brak storage obsługującego kontenery (rootdir). Ustaw CONTAINER_STORAGE ręcznie."
  exit 1
fi
if [[ -z "${TEMPLATE_STORAGE}" ]]; then
  msg_error "Brak storage dla szablonów (vztmpl). Ustaw TEMPLATE_STORAGE ręcznie."
  exit 1
fi

# ─── Wykrywanie trybu ────────────────────────────────────────────────
MODE="install"
if pct status "$CT_ID" &>/dev/null; then
  MODE="update"
fi

header "serwatka — ${MODE^^} na CT $CT_ID"
msg_info "Storage: rootfs=${CONTAINER_STORAGE}, templates=${TEMPLATE_STORAGE}"

# ═════════════════════════════════════════════════════════════════════
#  TRYB: INSTALL
# ═════════════════════════════════════════════════════════════════════
if [[ "$MODE" == "install" ]]; then

  # ── Szablon ───────────────────────────────────────────────────────
  header "Pobieranie szablonu"
  pveam update >/dev/null 2>&1 || true

  # Znajdź dokładną nazwę z available, jeśli podano prefiks
  TEMPLATE_FULL=$(pveam available 2>/dev/null | awk -v t="$TEMPLATE" '$0 ~ t {print $NF; exit}' || true)
  [[ -z "$TEMPLATE_FULL" ]] && TEMPLATE_FULL="$TEMPLATE"

  # Pobierz jeśli nie ma na storage
  if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE_FULL"; then
    msg_info "Pobieranie szablonu: $TEMPLATE_FULL"
    pveam download "$TEMPLATE_STORAGE" "$TEMPLATE_FULL" || true
  fi

  # Zweryfikuj
  if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE_FULL"; then
    msg_error "Nie znaleziono szablonu '$TEMPLATE'. Dostępne: pveam available --section system"
    exit 1
  fi
  msg_ok "Szablon: $TEMPLATE_FULL"

  # ── Tworzenie kontenera ───────────────────────────────────────────
  header "Tworzenie kontenera $CT_NAME (CT $CT_ID)"
  if [[ "$NET_MODE" == "static" ]]; then
    NET0="name=eth0,bridge=${BRIDGE},ip=${CT_IP},gw=${CT_GW}"
  else
    NET0="name=eth0,bridge=${BRIDGE},ip=dhcp"
  fi

  pct create "$CT_ID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE_FULL}" \
    --hostname "$CT_NAME" \
    --rootfs "${CONTAINER_STORAGE}:${DISK_SIZE}" \
    --memory "$RAM" \
    --swap "$SWAP" \
    --unprivileged 1 \
    --features nesting=1 \
    --onboot 1 \
    --password "serwatka" \
    --net0 "$NET0" \
    --start 1

  msg_info "Czekam na uruchomienie kontenera..."
  sleep 10
  msg_ok "Kontener uruchomiony"

  # ── Instalacja Node.js ────────────────────────────────────────────
  header "Instalacja Node.js $NODE_VERSION"
  pct exec "$CT_ID" -- bash -lc "
    set -euo pipefail
    apt-get update -qq
    apt-get install -y -qq curl git build-essential python3 ca-certificates
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs
    apt-get clean
  "
  msg_ok "Node.js $(pct exec "$CT_ID" -- node --version)"

  # ── Klonowanie repozytorium ───────────────────────────────────────
  header "Pobieranie kodu aplikacji"
  pct exec "$CT_ID" -- bash -lc "mkdir -p ${APP_DIR}"
  pct exec "$CT_ID" -- bash -lc "
    set -euo pipefail
    git clone --depth 1 '${GIT_REPO}' /tmp/serwatka
    cp -a /tmp/serwatka/. ${APP_DIR}/
    rm -rf /tmp/serwatka
  "
  msg_ok "Kod pobrany z ${GIT_REPO}"

  # ── Konfiguracja środowiska ───────────────────────────────────────
  msg_info "Tworzenie .env"
  pct exec "$CT_ID" -- bash -lc "mkdir -p ${APP_DIR}/data"
  pct exec "$CT_ID" -- bash -lc "printf 'DATABASE_URL=\"file:${APP_DIR}/data/serwatka.db\"\n' > ${APP_DIR}/.env"
  msg_ok ".env utworzony"

  # ── Build (wymaga WSZYSTKICH deps: tailwind/ts/typescript to devDeps) ──
  header "Budowanie aplikacji"
  msg_info "Instalacja zależności (npm ci)"
  pct exec "$CT_ID" -- bash -lc "cd ${APP_DIR} && npm ci"
  msg_ok "Zależności zainstalowane"

  msg_info "Generowanie klienta Prisma"
  pct exec "$CT_ID" -- bash -lc "cd ${APP_DIR} && npx prisma generate"
  msg_ok "Klient Prisma gotowy"

  msg_info "Budowanie Next.js (next build)"
  pct exec "$CT_ID" -- bash -lc "cd ${APP_DIR} && npm run build"
  msg_ok "Build ukończony"

  # ── Baza danych ───────────────────────────────────────────────────
  header "Konfiguracja bazy danych"
  msg_info "Migracje Prisma"
  pct exec "$CT_ID" -- bash -lc "cd ${APP_DIR} && npx prisma migrate deploy"
  msg_ok "Migracje zastosowane"

  msg_info "Seed danych demo + inflacja"
  pct exec "$CT_ID" -- bash -lc "cd ${APP_DIR} && npm run db:fresh" || msg_info "(seed pominięty)"
  msg_ok "Baza gotowa"

  # ── Oczyszczenie dev deps (lean runtime) ──────────────────────────
  msg_info "Oczyszczanie zależności dev (npm prune)"
  pct exec "$CT_ID" -- bash -lc "cd ${APP_DIR} && npm prune --omit=dev"
  msg_ok "Runtime zoptymalizowany"

  # ── Serwis systemd ────────────────────────────────────────────────
  header "Konfiguracja serwisu"
  pct exec "$CT_ID" -- bash -lc "cat > /etc/systemd/system/serwatka.service <<'SVCEOF'
[Unit]
Description=serwatka — Net Worth Tracker
After=network-online.target
Wants=network-online.target

[Service]
Type=exec
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/npm run start
Environment=NODE_ENV=production
Environment=PORT=${SERVICE_PORT}
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF"
  pct exec "$CT_ID" -- bash -lc "systemctl daemon-reload && systemctl enable --now serwatka"
  msg_ok "serwatka.service uruchomiony"

fi

# ═════════════════════════════════════════════════════════════════════
#  TRYB: UPDATE
# ═════════════════════════════════════════════════════════════════════
if [[ "$MODE" == "update" ]]; then

  msg_ok "Kontener CT $CT_ID istnieje — tryb aktualizacji"

  # ── Pobranie najnowszego kodu ─────────────────────────────────────
  header "Aktualizacja kodu"
  msg_info "git pull"
  pct exec "$CT_ID" -- bash -lc "
    set -euo pipefail
    cd ${APP_DIR}
    git pull 2>/dev/null || {
      rm -rf /tmp/serwatka-upd
      git clone --depth 1 '${GIT_REPO}' /tmp/serwatka-upd
      cp -a /tmp/serwatka-upd/. ${APP_DIR}/
      rm -rf /tmp/serwatka-upd
    }
  "
  msg_ok "Kod zaktualizowany"

  # ── Rebuild ───────────────────────────────────────────────────────
  header "Przebudowa aplikacji"
  pct exec "$CT_ID" -- bash -lc "cd ${APP_DIR} && npm ci"
  msg_ok "Zależności zaktualizowane"

  pct exec "$CT_ID" -- bash -lc "cd ${APP_DIR} && npx prisma generate"
  msg_ok "Klient Prisma zregenerowany"

  msg_info "Budowanie Next.js"
  pct exec "$CT_ID" -- bash -lc "cd ${APP_DIR} && npm run build"
  msg_ok "Build ukończony"

  # ── Migracje ──────────────────────────────────────────────────────
  msg_info "Migracje"
  pct exec "$CT_ID" -- bash -lc "cd ${APP_DIR} && npx prisma migrate deploy"
  msg_ok "Migracje aktualne"

  # ── Oczyszczenie + restart ────────────────────────────────────────
  pct exec "$CT_ID" -- bash -lc "cd ${APP_DIR} && npm prune --omit=dev"
  header "Restart serwisu"
  pct exec "$CT_ID" -- bash -lc "systemctl restart serwatka"
  msg_ok "serwatka.service zrestartowany"

fi

# ═════════════════════════════════════════════════════════════════════
#  PODSUMOWANIE
# ═════════════════════════════════════════════════════════════════════
CT_IP_ADDR=$(pct exec "$CT_ID" -- bash -lc "hostname -I 2>/dev/null | awk '{print \$1}'" 2>/dev/null || echo "?")

echo ""
echo -e " ${BL}══════════════════════════════════════════════════${CL}"
echo -e " ${GN}  ✅  serwatka — ${MODE^^} na CT $CT_ID ukończony${CL}"
echo -e " ${BL}══════════════════════════════════════════════════${CL}"
echo ""
echo -e "  ${YW}URL:${CL}  http://${CT_IP_ADDR}:${SERVICE_PORT}"
echo ""
echo -e "  ${YW}Zarządzanie:${CL}"
echo -e "    pct enter ${CT_ID}                    # shell w kontenerze"
echo -e "    pct exec ${CT_ID} -- journalctl -u serwatka -f   # logi"
echo -e "    pct stop ${CT_ID}                     # stop"
echo -e "    pct start ${CT_ID}                    # start"
echo -e "    pct destroy ${CT_ID}                  # usuń (dodaj --force)"
echo ""
echo -e "  ${YW}Aktualizacja:${CL}  ponownie uruchom ten sam skrypt"
echo ""
echo -e "  ${YW}Backup bazy:${CL}"
echo -e "    pct pull ${CT_ID} ${APP_DIR}/data/serwatka.db ./"
echo ""
