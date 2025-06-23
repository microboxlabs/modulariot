import { FastifySchema } from 'fastify';

export const routeSchema = {
  getDeviceSymptoms: {
    description: 'Get current symptom configuration for device (toggles + thresholds)',
    tags: ['symptom-configs'],
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
          deviceId: { type: 'string' },
          deviceName: { type: 'string' },
          typeId: { type: 'string' },
          typeName: { type: 'string' },
          symptoms: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                category: { type: 'string' },
                severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                enabled: { type: 'boolean' },
                threshold: { type: 'object' },
                defaultThreshold: { type: 'object' },
                lastModified: { type: 'string', format: 'date-time' },
                modifiedBy: { type: 'string' }
              }
            }
          },
          lastUpdated: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  updateDeviceSymptom: {
    description: 'Update specific symptom configuration for device',
    tags: ['symptom-configs'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['deviceId', 'symptomKey'],
      properties: {
        deviceId: { type: 'string' },
        symptomKey: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        threshold: { type: 'object' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          deviceId: { type: 'string' },
          symptomKey: { type: 'string' },
          name: { type: 'string' },
          enabled: { type: 'boolean' },
          threshold: { type: 'object' },
          defaultThreshold: { type: 'object' },
          updatedAt: { type: 'string', format: 'date-time' },
          updatedBy: { type: 'string' }
        }
      }
    }
  } as FastifySchema,

  getOrganizationSymptomConfigs: {
    description: 'Get default symptom configurations per device type for organization',
    tags: ['symptom-configs'],
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
        deviceTypeId: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          organizationId: { type: 'string' },
          organizationName: { type: 'string' },
          deviceTypes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                typeId: { type: 'string' },
                typeName: { type: 'string' },
                category: { type: 'string' },
                manufacturer: { type: 'string' },
                defaultSymptomConfig: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                      category: { type: 'string' },
                      severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                      enabledByDefault: { type: 'boolean' },
                      defaultThreshold: { type: 'object' },
                      configurableThreshold: { type: 'boolean' },
                      thresholdSchema: { type: 'object' }
                    }
                  }
                },
                customizations: {
                  type: 'object',
                  properties: {
                    hasCustomDefaults: { type: 'boolean' },
                    customizedSymptoms: {
                      type: 'array',
                      items: { type: 'string' }
                    },
                    lastModified: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    }
  } as FastifySchema
}; 