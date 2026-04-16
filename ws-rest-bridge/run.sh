#!/bin/sh
set -e

CONFIG_PATH=/data/options.json

export HA_TOKEN=$(node -p "require('${CONFIG_PATH}').ha_token")
export WS_PORT=$(node -p "require('${CONFIG_PATH}').ws_port")
export ALLOWED_METHODS=$(node -p "JSON.stringify(require('${CONFIG_PATH}').allowed_methods)")

echo "[ws-bridge] Starting WS to REST Bridge on port ${WS_PORT}..."

exec node /app/server.js