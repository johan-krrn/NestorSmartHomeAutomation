# WS to REST Bridge — Home Assistant Addon

Addon Home Assistant qui expose un serveur WebSocket et relaie les requêtes vers l'API REST interne de HA.  
Cas d'usage principal : créer/modifier des automations HA depuis une app React.

---

## Installation

### Méthode 1 — Dossier local

1. Copier le dossier `NestorSmartHomeAutomation/` dans le répertoire `/addons/` de votre installation Home Assistant.
2. Aller dans **Settings → Add-ons → Add-on Store**.
3. Cliquer sur **⋮** (menu 3 points) en haut à droite → **Check for updates**.
4. L'addon **WS to REST Bridge** apparaît dans la section **Local add-ons**.
5. Cliquer dessus → **Install**.

### Méthode 2 — Dépôt GitHub custom

1. Pousser ce dossier dans un dépôt GitHub (à la racine ou dans un sous-dossier).
2. Dans HA : **Settings → Add-ons → Add-on Store → ⋮ → Repositories**.
3. Ajouter l'URL du dépôt GitHub.
4. Rafraîchir, puis installer l'addon.

---

## Configuration

Après installation, aller dans l'onglet **Configuration** de l'addon et renseigner :

| Option            | Type     | Requis | Défaut                   | Description                                      |
|-------------------|----------|--------|--------------------------|--------------------------------------------------|
| `ha_token`        | string   | oui    | —                        | Long-Lived Access Token Home Assistant            |
| `ws_port`         | integer  | non    | `8765`                   | Port d'écoute du serveur WebSocket                |
| `allowed_methods` | string[] | non    | `["POST","PUT","DELETE"]`| Méthodes HTTP autorisées pour les appels REST     |

### Générer un Long-Lived Access Token

1. Dans Home Assistant, cliquer sur votre profil (en bas à gauche).
2. Descendre jusqu'à la section **Long-Lived Access Tokens**.
3. Cliquer sur **Create Token**.
4. Donner un nom (ex : `ws-bridge`) et copier le token.
5. Coller le token dans le champ `ha_token` de la configuration de l'addon.

> ⚠️ Le token n'est affiché qu'une seule fois. Conservez-le en lieu sûr.

---

## Démarrage

1. Sauvegarder la configuration.
2. Cliquer sur **Start**.
3. Vérifier les logs : vous devriez voir :
   ```
   [ws-bridge] Starting WS to REST Bridge on port 8765...
   WebSocket server listening on port 8765
   HA token is valid. API reachable.
   ```

---

## Format du payload (client → addon)

Le client WebSocket envoie un message JSON avec cette structure :

```json
{
  "method": "POST",
  "endpoint": "/api/config/automation/config/my_automation_id",
  "payload": {
    "alias": "Mon automatisation",
    "trigger": [
      {
        "platform": "state",
        "entity_id": "light.salon",
        "to": "on"
      }
    ],
    "condition": [],
    "action": [
      {
        "service": "notify.mobile_app",
        "data": {
          "message": "Lumière allumée"
        }
      }
    ]
  }
}
```

| Champ      | Type   | Requis | Description                                              |
|------------|--------|--------|----------------------------------------------------------|
| `method`   | string | oui    | Méthode HTTP : `POST`, `PUT`, `DELETE`, etc.             |
| `endpoint` | string | oui    | Chemin de l'API REST HA (doit commencer par `/api/`)     |
| `payload`  | object | oui*   | Corps de la requête (* requis pour POST/PUT/PATCH)       |

---

## Format de la réponse (addon → client)

### Succès

```json
{
  "success": true,
  "status": 200,
  "body": {
    "result": "ok"
  }
}
```

### Erreur de validation

```json
{
  "success": false,
  "error": "Method \"GET\" is not allowed. Allowed: POST, PUT, DELETE"
}
```

### Erreur HA injoignable

```json
{
  "success": false,
  "error": "Failed to reach Home Assistant API.",
  "details": "connect ECONNREFUSED 127.0.0.1:80"
}
```

