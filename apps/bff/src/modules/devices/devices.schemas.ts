import { FastifySchema } from 'fastify';

export const routeSchema = {
  listDevices: {
    description: 'List devices for organization with optional status filtering',
    tags: ['devices'],
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
          enum: ['active', 'inactive', 'maintenance', 'offline'] 
        },
        page: { type: 'number', minimum: 1, default: 1 },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          devices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                hwId: { type: 'string' },
                name: { type: 'string' },
                typeId: { type: 'string' },
                typeName: { type: 'string' },
                status: { type: 'string' },
                lastSeen: { type: 'string', format: 'date-time' },
                location: { type: 'string' },
                batteryLevel: { type: 'number' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            }
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'number' },
              limit: { type: 'number' },
              total: { type: 'number' },
              totalPages: { type: 'number' }
            }
          }
        }
      }
    }
  } as FastifySchema,

  registerDevice: {
    description: 'Register a single device to organization',
    tags: ['devices'],
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
      required: ['hwId', 'typeId', 'name'],
      properties: {
        hwId: { type: 'string', minLength: 1 },
        typeId: { type: 'string' },
        name: { type: 'string', minLength: 1, maxLength: 100 },
        location: { type: 'string', maxLength: 200 },
        metadata: { type: 'object' }
      }
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          hwId: { type: 'string' },
          name: { type: 'string' },
          typeId: { type: 'string' },
          typeName: { type: 'string' },
          status: { type: 'string' },
          location: { type: 'string' },
          metadata: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  bulkRegisterDevices: {
    description: 'Bulk register devices via CSV upload',
    tags: ['devices'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['orgId'],
      properties: {
        orgId: { type: 'string' }
      }
    },
    consumes: ['multipart/form-data'],
    response: {
      201: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          processed: { type: 'number' },
          successful: { type: 'number' },
          failed: { type: 'number' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                row: { type: 'number' },
                hwId: { type: 'string' },
                error: { type: 'string' }
              }
            }
          }
        }
      }
    }
  } as FastifySchema,

  getDevice: {
    description: 'Get device details',
    tags: ['devices'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['deviceId'],
      properties: {
        deviceId: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          hwId: { type: 'string' },
          name: { type: 'string' },
          typeId: { type: 'string' },
          typeName: { type: 'string' },
          status: { type: 'string' },
          location: { type: 'string' },
          metadata: { type: 'object' },
          lastSeen: { type: 'string', format: 'date-time' },
          batteryLevel: { type: 'number' },
          firmwareVersion: { type: 'string' },
          diagnostics: {
            type: 'object',
            properties: {
              signalStrength: { type: 'number' },
              uptime: { type: 'number' },
              memoryUsage: { type: 'number' },
              temperature: { type: 'number' }
            }
          },
          organization: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  updateDevice: {
    description: 'Update device name, location, or metadata',
    tags: ['devices'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['deviceId'],
      properties: {
        deviceId: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        location: { type: 'string', maxLength: 200 },
        metadata: { type: 'object' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          hwId: { type: 'string' },
          name: { type: 'string' },
          typeId: { type: 'string' },
          location: { type: 'string' },
          metadata: { type: 'object' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  deleteDevice: {
    description: 'Remove device from organization',
    tags: ['devices'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['deviceId'],
      properties: {
        deviceId: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          deletedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema
}; 