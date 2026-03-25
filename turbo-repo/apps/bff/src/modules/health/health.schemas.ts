import { FastifySchema } from 'fastify';

const healthEndpointSchema: FastifySchema = {
  description: 'server health endpoint',
  querystring: {
    type: 'object',
    properties: {
      echo: { type: 'string' },
    },
  },
  response: {
    200: {
      description: 'Successful response',
      type: 'object',
      properties: {
        echoText: { type: 'string' },
        status: { type: 'boolean' },
        stats: { type: 'array' },
        debugLevel: { type: 'string' },
      },
    },
  },
};

export const routeSchema = {
  schema: healthEndpointSchema,
};