#!/bin/sh
set -e

CONFIG_PATH=/data/options.json

export HA_TOKEN=$(jq -r '.ha_token' "$CONFIG_PATH")
export WS_PORT=$(jq -r '.ws_port' "$CONFIG_PATH")
export ALLOWED_METHODS=$(jq -c '.allowed_methods' "$CONFIG_PATH")

echo "[ws-bridge] Starting WS to REST Bridge on port ${WS_PORT}..."

exec node /app/server.js
