/**
 * `@microboxlabs/miot-dashboard-server/server`
 *
 * The standalone shape: a Node listener, health probes and lifecycle around
 * the same handler an existing backend would mount.
 *
 * Imports `node:http`, so it is the one entry that assumes a Node runtime. A
 * host mounting the library never reaches this entry and never pays for it.
 */

export {
  serve,
  createRequestHandler,
  type RunningServer,
  type ServeOptions,
} from "./server/serve";

export { toNodeListener } from "./server/node-adapter";

export {
  readServerConfig,
  ConfigError,
  type ConfigEnv,
  type ServerConfig,
} from "./server/config";
