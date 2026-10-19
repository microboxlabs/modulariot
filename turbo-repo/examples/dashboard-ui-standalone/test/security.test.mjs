import { test } from "node:test";
import assert from "node:assert/strict";
import { clientAddress, createLoginLimiter } from "../security.mjs";
import { aggregateServices } from "../public/billing.js";
test("proxy identity requires an explicitly trusted immediate peer and a valid IP", () => {
  const req = {
    socket: { remoteAddress: "::ffff:127.0.0.1" },
    headers: { "x-real-ip": "192.0.2.10" },
  };
  assert.equal(clientAddress(req, new Set()), "127.0.0.1");
  assert.equal(clientAddress(req, new Set(["127.0.0.1"])), "192.0.2.10");
  req.headers["x-real-ip"] = "fake,192.0.2.10";
  assert.equal(clientAddress(req, new Set(["127.0.0.1"])), "127.0.0.1");
});
test("throttle expires, clears successful identities and stays bounded", () => {
  let now = 0;
  const limiter = createLoginLimiter({ now: () => now, maxEntries: 2 });
  for (let i = 0; i < 20; i++) limiter.fail("a");
  assert.equal(limiter.blocked("a"), true);
  limiter.fail("b");
  limiter.fail("c");
  assert.equal(limiter.size, 2);
  limiter.clear("c");
  assert.equal(limiter.size, 1);
  now = 600001;
  assert.equal(limiter.blocked("b"), false);
  assert.equal(limiter.size, 0);
});
test("billing aggregates duplicate services and ignores invalid costs", () => {
  assert.deepEqual(
    aggregateServices([
      { service: "SQL", net_cost: "20" },
      { service: "BQ", net_cost: 12 },
      { service: "SQL", net_cost: -2 },
      { service: "SQL", net_cost: "bad" },
      null,
      { service: "x", net_cost: null },
    ]),
    [
      { service: "SQL", net_cost: 18 },
      { service: "BQ", net_cost: 12 },
    ],
  );
  assert.deepEqual(aggregateServices(undefined), []);
});
