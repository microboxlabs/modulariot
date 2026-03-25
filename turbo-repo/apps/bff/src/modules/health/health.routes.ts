import { FastifyReply, FastifyRequest } from "fastify";
import { routeSchema } from "./health.schemas";

import { FastifyInstance } from "fastify/types/instance";

/**
 *
 * @param {*} server
 * @param {*} options
 */
export default async function healthRoute(server: FastifyInstance, options: any) {
  server.get("/", routeSchema, async (request: FastifyRequest, reply: FastifyReply) => {
    const memory = process.memoryUsage();
    const uptime = process.uptime() * 1000;
    const stats = [
      {
        uptime: uptime,
      },
      {
        rss: memory.rss,
        external: memory.external,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
      },
    ];

    const debugLevel = server?.config?.LOG_LEVEL || "info";
    const echoText = (request.query as any).echo || "Hello World";
    return reply.send({ echoText, stats, status: true, debugLevel });
  });
}