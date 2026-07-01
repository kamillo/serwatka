#!/usr/bin/env bash
# serwatka — Proxmox LXC container setup
# Usage:
#   sudo ./scripts/proxmox-setup.sh
#
# Run this directly on the Proxmox VE host (or via SSH).
# Creates a Ubuntu 24.04 LXC, installs Node.js, copies the app, builds it,
# and sets up a systemd service with optional iptables port forwarding.

set -euo pipefail

# === CONFIGURATION ===
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
# If BRIDGED=true, container gets its own IP — access directly.
# If BRIDGED=false, uses iptables DNAT from HOST_IP:HOST_PORT → container.
BRIDGED="${BRIDGED:-true}"
CT_IP="${CT_IP:-192.168.1.200/24}"
CT_GW="${CT_GW:-192.168.1.1}"
BRIDGE="${BRIDGE:-vmbr0}"
# Only used when BRIDGED=false:
HOST_IP="${HOST_IP:-0.0.0.0}"
HOST_PORT="${HOST_PORT:-3000}"

# === Step 1: Check prerequisites ===
if ! command -v pct &>/dev/null; then
  echo "ERROR: This script must be run on a Proxmox VE host (pct not found)."
  exit 1
fi

if pct status "$CT_ID" &>/dev/null; then
  echo "ERROR: Container ID $CT_ID already exists."
  exit 1
fi

# === Step 2: Download template if missing ===
TEMPLATE_PATH="/var/lib/vz/template/cache/$TEMPLATE"
if [ ! -f "$TEMPLATE_PATH" ]; then
  echo "==> Downloading template $TEMPLATE ..."
  pveam update
  pveam download "$STORAGE" "$TEMPLATE"
  # pveam download puts it in /var/lib/vz/template/cache/
fi

# === Step 3: Create container ===
echo "==> Creating LXC container $CT_ID ($CT_NAME) ..."
pct create "$CT_ID" "$TEMPLATE_PATH" \
  --hostname "$CT_NAME" \
  --storage "$STORAGE" \
  --rootfs "$STORAGE:$DISK_SIZE" \
  --memory "$RAM" \
  --swap "$SWAP" \
  --unprivileged 1 \
  --features nesting=1 \
  --password "serwatka" \
  --start 1

echo "    Waiting for container to boot..."
sleep 10

# === Step 4: Configure networking ===
if [ "$BRIDGED" = true ]; then
  echo "==> Configuring bridged network ($CT_IP on $BRIDGE) ..."
  pct set "$CT_ID" --net0 name=eth0,bridge="$BRIDGE",ip="$CT_IP",gw="$CT_GW"
else
  echo "==> Configuring internal network (NAT) ..."
  pct set "$CT_ID" --net0 name=eth0,bridge="$BRIDGE",ip=dhcp
  # Get container IP from DHCP
  sleep 5
fi
pct reboot "$CT_ID"
sleep 10

# === Step 5: Install Node.js + build tools ===
echo "==> Installing Node.js $NODE_VERSION and build tools ..."
pct enter "$CT_ID" -- bash -c "
  set -euo pipefail
  apt-get update -qq
  apt-get install -y -qq curl git build-essential python3
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
  node --version && npm --version
"

# === Step 6: Create app directory and push files ===
echo "==> Creating $APP_DIR in container ..."
pct enter "$CT_ID" -- mkdir -p "$APP_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "==> Copying app files from $SCRIPT_DIR ..."
cd "$SCRIPT_DIR"
git ls-files | while IFS= read -r file; do
  pct enter "$CT_ID" -- mkdir -p "$(dirname "$APP_DIR/$file")" 2>/dev/null
  pct push "$CT_ID" "$file" "$APP_DIR/$file"
done

# === Step 7: Create .env in container ===
echo "==> Creating .env file ..."
pct enter "$CT_ID" -- bash -c "
  cat > $APP_DIR/.env << 'ENVEOF'
DATABASE_URL=\"file:${APP_DIR}/data/serwatka.db\"
ENVEOF
"

# === Step 8: Create data directory ===
pct enter "$CT_ID" -- mkdir -p "$APP_DIR/data"

# === Step 9: Install dependencies and build ===
echo "==> Installing npm dependencies (production only) ..."
pct enter "$CT_ID" -- bash -c "
  cd $APP_DIR && npm ci --omit=dev
"

echo "==> Building Next.js app ..."
pct enter "$CT_ID" -- bash -c "
  cd $APP_DIR
  npx prisma generate
  npm run build
"

# === Step 10: Run migrations + seed ===
echo "==> Running database migrations ..."
pct enter "$CT_ID" -- bash -c "
  cd $APP_DIR && npx prisma migrate deploy
"

echo "==> Seeding database (demo + inflation) ..."
pct enter "$CT_ID" -- bash -c "
  cd $APP_DIR
  npm run db:fresh 2>/dev/null || echo '    (seed skipped)'
"

# === Step 11: Set up systemd service ===
echo "==> Creating systemd service ..."
pct enter "$CT_ID" -- bash -c "
  cat > /etc/systemd/system/serwatka.service << 'SERVICEEOF'
[Unit]
Description=serwatka — Net Worth Tracker (Next.js)
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

# === Step 12: Port forwarding (NAT mode only) ===
if [ "$BRIDGED" = false ]; then
  # Get container IP
  CT_IP_ADDR=$(pct enter "$CT_ID" -- hostname -I | tr -d '[:space:]' | awk '{print $1}')
  echo "==> Setting up iptables DNAT: $HOST_IP:$HOST_PORT → $CT_IP_ADDR:$SERVICE_PORT ..."
  iptables -t nat -A PREROUTING -p tcp --dport "$HOST_PORT" -d "$HOST_IP" -j DNAT --to-destination "$CT_IP_ADDR:$SERVICE_PORT"
  iptables -A FORWARD -p tcp -d "$CT_IP_ADDR" --dport "$SERVICE_PORT" -j ACCEPT
  # Make persistent
  apt-get install -y iptables-persistent 2>/dev/null || true
  netfilter-persistent save 2>/dev/null || true
fi

# === Done ===
if [ "$BRIDGED" = true ]; then
  ACCESS_URL="http://${CT_IP%/*}:$SERVICE_PORT"
else
  ACCESS_URL="http://$HOST_IP:$HOST_PORT"
fi

echo ""
echo "============================================"
echo "  ✅ Proxmox container $CT_NAME (CT $CT_ID) ready!"
echo "============================================"
echo ""
echo "  App URL:    $ACCESS_URL"
echo "  Root shell: pct enter $CT_ID"
echo ""
echo "  Useful Proxmox commands:"
echo "    pct list                          # list containers"
echo "    pct enter $CT_ID                    # shell into container"
echo "    pct stop $CT_ID                     # stop"
echo "    pct start $CT_ID                    # start"
echo "    pct reboot $CT_ID                   # restart"
echo "    pct destroy $CT_ID                  # delete (add --force if running)"
echo "    pct config $CT_ID                   # show config"
echo ""
echo "  Logs:"
echo "    pct enter $CT_ID -- journalctl -u serwatka -f"
echo ""
echo "  Backup SQLite DB:"
echo "    pct push $CT_ID $APP_DIR/data/serwatka.db ./backup/"
echo ""
