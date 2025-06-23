import Fastify from "fastify";
import fastifyPlugin from "fastify-plugin";

import { Config } from "./services/core/Config";
// import { DatabaseManager } from "./services/core/db";
// import { initDI } from "./infra/di";
import appFramework from "./app";
import { initDI } from "./infra/di";

// Load configuration
const configManager = new Config();
const config = await configManager.load();

// Initialize the database
// const database = await initDatabase(config);

// Initialize DI
const diContainer = await initDI({ config, /*database*/ });

// Initialize the app server
await initAppServer(/*config*/);

// async function initDatabase(config) {
//   // Initialize the database
//   const database = new DatabaseManager(config);

//   // Ensure database connection is ready
//   await database.ping();

//   // Return the database instance
//   return database;
// }

async function initAppServer(/*config: any*/) {
  // Initialize a Fastify server
  const app = Fastify({
    // logger: diContainer.resolve("Logger"),
    logger: true,
  });

  // Register the Fastify application as a plugin
  await app.register(fastifyPlugin(appFramework), { /*config*/ });

  // Initialize the applications, plugins, hooks, etc
  // in the Fastify framework
  await app.ready();
  // Start the server
  try {
    await app.listen({
      port: app.config?.PORT || 3030,
      host: app.config?.HOST,
    });
  } catch (err) {
    app.log.error(err);
    console.error(err);
    process.exit(1);
  }
}