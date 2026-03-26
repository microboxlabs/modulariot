import { FastifySchema } from 'fastify';

export const routeSchema = {
  getOrganizationWebhooks: {
    description: 'List webhook endpoints for an organization',
    tags: ['webhooks'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['orgId'],
      properties: {
        orgId: { type: 'string' }
      }
    },
    querystring: {
      type: 'object',
      properties: {
        status: { 
          type: 'string', 
          enum: ['all', 'active', 'disabled', 'failed'],
          default: 'all'
        },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          webhooks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                url: { type: 'string', format: 'uri' },
                description: { type: 'string' },
                events: {
                  type: 'array',
                  items: { type: 'string' }
                },
                status: { 
                  type: 'string', 
                  enum: ['active', 'disabled', 'failed'] 
                },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  } as FastifySchema,

  createWebhook: {
    description: 'Create a new webhook endpoint for an organization',
    tags: ['webhooks'],
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
      required: ['url', 'events'],
      properties: {
        url: { 
          type: 'string', 
          format: 'uri'
        },
        description: { 
          type: 'string', 
          maxLength: 200
        },
        events: {
          type: 'array',
          minItems: 1,
          items: { 
            type: 'string',
            enum: [
              'symptom.critical',
              'symptom.high',
              'symptom.resolved',
              'device.offline',
              'device.online',
              'device.registered'
            ]
          }
        },
        secret: { 
          type: 'string', 
          minLength: 8,
          maxLength: 64
        }
      }
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          description: { type: 'string' },
          events: {
            type: 'array',
            items: { type: 'string' }
          },
          status: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  updateWebhook: {
    description: 'Update webhook status (enable/disable) or configuration',
    tags: ['webhooks'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['webhookId'],
      properties: {
        webhookId: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      properties: {
        status: { 
          type: 'string', 
          enum: ['active', 'disabled'] 
        }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  deleteWebhook: {
    description: 'Remove a webhook endpoint',
    tags: ['webhooks'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['webhookId'],
      properties: {
        webhookId: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['deleted'] },
          deletedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema
}; 