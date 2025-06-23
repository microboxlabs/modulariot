import { fileURLToPath } from "url";
import path from "path";
import autoload from "@fastify/autoload";
import { FastifyInstance } from "fastify";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function AppFramework(fastify: FastifyInstance, opts: any): FastifyInstance {
  const appConfig = opts.config;
  fastify.decorate("config", appConfig);

  // Register app framework plugins
  fastify.register(autoload, {
    dir: path.join(__dirname, "http/plugins"),
    encapsulate: false,
    ignorePattern: /.*(test|spec).js/,
  });

  // Register API routes
  fastify.register(autoload, {
    dir: path.join(__dirname, "modules"),
    dirNameRoutePrefix: true,
    indexPattern: /.*\.routes(\.ts|\.js|\.cjs|\.mjs)$/,
  });

  return fastify;
}