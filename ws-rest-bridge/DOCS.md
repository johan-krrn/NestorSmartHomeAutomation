# WS to REST Bridge — Home Assistant Addon

Addon Home Assistant qui expose un serveur WebSocket et relaie les requêtes vers l'API REST interne de HA.
Cas d'usage principal : créer/modifier des automations HA depuis une app React.

## Installation

1. Dans HA : Settings → Add-ons → Add-on Store → ⋮ → Repositories
2. Ajouter : https://github.com/johan-krrn/NestorSmartHomeAutomation
3. Rafraîchir, puis installer l'addon WS to REST Bridge.

## Configuration

Options disponibles : ha_token (string, requis), ws_port (integer, défaut 8765), allowed_methods (liste, défaut POST/PUT/DELETE).

## Format du payload

{ "method": "POST", "endpoint": "/api/config/automation/config/my_id", "payload": { "alias": "Mon automatisation", "trigger": [], "condition": [], "action": [] } }

## Exemple React

const ws = new WebSocket("ws://<HA_IP>:8765");
ws.send(JSON.stringify({ method: "POST", endpoint: "/api/config/automation/config/my_id", payload: { alias: "Test" } }));
ws.onmessage = (event) => console.log(JSON.parse(event.data));
