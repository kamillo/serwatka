#!/usr/bin/env bash
# LXC container setup for serwatka (Net Worth Tracker)
# Usage:
#   chmod +x scripts/lxc-setup.sh
#   sudo ./scripts/lxc-setup.sh
#
# Prerequisites: Linux host with LXD installed (sudo snap install lxd)
# This script creates a Ubuntu 24.04 LXC container, installs Node.js,
# copies the app source, builds it, and sets up a systemd service.

set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-serwatka}"
IMAGE="ubuntu:24.04"
APP_DIR="/opt/serwatka"
NODE_VERSION="20"
SERVICE_PORT="3000"
HOST_PORT="${HOST_PORT:-3000}"
LXC_PROFILE="${LXC_PROFILE:-default}"

# --- Step 1: Check prerequisites ---
if ! command -v lxc &>/dev/null; then
  echo "ERROR: LXD (lxc) not found. Install it first:"
  echo "  sudo snap install lxd && sudo lxd init --auto"
  exit 1
fi

echo "==> Creating LXC container '$CONTAINER_NAME' from $IMAGE ..."
lxc launch "$IMAGE" "$CONTAINER_NAME" --profile "$LXC_PROFILE"
echo "    Waiting for container to boot..."
sleep 10

# --- Step 2: Install Node.js + build tools inside container ---
echo "==> Installing Node.js $NODE_VERSION and build tools ..."
lxc exec "$CONTAINER_NAME" -- bash -c "
  set -euo pipefail
  apt-get update -qq
  apt-get install -y -qq curl git build-essential python3
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
  node --version && npm --version
"

# --- Step 3: Create app directory and push files ---
echo "==> Creating $APP_DIR in container ..."
lxc exec "$CONTAINER_NAME" -- mkdir -p "$APP_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "==> Copying app files from $SCRIPT_DIR to container ..."
# Push all tracked files (git-tracked) to the container
cd "$SCRIPT_DIR"
git ls-files | while IFS= read -r file; do
  # Create parent directories
  lxc exec "$CONTAINER_NAME" -- mkdir -p "$(dirname "$APP_DIR/$file")" 2>/dev/null
  # Push the file (skip node_modules and .next)
  lxc file push "$file" "$CONTAINER_NAME$APP_DIR/$file"
done

# --- Step 4: Create .env in container ---
echo "==> Creating .env file in container ..."
lxc exec "$CONTAINER_NAME" -- bash -c "
  cat > $APP_DIR/.env << 'ENVEOF'
# Database — SQLite (production, stored on persistent volume)
DATABASE_URL=\"file:${APP_DIR}/data/serwatka.db\"
ENVEOF
"

# --- Step 5: Create data directory (for SQLite DB persistence) ---
echo "==> Preparing data directory ..."
lxc exec "$CONTAINER_NAME" -- mkdir -p "$APP_DIR/data"

# --- Step 6: Install dependencies and build inside container ---
echo "==> Installing npm dependencies ..."
lxc exec "$CONTAINER_NAME" -- bash -c "
  cd $APP_DIR
  npm ci --omit=dev
"

echo "==> Building Next.js app ..."
lxc exec "$CONTAINER_NAME" -- bash -c "
  cd $APP_DIR
  npx prisma generate
  npm run build
"

# --- Step 7: Generate Prisma client + run migrations ---
echo "==> Running database migrations ..."
lxc exec "$CONTAINER_NAME" -- bash -c "
  cd $APP_DIR
  npx prisma migrate deploy
"

# --- Step 8: Seed database with demo data ---
echo "==> Seeding database (demo + inflation) ..."
lxc exec "$CONTAINER_NAME" -- bash -c "
  cd $APP_DIR
  npm run db:fresh 2>/dev/null || echo '    (seed skipped — already populated or no seed script)'
"

# --- Step 9: Set up systemd service ---
echo "==> Creating systemd service ..."
lxc exec "$CONTAINER_NAME" -- bash -c "
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

# --- Step 10: Configure network proxy (container port → host) ---
echo "==> Setting up port forwarding (host:$HOST_PORT → container:$SERVICE_PORT) ..."
lxc config device add "$CONTAINER_NAME" http-proxy proxy \
  listen=tcp:0.0.0.0:$HOST_PORT \
  connect=tcp:127.0.0.1:$SERVICE_PORT

# --- Step 11: Show status ---
echo ""
echo "========================================"
echo "  ✅ LXC container '$CONTAINER_NAME' ready!"
echo "========================================"
echo ""
echo "  App URL:    http://<host-ip>:$HOST_PORT"
echo ""
echo "  Useful commands:"
echo "    lxc list                     # list containers"
echo "    lxc exec $CONTAINER_NAME bash   # shell into container"
echo "    lxc info $CONTAINER_NAME        # container info"
echo "    lxc stop $CONTAINER_NAME        # stop"
echo "    lxc start $CONTAINER_NAME       # start"
echo "    lxc delete $CONTAINER_NAME      # delete (use --force if running)"
echo ""
echo "  Logs:"
echo "    lxc exec $CONTAINER_NAME -- journalctl -u serwatka -f"
echo ""
echo "  Backup SQLite DB:"
echo "    lxc file pull $CONTAINER_NAME$APP_DIR/data/serwatka.db ./backup/"
echo ""
