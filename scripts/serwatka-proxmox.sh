#!/usr/bin/env bash

# serwatka — Net Worth Tracker
# Proxmox VE LXC Container Installer / Updater
# Author: serwatka
# License: MIT
#
# Install:
#   bash -c "$(wget -qLO - https://raw.githubusercontent.com/user/serwatka/main/scripts/serwatka-proxmox.sh)"
#
# Update (re-run with same CT_ID):
#   bash -c "$(wget -qLO - https://raw.githubusercontent.com/user/serwatka/main/scripts/serwatka-proxmox.sh)"

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────
YW=$(echo "\033[33m")
GN=$(echo "\033[32m")
RD=$(echo "\033[31m")
BL=$(echo "\033[36m")
CL=$(echo "\033[m")

# ─── Helpers ─────────────────────────────────────────────────────────
msg_info()  { echo -e " ${YW}[INFO]${CL} ${*}$(echo "\033[0m")"; }
msg_ok()    { echo -e " ${GN}[OK]${CL}   ${*}$(echo "\033[0m")"; }
msg_error() { echo -e " ${RD}[ERR]${CL}  ${*}$(echo "\033[0m")"; }
header()    { echo -e "\n ${BL}━━━ ${*} ━━━${CL}\n"; }

catch_errors() {
  set -Euo pipefail
  trap 'msg_error "Something went wrong on line $LINENO."' ERR
}

check_root() {
  if [[ $EUID -ne 0 ]]; then
    msg_error "This script must be run as root (or with sudo)."
    exit 1
  fi
}

# ─── Defaults ────────────────────────────────────────────────────────
CT_ID="${CT_ID:-300}"
CT_NAME="${CT_NAME:-serwatka}"
TEMPLATE="${TEMPLATE:-ubuntu-24.04-standard_24.04-2_amd64.tar.zst}"
STORAGE="${STORAGE:-local}"
DISK_SIZE="${DISK_SIZE:-4}"
RAM="${RAM:-1024}"
SWAP="${SWAP:-512}"
APP_DIR="/opt/serwatka"
NODE_VERSION="20"
SERVICE_PORT="3000"
BRIDGE="${BRIDGE:-vmbr0}"

GIT_REPO="${GIT_REPO:-}"

NET_MODE="${NET_MODE:-dhcp}"
CT_IP="${CT_IP:-192.168.1.200/24}"
CT_GW="${CT_GW:-192.168.1.1}"

# ─── Mode detection ──────────────────────────────────────────────────
MODE="install"
if pct status "$CT_ID" &>/dev/null; then
  MODE="update"
fi

# ─── Check prerequisites (both modes) ────────────────────────────────
catch_errors
check_root

header "serwatka — $(echo "$MODE" | tr 'a-z' 'A-Z') on CT $CT_ID"

if [[ -z "$GIT_REPO" && "$MODE" == "install" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if [[ ! -f "$SCRIPT_DIR/package.json" ]]; then
    msg_error "No package.json found and GIT_REPO is not set."
    msg_error "Either run from project root, set GIT_REPO, or use update mode."
    exit 1
  fi
fi

# ═══════════════════════════════════════════════════════════════════
#  MODE: INSTALL (container does not exist yet)
# ═══════════════════════════════════════════════════════════════════
if [[ "$MODE" == "install" ]]; then

# ── Template ──────────────────────────────────────────────────────
TEMPLATE_PATH="/var/lib/vz/template/cache/$TEMPLATE"
if [[ ! -f "$TEMPLATE_PATH" ]]; then
  msg_info "Downloading template: $TEMPLATE"
  pveam update >/dev/null 2>&1
  pveam download "$STORAGE" "$TEMPLATE" || {
    msg_error "Failed to download template. Check STORAGE ($STORAGE) and TEMPLATE ($TEMPLATE)."
    exit 1
  }
  msg_ok "Template downloaded"
else
  msg_ok "Template found: $TEMPLATE"
fi

# ── Create container ──────────────────────────────────────────────
header "Creating container $CT_NAME (CT $CT_ID)"

if [[ "$NET_MODE" == "static" ]]; then
  NET_ARGS="--net0 name=eth0,bridge=$BRIDGE,ip=$CT_IP,gw=$CT_GW"
else
  NET_ARGS="--net0 name=eth0,bridge=$BRIDGE,ip=dhcp"
fi

pct create "$CT_ID" "$TEMPLATE_PATH" \
  --hostname "$CT_NAME" \
  --storage "$STORAGE" \
  --rootfs "$STORAGE:$DISK_SIZE" \
  --memory "$RAM" \
  --swap "$SWAP" \
  --unprivileged 1 \
  --features nesting=1 \
  --password "serwatka" \
  $NET_ARGS \
  --start 1

msg_info "Waiting for container to boot..."
sleep 10
msg_ok "Container created and running"

# ── Install Node.js ───────────────────────────────────────────────
header "Installing Node.js $NODE_VERSION"

pct exec "$CT_ID" -- bash -c "
  set -euo pipefail
  apt-get update -qq
  apt-get install -y -qq curl git build-essential python3 2>/dev/null
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
"
msg_ok "Node.js $(pct exec "$CT_ID" -- node --version) installed"

# ── Deploy app source ─────────────────────────────────────────────
header "Deploying application"

pct exec "$CT_ID" -- mkdir -p "$APP_DIR"

if [[ -n "$GIT_REPO" ]]; then
  msg_info "Cloning from $GIT_REPO"
  pct exec "$CT_ID" -- bash -c "
    cd /tmp
    git clone --depth 1 '$GIT_REPO' repo
    cp -r /tmp/repo/* /tmp/repo/.* \"$APP_DIR/\" 2>/dev/null || true
    rm -rf /tmp/repo
  "
  msg_ok "Source cloned from Git"
else
  msg_info "Copying local files to container"
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  git ls-files 2>/dev/null || find . -not -path './node_modules/*' -not -path './.next/*' -not -path './.git/*' -type f | while IFS= read -r file; do
    pct exec "$CT_ID" -- mkdir -p "$(dirname "$APP_DIR/$file")" 2>/dev/null
    pct push "$CT_ID" "$file" "$APP_DIR/$file"
  done
  msg_ok "Local files copied"
fi

# ── .env ──────────────────────────────────────────────────────────
msg_info "Creating .env"
pct exec "$CT_ID" -- bash -c "
  cat > $APP_DIR/.env << 'ENVEOF'
DATABASE_URL=\"file:${APP_DIR}/data/serwatka.db\"
ENVEOF
  mkdir -p $APP_DIR/data
"
msg_ok ".env created"

# ── Build ─────────────────────────────────────────────────────────
header "Building application"

msg_info "Installing production dependencies"
pct exec "$CT_ID" -- bash -c "cd $APP_DIR && npm ci --omit=dev"
msg_ok "Dependencies installed"

msg_info "Generating Prisma client"
pct exec "$CT_ID" -- bash -c "cd $APP_DIR && npx prisma generate"
msg_ok "Prisma client generated"

msg_info "Building Next.js"
pct exec "$CT_ID" -- bash -c "cd $APP_DIR && npm run build"
msg_ok "Build complete"

# ── Database ──────────────────────────────────────────────────────
header "Database setup"

msg_info "Running migrations"
pct exec "$CT_ID" -- bash -c "cd $APP_DIR && npx prisma migrate deploy"
msg_ok "Migrations applied"

msg_info "Seeding demo data + inflation"
pct exec "$CT_ID" -- bash -c "cd $APP_DIR && npm run db:fresh 2>/dev/null" || true
msg_ok "Database seeded"

# ── systemd service ───────────────────────────────────────────────
header "Service setup"

pct exec "$CT_ID" -- bash -c "
  cat > /etc/systemd/system/serwatka.service << 'SERVICEEOF'
[Unit]
Description=serwatka — Net Worth Tracker
After=network-online.target
Wants=network-online.target

[Service]
Type=exec
User=nobody
Group=nogroup
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npm run start
Environment=NODE_ENV=production
Environment=PORT=$SERVICE_PORT
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEEOF

  systemctl daemon-reload
  systemctl enable --now serwatka
"
msg_ok "serwatka.service enabled and started"

fi # end of install mode

# ═══════════════════════════════════════════════════════════════════
#  MODE: UPDATE (container already exists)
# ═══════════════════════════════════════════════════════════════════
if [[ "$MODE" == "update" ]]; then

  msg_ok "Container CT $CT_ID ($CT_NAME) found — entering update mode"

  # ── Pull latest source ──────────────────────────────────────────
  header "Updating application source"

  if [[ -n "$GIT_REPO" ]]; then
    msg_info "Pulling from $GIT_REPO"
    pct exec "$CT_ID" -- bash -c "
      cd '$APP_DIR' && git pull 2>/dev/null || {
        cd /tmp
        rm -rf repo
        git clone --depth 1 '$GIT_REPO' repo
        cp -r /tmp/repo/* /tmp/repo/.* '$APP_DIR/' 2>/dev/null || true
        rm -rf /tmp/repo
      }
    "
    msg_ok "Source updated from Git"
  else
    msg_info "Copying local files to container"
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    cd "$SCRIPT_DIR"
    git ls-files 2>/dev/null || find . -not -path './node_modules/*' -not -path './.next/*' -not -path './.git/*' -type f | while IFS= read -r file; do
      pct exec "$CT_ID" -- mkdir -p "$(dirname "$APP_DIR/$file")" 2>/dev/null
      pct push "$CT_ID" "$file" "$APP_DIR/$file"
    done
    msg_ok "Local files copied"
  fi

  # ── Rebuild ─────────────────────────────────────────────────────
  header "Rebuilding application"

  msg_info "Installing production dependencies"
  pct exec "$CT_ID" -- bash -c "cd $APP_DIR && npm ci --omit=dev"
  msg_ok "Dependencies installed"

  msg_info "Regenerating Prisma client"
  pct exec "$CT_ID" -- bash -c "cd $APP_DIR && npx prisma generate"
  msg_ok "Prisma client regenerated"

  msg_info "Building Next.js"
  pct exec "$CT_ID" -- bash -c "cd $APP_DIR && npm run build"
  msg_ok "Build complete"

  # ── Migrate DB ──────────────────────────────────────────────────
  header "Database migration"

  msg_info "Running new migrations (if any)"
  pct exec "$CT_ID" -- bash -c "cd $APP_DIR && npx prisma migrate deploy"
  msg_ok "Migrations up to date"

  # ── Restart service ─────────────────────────────────────────────
  header "Restarting service"

  msg_info "Restarting serwatka.service"
  pct exec "$CT_ID" -- systemctl restart serwatka
  msg_ok "Service restarted"

fi # end of update mode

# ═══════════════════════════════════════════════════════════════════
#  SUMMARY (both modes)
# ═══════════════════════════════════════════════════════════════════
CT_IP_ADDR=$(pct exec "$CT_ID" -- bash -c "hostname -I | awk '{print \$1}'" 2>/dev/null || echo "<check container IP>")

echo ""
echo -e " ${BL}══════════════════════════════════════════════════${CL}"
echo -e " ${GN}  ✅  serwatka $(echo "$MODE" | tr 'a-z' 'A-Z')ed on CT $CT_ID${CL}"
echo -e " ${BL}══════════════════════════════════════════════════${CL}"
echo ""
echo -e "  ${YW}URL:${CL}  http://$CT_IP_ADDR:$SERVICE_PORT"
echo ""
echo -e "  ${YW}Management:${CL}"
echo -e "  pct enter $CT_ID            # shell"
echo -e "  pct stop $CT_ID             # stop"
echo -e "  pct start $CT_ID            # start"
echo -e "  pct destroy $CT_ID          # delete (add --force if running)"
echo ""
echo -e "  ${YW}Logs:${CL}"
echo -e "  pct enter $CT_ID -- journalctl -u serwatka -f"
echo ""
echo -e "  ${YW}Re-run this script to update:${CL}"
echo -e "  GIT_REPO=... CT_ID=$CT_ID bash scripts/serwatka-proxmox.sh"
echo ""
echo -e "  ${YW}Database backup:${CL}"
echo -e "  pct pull $CT_ID $APP_DIR/data/serwatka.db ./"
echo ""
