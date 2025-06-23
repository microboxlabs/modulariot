import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { FastifyInstance } from "fastify";

/**
 *
 * @param {*} server
 * @param {*} opts
 */
async function plugin(server: FastifyInstance, opts: any) {
  server.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "HEAD", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  });
}

export default fp(plugin, {
  name: "cors",
});