import { FastifySchema } from 'fastify';

export const routeSchema = {
  getSymptomEventsSSE: {
    description: 'Get symptom events via Server-Sent Events stream with real-time updates',
    tags: ['symptom-events'],
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
        since: { 
          type: 'string', 
          description: 'ULID timestamp to get events since' 
        },
        deviceId: { type: 'string' },
        severity: { 
          type: 'string', 
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] 
        },
        state: { 
          type: 'string', 
          enum: ['ACTIVE', 'ACKED', 'SILENCED', 'RESOLVED'] 
        }
      }
    },
    produces: ['text/event-stream'],
    response: {
      200: {
        type: 'string',
        description: 'Server-Sent Events stream'
      }
    }
  } as FastifySchema,

  getSymptomEventsREST: {
    description: 'Get symptom events as paginated REST response',
    tags: ['symptom-events'],
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
        since: { 
          type: 'string', 
          description: 'ULID timestamp to get events since' 
        },
        deviceId: { type: 'string' },
        severity: { 
          type: 'string', 
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] 
        },
        state: { 
          type: 'string', 
          enum: ['ACTIVE', 'ACKED', 'SILENCED', 'RESOLVED'] 
        },
        page: { type: 'number', minimum: 1, default: 1 },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
        sortBy: { 
          type: 'string', 
          enum: ['firstSeen', 'lastSeen', 'severity'], 
          default: 'lastSeen' 
        },
        sortOrder: { 
          type: 'string', 
          enum: ['asc', 'desc'], 
          default: 'desc' 
        }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                deviceId: { type: 'string' },
                deviceName: { type: 'string' },
                symptom: { type: 'string' },
                symptomName: { type: 'string' },
                severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                state: { type: 'string', enum: ['ACTIVE', 'ACKED', 'SILENCED', 'RESOLVED'] },
                firstSeen: { type: 'string', format: 'date-time' },
                lastSeen: { type: 'string', format: 'date-time' },
                acknowledgedAt: { type: 'string', format: 'date-time' },
                acknowledgedBy: { type: 'string' },
                silencedUntil: { type: 'string', format: 'date-time' },
                resolvedAt: { type: 'string', format: 'date-time' },
                metadata: { type: 'object' },
                threshold: { type: 'object' },
                eventCount: { type: 'number' }
              }
            }
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'number' },
              limit: { type: 'number' },
              total: { type: 'number' },
              totalPages: { type: 'number' },
              hasNext: { type: 'boolean' },
              hasPrev: { type: 'boolean' }
            }
          },
          summary: {
            type: 'object',
            properties: {
              totalActive: { type: 'number' },
              totalAcknowledged: { type: 'number' },
              totalSilenced: { type: 'number' },
              totalResolved: { type: 'number' },
              severityBreakdown: {
                type: 'object',
                properties: {
                  critical: { type: 'number' },
                  high: { type: 'number' },
                  medium: { type: 'number' },
                  low: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  } as FastifySchema,

  updateSymptomEvent: {
    description: 'Update symptom event state (acknowledge or silence)',
    tags: ['symptom-events'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['eventId'],
      properties: {
        eventId: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      required: ['action'],
      properties: {
        action: { 
          type: 'string', 
          enum: ['ack', 'silence', 'resolve'] 
        },
        silenceDuration: { 
          type: 'number', 
          minimum: 1, 
          maximum: 86400,
          description: 'Silence duration in seconds (only for silence action)'
        },
        comment: { 
          type: 'string', 
          maxLength: 500,
          description: 'Optional comment for the action'
        }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          deviceId: { type: 'string' },
          symptom: { type: 'string' },
          previousState: { type: 'string' },
          newState: { type: 'string' },
          action: { type: 'string' },
          actionBy: { type: 'string' },
          actionAt: { type: 'string', format: 'date-time' },
          comment: { type: 'string' },
          silencedUntil: { type: 'string', format: 'date-time' },
          metadata: { type: 'object' }
        }
      }
    }
  } as FastifySchema
}; 