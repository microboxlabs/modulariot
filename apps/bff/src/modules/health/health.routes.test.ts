import { test, expect, mock, describe, beforeAll, afterAll } from "bun:test";
import { FastifyInstance } from "fastify";
import { closeApp, startApp } from "../../utils/tests/infra";
import { deepStrictEqual, equal } from "assert";


describe("Health Routes", async () => {
    let app: FastifyInstance | undefined;
  
    // @TODO refactor the per-test headers injection into a global hook in test.before
    // const authorizationToken = await generateToken();
  
    beforeAll(async () => {
      app = await startApp();
    });
  
    afterAll(async () => {
      if (app) {
        await closeApp(app);
      }
    });
  
    test("GET /health responds with 200 OK", async () => {
      if (!app) throw new Error("App not initialized");
      
      const response = await app.inject({
        method: "GET",
        url: "/health",
        // headers: {
        //   authorization: `Bearer ${authorizationToken}`,
        // },
      });
  
      deepStrictEqual(response.statusCode, 200);
    });
  
    test("GET /health responds with expected schema in body", async () => {
      if (!app) throw new Error("App not initialized");
      
      const response = await app.inject({
        method: "GET",
        url: "/health",
        // headers: {
        //   authorization: `Bearer ${authorizationToken}`,
        // },
      });
  
      const data = response.json();
      equal(data.echoText, "Hello World");
      equal(data.status, true);
      equal(data.stats.length, 2);
      equal(data.stats[0].uptime > 0, true);
      equal(data.stats[1].external > 0, true);
      equal(data.stats[1].heapTotal > 0, true);
      equal(data.stats[1].heapUsed > 0, true);
      equal(data.stats[1].rss > 0, true);
      equal(data.debugLevel, app.config?.LOG_LEVEL);
    });
  });