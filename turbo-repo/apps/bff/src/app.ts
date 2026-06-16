import path from "path";
import autoload from "@fastify/autoload";
import { FastifyInstance } from "fastify";

export default function AppFramework(fastify: FastifyInstance, opts: any): FastifyInstance {
  const appConfig = opts.config;
  fastify.decorate("config", appConfig);
  const pluginIgnorePattern =
    process.env.NODE_ENV === "test"
      ? /(?:swagger|.*(?:test|spec))\.(?:ts|js|cjs|mjs)$/
      : /.*(?:test|spec)\.(?:ts|js|cjs|mjs)$/;

  // Register app framework plugins
  fastify.register(autoload, {
    dir: path.join(__dirname, "http/plugins"),
    encapsulate: false,
    ignorePattern: pluginIgnorePattern,
  });

  // Register API routes
  fastify.register(autoload, {
    dir: path.join(__dirname, "modules"),
    dirNameRoutePrefix: true,
    indexPattern: /.*\.routes(\.ts|\.js|\.cjs|\.mjs)$/,
  });

  return fastify;
}
