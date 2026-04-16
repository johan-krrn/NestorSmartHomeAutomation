"use strict";

const http = require("http");
const https = require("https");
const { WebSocketServer } = require("ws");

const HA_TOKEN = process.env.HA_TOKEN;
const WS_PORT = parseInt(process.env.WS_PORT, 10) || 8765;
const ALLOWED_METHODS = (() => {
  try {
    return JSON.parse(process.env.ALLOWED_METHODS || '["POST","PUT","DELETE"]');
  } catch {
    return ["POST", "PUT", "DELETE"];
  }
})();

const HA_BASE_URL = "http://homeassistant:8123";

function log(level, msg, meta) {
  const ts = new Date().toISOString();
  const line = meta
    ? `[${ts}] [${level}] ${msg} ${JSON.stringify(meta)}`
    : `[${ts}] [${level}] ${msg}`;
  if (level === "ERROR") {
    console.error(line);
  } else {
    console.log(line);
  }
}

function callHA(method, endpoint, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, HA_BASE_URL);
    const body = payload != null ? JSON.stringify(payload) : null;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: {
        Authorization: `Bearer ${HA_TOKEN}`,
        "Content-Type": "application/json",
      },
    };
    if (body) options.headers["Content-Length"] = Buffer.byteLength(body);
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8");
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", (err) => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

async function validateToken() {
  log("INFO", "Validating HA token...");
  try {
    const result = await callHA("GET", "/api/", null);
    if (result.status === 200) { log("INFO", "HA token is valid. API reachable."); return true; }
    log("ERROR", `HA returned status ${result.status} during token validation.`);
    return false;
  } catch (err) {
    log("ERROR", "Cannot reach HA API during token validation.", { error: err.message });
    return false;
  }
}

function validateMessage(data) {
  if (!data || typeof data !== "object") return "Message must be a JSON object.";
  if (typeof data.method !== "string" || !data.method.trim()) return 'Missing or invalid "method" field.';
  if (typeof data.endpoint !== "string" || !data.endpoint.trim()) return 'Missing or invalid "endpoint" field.';
  if (!data.endpoint.startsWith("/api/")) return 'Endpoint must start with "/api/".';
  const method = data.method.toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) return `Method "${method}" is not allowed. Allowed: ${ALLOWED_METHODS.join(", ")}`;
  if (["POST", "PUT", "PATCH"].includes(method) && data.payload == null) return `Payload is required for ${method} requests.`;
  return null;
}

async function callHAWithRetry(method, endpoint, payload, retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await callHA(method, endpoint, payload);
    } catch (err) {
      log("ERROR", `HA request failed (attempt ${attempt}/${retries}).`, { error: err.message });
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  if (!HA_TOKEN) { log("ERROR", "HA_TOKEN is not set. Aborting."); process.exit(1); }
  const tokenValid = await validateToken();
  if (!tokenValid) log("ERROR", "Could not validate HA token at startup. The addon will start anyway but requests may fail.");

  const wss = new WebSocketServer({ port: WS_PORT });
  log("INFO", `WebSocket server listening on port ${WS_PORT}`);
  log("INFO", `Allowed HTTP methods: ${ALLOWED_METHODS.join(", ")}`);

  wss.on("connection", (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    log("INFO", `Client connected from ${clientIp}`);

    ws.on("message", async (raw) => {
      let data;
      try { data = JSON.parse(raw.toString("utf-8")); }
      catch { ws.send(JSON.stringify({ success: false, error: "Invalid JSON." })); log("ERROR", "Received invalid JSON from client."); return; }

      log("INFO", `Request: ${data.method} ${data.endpoint}`);
      const validationError = validateMessage(data);
      if (validationError) { ws.send(JSON.stringify({ success: false, error: validationError })); log("ERROR", `Validation failed: ${validationError}`); return; }

      try {
        const result = await callHAWithRetry(data.method, data.endpoint, data.payload);
        ws.send(JSON.stringify({ success: result.status >= 200 && result.status < 300, status: result.status, body: result.body }));
        log("INFO", `Response: ${result.status} for ${data.method} ${data.endpoint}`);
      } catch (err) {
        ws.send(JSON.stringify({ success: false, error: "Failed to reach Home Assistant API.", details: err.message }));
        log("ERROR", "HA API call failed after retries.", { error: err.message });
      }
    });

    ws.on("close", () => log("INFO", `Client disconnected: ${clientIp}`));
    ws.on("error", (err) => log("ERROR", `WebSocket error for ${clientIp}`, { error: err.message }));
  });

  wss.on("error", (err) => log("ERROR", "WebSocket server error.", { error: err.message }));

  const shutdown = () => { log("INFO", "Shutting down..."); wss.clients.forEach((c) => c.close()); wss.close(() => process.exit(0)); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();