import { FastifySchema } from 'fastify';

export const routeSchema = {
  listTokens: {
    description: 'List API tokens for organization (admin only)',
    tags: ['tokens'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['orgId'],
      properties: {
        orgId: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            scopes: { 
              type: 'array',
              items: { type: 'string' }
            },
            status: { type: 'string', enum: ['active', 'disabled', 'revoked'] },
            lastUsed: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  } as FastifySchema,

  createToken: {
    description: 'Create new API token (admin only) - returns secret once',
    tags: ['tokens'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['orgId'],
      properties: {
        orgId: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      required: ['label', 'scopes'],
      properties: {
        label: { type: 'string', minLength: 1, maxLength: 100 },
        scopes: {
          type: 'array',
          items: { 
            type: 'string',
            enum: ['ingest', 'read', 'admin']
          },
          minItems: 1
        }
      }
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          scopes: { 
            type: 'array',
            items: { type: 'string' }
          },
          secret: { type: 'string' },
          status: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  updateToken: {
    description: 'Update API token - rotate secret or disable (admin only)',
    tags: ['tokens'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['tokenId'],
      properties: {
        tokenId: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      properties: {
        label: { type: 'string', minLength: 1, maxLength: 100 },
        status: { type: 'string', enum: ['active', 'disabled'] },
        rotate: { type: 'boolean' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          scopes: { 
            type: 'array',
            items: { type: 'string' }
          },
          status: { type: 'string' },
          secret: { type: 'string' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  revokeToken: {
    description: 'Revoke API token (admin only)',
    tags: ['tokens'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['tokenId'],
      properties: {
        tokenId: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          revokedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema
}; 