import http from "node:http";
import fs from "node:fs/promises";
import { createHmac, randomBytes, sign, timingSafeEqual } from "node:crypto";
const base = (process.env.BASE_PATH || "/dashboard-demo").replace(/\/$/, "");
const origin = process.env.PUBLIC_ORIGIN || "http://127.0.0.1:14004";
const upstream = process.env.DASHBOARD_URL || "http://127.0.0.1:13075";
const key = await fs.readFile(process.env.SIGNING_KEY_FILE);
const tenant = encodeURIComponent(
  process.env.DASHBOARD_TENANT || "dox-validation",
);
const scope = encodeURIComponent(process.env.DASHBOARD_SCOPE || "operations");
const slug = encodeURIComponent(
  process.env.DASHBOARD_SLUG || "streamhub-costs",
);
const query = encodeURIComponent(process.env.DASHBOARD_QUERY_ID || "costs");
const password = await fs.readFile(process.env.ACCESS_PASSWORD_FILE, "utf8");
const secret = await fs.readFile(process.env.SESSION_SECRET_FILE);
if (password.trim().length < 16 || secret.length < 32)
  throw new Error(
    "Use at least 16 characters for demo access and 32 bytes for the session secret",
  );
const secure = origin.startsWith("https:");
const staticRoot = new URL("./public/", import.meta.url);
const equal = (a, b) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const mac = (value) =>
  createHmac("sha256", secret).update(value).digest("base64url");
function session() {
  const value =
    Date.now() +
    12 * 60 * 60 * 1000 +
    "." +
    randomBytes(18).toString("base64url");
  return value + "." + mac(value);
}
function authenticated(req) {
  const token = (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("miot_demo="))
    ?.slice(10);
  if (!token) return false;
  const [expires, nonce, sig, ...rest] = token.split(".");
  return (
    rest.length === 0 &&
    Number(expires) > Date.now() &&
    Number(expires) < Date.now() + 13 * 3600000 &&
    !!nonce &&
    !!sig &&
    equal(sig, mac(expires + "." + nonce))
  );
}
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const values = [
    { alg: "RS256", typ: "JWT" },
    {
      iss: process.env.JWT_ISSUER || "urn:dox:dashboard-validation",
      aud: process.env.JWT_AUDIENCE || "dox-dashboard-validation",
      sub: process.env.JWT_SUBJECT || "validation-consumer",
      iat: now,
      exp: now + 120,
    },
  ].map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"));
  const value = values.join(".");
  return (
    value +
    "." +
    sign("RSA-SHA256", Buffer.from(value), key).toString("base64url")
  );
}
async function body(req) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > 4096) throw new Error("body limit");
  }
  return data;
}
const login = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso · MIOT Analytics</title><link rel="stylesheet" href="${base}/demo.css"><body class="login"><form method="post" action="${base}/login"><div class="brand"><b>M</b> MIOT <span>Analytics</span></div><h1>Tu información.<br>En cualquier aplicación.</h1><p>Demostración privada de dashboards embebidos.</p><label for="password">Código de acceso</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><button class="primary" type="submit">Abrir demostración →</button><small>Acceso de consulta · Datos reales de BigQuery</small></form></body></html>`;
const failures = new Map();
function reply(
  res,
  status,
  body,
  type = "text/html; charset=utf-8",
  extra = {},
) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
    ...extra,
  });
  res.end(body);
}
http
  .createServer(async (req, res) => {
    try {
      const path = new URL(req.url, origin).pathname;
      if (path === "/healthz") return reply(res, 200, "ok", "text/plain");
      if (path === base)
        return reply(res, 302, "", "text/plain", { Location: base + "/" });
      if (req.method === "POST" && req.headers.origin !== origin)
        return reply(res, 403, "Solicitud no permitida", "text/plain");
      if (path === base + "/demo.css" && req.method === "GET")
        return reply(
          res,
          200,
          await fs.readFile(new URL("demo.css", staticRoot)),
          "text/css",
        );
      if (path === base + "/login" && req.method === "POST") {
        const ip = req.socket.remoteAddress;
        const state = failures.get(ip);
        if (state && state.until > Date.now() && state.count >= 20)
          return reply(
            res,
            429,
            "Intenta nuevamente en unos minutos.",
            "text/plain",
          );
        const entered =
          new URLSearchParams(await body(req)).get("password") || "";
        if (!equal(entered, password.trim())) {
          const current =
            state?.until > Date.now()
              ? state
              : { count: 0, until: Date.now() + 600000 };
          current.count++;
          failures.set(ip, current);
          return reply(
            res,
            401,
            login.replace("Código de acceso", "Código de acceso incorrecto"),
          );
        }
        failures.delete(ip);
        return reply(res, 303, "", "text/plain", {
          Location: base + "/",
          "Set-Cookie": `miot_demo=${session()}; Path=${base}/; HttpOnly; SameSite=Strict; Max-Age=43200${secure ? "; Secure" : ""}`,
        });
      }
      if (!authenticated(req)) {
        if (path.startsWith(base + "/api/"))
          return reply(
            res,
            401,
            JSON.stringify({ error: "Sesión expirada" }),
            "application/json",
          );
        return reply(res, 200, login);
      }
      if (path === base + "/logout" && req.method === "POST")
        return reply(res, 303, "", "text/plain", {
          Location: base + "/",
          "Set-Cookie": `miot_demo=; Path=${base}/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`,
        });
      const assets = new Map([
        [base + "/", ["index.html", "text/html; charset=utf-8"]],
        [base + "/demo.js", ["demo.js", "text/javascript"]],
        [base + "/runtime.js", ["runtime.js", "text/javascript"]],
        [base + "/runtime.css", ["runtime.css", "text/css"]],
      ]);
      if (req.method === "GET" && assets.has(path)) {
        const [file, type] = assets.get(path);
        return reply(
          res,
          200,
          await fs.readFile(new URL(file, staticRoot)),
          type,
        );
      }
      const isCosts = path === base + "/api/costs" && req.method === "POST";
      const isDoc = path === base + "/api/dashboard" && req.method === "GET";
      if (!isCosts && !isDoc) return reply(res, 404, "Not found", "text/plain");
      if (isCosts) await body(req);
      const endpoint =
        "/tenants/" +
        tenant +
        "/scopes/" +
        scope +
        "/dashboards/" +
        slug +
        (isCosts ? "/queries/" + query : "");
      const response = await fetch(upstream + endpoint, {
        method: isCosts ? "POST" : "GET",
        headers: {
          Authorization: "Bearer " + jwt(),
          "Content-Type": "application/json",
        },
        body: isCosts ? '{"filters":{}}' : undefined,
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        return reply(
          res,
          response.status,
          JSON.stringify({ error: "No fue posible cargar los datos." }),
          "application/json",
        );
      return reply(
        res,
        200,
        Buffer.from(await response.arrayBuffer()),
        "application/json",
      );
    } catch {
      return reply(
        res,
        502,
        JSON.stringify({
          error: "No fue posible conectar. Intenta actualizar.",
        }),
        "application/json",
      );
    }
  })
  .listen(Number(process.env.PORT || 14004), "0.0.0.0", () =>
    console.log("Embedded dashboard demo ready"),
  );
