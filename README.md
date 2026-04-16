# NestorSmartHomeAutomation — Home Assistant Addon

WebSocket → REST API bridge pour Home Assistant.  
Permet à une application React (ou tout client WebSocket) de créer et gérer des automations HA via l'API REST interne, contournant les limitations du WebSocket natif HA.

---

## Prérequis

- Home Assistant OS ou Supervised
- Accès SSH ou Samba au dossier `/addons/`
- Un Long-Lived Access Token HA

---

## Installation rapide

```bash
# Copier le dossier dans les addons locaux HA
cp -r NestorSmartHomeAutomation/ /addons/
```

Ensuite dans HA : **Settings → Add-ons → Add-on Store → ⋮ → Check for updates → Local add-ons → WS to REST Bridge → Install**

---

## Configuration

```yaml
ha_token: "votre_long_lived_access_token"
ws_port: 8765
allowed_methods:
  - POST
  - PUT
  - DELETE
```

---

## Utilisation (React)

```js
const ws = new WebSocket("ws://<HA_IP>:8765");

ws.send(JSON.stringify({
  method: "POST",
  endpoint: "/api/config/automation/config/my_automation_id",
  payload: {
    alias: "Mon automatisation",
    trigger: [{ platform: "state", entity_id: "light.salon", to: "on" }],
    condition: [],
    action: [{ service: "notify.mobile_app", data: { message: "Lumière allumée" } }]
  }
}));

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  // { success: true, status: 200, body: { result: "ok" } }
  console.log(response);
};
```

---

## Architecture

```
App React  ──WebSocket──►  NestorSmartHomeAutomation  ──HTTP REST──►  HA API
           ◄─────JSON──────               ◄─────────────
```

---

## Fichiers

| Fichier        | Rôle                                          |
|----------------|-----------------------------------------------|
| `config.yaml`  | Déclaration de l'addon HA                     |
| `Dockerfile`   | Image Node 18 Alpine                          |
| `run.sh`       | Lecture de `/data/options.json` + démarrage   |
| `server.js`    | Serveur WebSocket + relais REST               |
| `package.json` | Dépendances Node.js                           |
| `DOCS.md`      | Documentation complète + exemples             |

---

## Sécurité

- Token jamais exposé dans les logs
- Endpoints restreints à `/api/*`
- Méthodes HTTP filtrées par whitelist configurable
- Token validé au démarrage de l'addon

---

## Documentation complète

Voir [DOCS.md](DOCS.md) pour les détails d'installation, le format des payloads, les exemples React complets et le guide de dépannage.