---

## Exemple React / JavaScript

### Connexion et envoi d'une automation

```js
const WS_URL = "ws://<HA_IP>:8765";
let ws;

function connect() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("Connecté au WS Bridge");
  };

  ws.onmessage = (event) => {
    const response = JSON.parse(event.data);
    if (response.success) {
      console.log("Automation créée !", response);
    } else {
      console.error("Erreur :", response.error);
    }
  };

  ws.onclose = () => {
    console.log("Déconnecté. Reconnexion dans 5s...");
    setTimeout(connect, 5000);
  };

  ws.onerror = (err) => {
    console.error("Erreur WebSocket :", err);
  };
}

connect();
```

### Créer une automation

```js
function createAutomation(id, alias, triggers, actions) {
  const message = {
    method: "POST",
    endpoint: `/api/config/automation/config/${id}`,
    payload: {
      alias,
      trigger: triggers,
      condition: [],
      action: actions,
    },
  };
  ws.send(JSON.stringify(message));
}

// Exemple d'utilisation
createAutomation(
  "notif_lumiere_salon",
  "Notification lumière salon",
  [{ platform: "state", entity_id: "light.salon", to: "on" }],
  [{ service: "notify.mobile_app_phone", data: { message: "Lumière du salon allumée !" } }]
);
```

### Supprimer une automation

```js
function deleteAutomation(id) {
  const message = {
    method: "DELETE",
    endpoint: `/api/config/automation/config/${id}`,
    payload: {},
  };
  ws.send(JSON.stringify(message));
}
```

### Lister les automations existantes

> Nécessite d'ajouter `"GET"` dans `allowed_methods` dans la config de l'addon.

```js
function listAutomations() {
  const message = {
    method: "GET",
    endpoint: "/api/states",
    payload: null,
  };
  ws.send(JSON.stringify(message));
}
```

---

## Endpoints HA utiles

| Action                      | Method | Endpoint                                          |
|-----------------------------|--------|---------------------------------------------------|
| Créer/modifier automation   | POST   | `/api/config/automation/config/<automation_id>`    |
| Supprimer automation        | DELETE | `/api/config/automation/config/<automation_id>`    |
| Lister tous les states      | GET    | `/api/states`                                      |
| Obtenir un state            | GET    | `/api/states/<entity_id>`                          |
| Appeler un service          | POST   | `/api/services/<domain>/<service>`                 |
| Vérifier l'API              | GET    | `/api/`                                            |

---

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────────────┐     HTTP REST      ┌─────────────────┐
│   App React  │ ──────────────────►│  WS Bridge Addon │ ──────────────────►│  HA REST API    │
│              │ ◄──────────────────│  (server.js)     │ ◄──────────────────│  (supervisor)   │
└──────────────┘     JSON response  └──────────────────┘     JSON response  └─────────────────┘
```

---

## Sécurité

- Le token HA n'est **jamais** affiché dans les logs.
- L'endpoint doit obligatoirement commencer par `/api/` (protection contre le path traversal).
- Les méthodes HTTP sont filtrées par `allowed_methods`.
- Le token est validé au démarrage de l'addon.
- L'addon tourne dans le réseau Docker interne de HA Supervisor, il n'est donc pas exposé à Internet par défaut.

---

## Dépannage

| Symptôme                              | Solution                                                             |
|---------------------------------------|----------------------------------------------------------------------|
| `HA_TOKEN is not set`                 | Renseigner le token dans la configuration de l'addon                 |
| `Could not validate HA token`         | Vérifier que le token est valide et que HA est démarré               |
| `Method "X" is not allowed`           | Ajouter la méthode dans `allowed_methods` dans la config             |
| `Endpoint must start with "/api/"`    | Vérifier le format de l'endpoint dans le payload                     |
| Pas de réponse du WebSocket           | Vérifier que le port 8765 est bien mappé dans la config réseau       |
