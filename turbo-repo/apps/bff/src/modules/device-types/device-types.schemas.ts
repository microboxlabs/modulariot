import { FastifySchema } from 'fastify';

export const routeSchema = {
  listDeviceTypes: {
    description: 'Get all built-in device types',
    tags: ['device-types'],
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            manufacturer: { type: 'string' },
            supportedSymptoms: {
              type: 'array',
              items: { type: 'string' }
            },
            version: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  } as FastifySchema,

  getDeviceType: {
    description: 'Get device type details with schema JSON and supported symptoms',
    tags: ['device-types'],
    params: {
      type: 'object',
      required: ['typeId'],
      properties: {
        typeId: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          manufacturer: { type: 'string' },
          version: { type: 'string' },
          schema: {
            type: 'object',
            properties: {
              properties: { type: 'object' },
              required: { 
                type: 'array',
                items: { type: 'string' }
              },
              additionalProperties: { type: 'boolean' }
            }
          },
          supportedSymptoms: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                defaultThreshold: { type: 'object' },
                category: { type: 'string' }
              }
            }
          },
          documentation: {
            type: 'object',
            properties: {
              setupGuide: { type: 'string' },
              apiReference: { type: 'string' },
              troubleshooting: { type: 'string' }
            }
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema
}; 