/**
 * Auto-generated: DO NOT EDIT BY HAND
 * @module ingest
 */

import { FastifySchema } from 'fastify';

// Device data payload schema for individual NDJSON lines
const deviceDataPayloadSchema = {
  type: 'object',
  properties: {
    deviceId: {
      type: 'string',
      description: 'ULID identifier for the device',
      pattern: '^[0-9A-HJKMNP-TV-Z]{26}$'
    },
    ts: {
      type: 'number',
      description: 'Unix timestamp in milliseconds'
    },
    type: {
      type: 'string',
      description: 'Data type identifier (e.g., "gps", "temperature", "vibration")'
    }
  },
  required: ['deviceId', 'ts', 'type'],
  additionalProperties: true // Allow additional fields based on data type
} as const;

// GPS-specific payload example
const gpsDataPayloadSchema = {
  type: 'object',
  properties: {
    deviceId: {
      type: 'string',
      description: 'ULID identifier for the device',
      pattern: '^[0-9A-HJKMNP-TV-Z]{26}$'
    },
    ts: {
      type: 'number',
      description: 'Unix timestamp in milliseconds'
    },
    type: {
      type: 'string',
      enum: ['gps']
    },
    lat: {
      type: 'number',
      description: 'Latitude coordinate',
      minimum: -90,
      maximum: 90
    },
    lon: {
      type: 'number',
      description: 'Longitude coordinate',
      minimum: -180,
      maximum: 180
    },
    speedKph: {
      type: 'number',
      description: 'Speed in kilometers per hour',
      minimum: 0
    }
  },
  required: ['deviceId', 'ts', 'type', 'lat', 'lon'],
  additionalProperties: false
} as const;

export const routeSchema = {
  postIngest: {
    description: 'Ingest device data via NDJSON format',
    tags: ['Device Ingest'],
    security: [{ bearerAuth: [] }],
    body: {
      type: 'string',
      description: 'NDJSON (newline-delimited JSON) payload containing device data. Each line should be a valid JSON object representing a data point.',
      contentMediaType: 'application/x-ndjson'
    },
    headers: {
      type: 'object',
      properties: {
        'content-encoding': {
          type: 'string',
          enum: ['gzip'],
          description: 'Optional gzip compression'
        },
        'content-type': {
          type: 'string',
          enum: ['application/x-ndjson', 'text/plain'],
          description: 'Content type for NDJSON data'
        }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          processed: { type: 'number', description: 'Number of data points processed' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                line: { type: 'number' },
                error: { type: 'string' },
                data: { type: 'string' }
              }
            }
          }
        }
      },
      400: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' }
        }
      },
      401: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' }
        }
      },
      403: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' }
        }
      }
    }
  } satisfies FastifySchema
};

// Export schemas for testing and validation
export const schemas = {
  deviceDataPayload: deviceDataPayloadSchema,
  gpsDataPayload: gpsDataPayloadSchema
}; 