import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { generateKeyPairSync, createHmac, verify } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
test("demo HTTP authentication, origins, cookies, throttling and route allowlist", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "dashboard-demo-test-"));
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const password = "local-test-password-only";
  const secret = Buffer.alloc(48, 7);
  await writeFile(
    join(dir, "key"),
    privateKey.export({ type: "pkcs8", format: "pem" }),
  );
  await writeFile(join(dir, "password"), password);
  await writeFile(join(dir, "secret"), secret);
  const calls = [];
  const upstream = createServer((req, res) => {
    calls.push({
      url: req.url,
      method: req.method,
      authorization: req.headers.authorization,
    });
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({ data: { rows: [{ service: "BQ", net_cost: "12" }] } }),
    );
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const origin = "https://demo.example";
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: {
      ...process.env,
      PORT: "0",
      BASE_PATH: "/demo",
      PUBLIC_ORIGIN: origin,
      DASHBOARD_URL: `http://127.0.0.1:${upstream.address().port}`,
      SIGNING_KEY_FILE: join(dir, "key"),
      ACCESS_PASSWORD_FILE: join(dir, "password"),
      SESSION_SECRET_FILE: join(dir, "secret"),
      TRUSTED_PROXY_IPS: "127.0.0.1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    child.kill();
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Server startup timeout")),
      10000,
    );
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("Server exited before ready"));
    });
    child.stdout.on("data", (data) => {
      const match = /ready on port (\d+)/.exec(String(data));
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
  });
  const request = (path, options = {}) =>
    fetch(`http://127.0.0.1:${port}/demo${path}`, {
      redirect: "manual",
      ...options,
    });
  const login = (headers = {}, value = password) =>
    request("/login", {
      method: "POST",
      headers: { origin, "x-real-ip": "192.0.2.1", ...headers },
      body: new URLSearchParams({ password: value }),
    });
  assert.equal((await request("/api/dashboard")).status, 401);
  assert.equal(
    (await login({ origin: "https://foreign.example" })).status,
    403,
  );
  assert.equal(
    (
      await request("/login", {
        method: "POST",
        body: new URLSearchParams({ password }),
      })
    ).status,
    403,
  );
  assert.equal((await login({}, "wrong")).status, 401);
  const signedIn = await login();
  assert.equal(signedIn.status, 303);
  const setCookie = signedIn.headers.get("set-cookie");
  for (const flag of ["Secure", "HttpOnly", "SameSite=Strict"])
    assert.ok(setCookie.includes(flag));
  const cookie = setCookie.split(";")[0];
  const headers = { cookie, origin };
  assert.equal((await request("/api/dashboard", { headers })).status, 200);
  assert.equal(
    (await request("/api/costs", { method: "POST", headers, body: "{}" }))
      .status,
    200,
  );
  assert.equal(
    (
      await request("/api/costs", {
        method: "POST",
        headers: { cookie, origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/costs", { method: "POST", headers: { cookie } }))
      .status,
    403,
  );
  assert.equal((await request("/api/other", { headers })).status, 404);
  assert.equal(
    (await request("/api/dashboard", { method: "DELETE", headers })).status,
    404,
  );
  assert.equal(calls.length, 2);
  const jwt = calls[0].authorization.slice(7).split(".");
  assert.ok(
    verify(
      "RSA-SHA256",
      Buffer.from(jwt.slice(0, 2).join(".")),
      publicKey,
      Buffer.from(jwt[2], "base64url"),
    ),
  );
  const claims = JSON.parse(Buffer.from(jwt[1], "base64url"));
  assert.equal(claims.sub, "validation-consumer");
  assert.equal(claims.exp - claims.iat, 120);
  assert.equal(
    (await request("/api/dashboard", { headers: { cookie: cookie + "x" } }))
      .status,
    401,
  );
  const expired = `${Date.now() - 1}.nonce`;
  const mac = createHmac("sha256", secret).update(expired).digest("base64url");
  assert.equal(
    (
      await request("/api/dashboard", {
        headers: { cookie: `miot_demo=${expired}.${mac}` },
      })
    ).status,
    401,
  );
  for (let i = 0; i < 20; i++)
    assert.equal(
      (await login({ "x-real-ip": "192.0.2.2" }, "wrong")).status,
      401,
    );
  assert.equal((await login({ "x-real-ip": "192.0.2.2" })).status, 429);
  assert.equal((await login({ "x-real-ip": "192.0.2.3" })).status, 303);
  const logout = await request("/logout", { method: "POST", headers });
  assert.equal(logout.status, 303);
  assert.ok(logout.headers.get("set-cookie").includes("Max-Age=0"));
  assert.equal((await request("/api/dashboard")).status, 401);
});
