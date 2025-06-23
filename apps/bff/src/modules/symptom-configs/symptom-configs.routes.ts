/**
 * Auto-generated: DO NOT EDIT BY HAND
 * @module symptom-configs
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { routeSchema } from './symptom-configs.schemas';

export default async function symptomConfigsRoutes(fastify: FastifyInstance) {
  // GET /devices/:deviceId/symptoms
  fastify.get('/:deviceId/symptoms', {
    schema: routeSchema.getDeviceSymptoms
  }, async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    
    // TODO: Extract user from JWT token
    // TODO: Verify user has access to device's organization
    // TODO: Fetch device and its symptom configurations from database
    // TODO: Delegate to Quarkus service for current symptom states
    // TODO: Return 404 if device not found
    
    // Mock device symptom configurations based on deviceId
    const deviceSymptomConfigs: Record<string, any> = {
      '01HX1R123456789ABCDEFGHIJK': {
        deviceId: '01HX1R123456789ABCDEFGHIJK',
        deviceName: 'Fleet Vehicle #1',
        typeId: '01HX1N123456789ABCDEFGHIJK',
        typeName: 'GPS Tracker Pro',
        symptoms: [
          {
            key: 'SIGNAL_LOST',
            name: 'Signal Lost',
            description: 'Device has lost cellular or GPS signal',
            category: 'connectivity',
            severity: 'HIGH',
            enabled: true,
            threshold: { timeoutMinutes: 15 },
            defaultThreshold: { timeoutMinutes: 10 },
            lastModified: '2024-01-18T14:30:00Z',
            modifiedBy: 'admin@acme.com'
          },
          {
            key: 'LOW_BATTERY',
            name: 'Low Battery',
            description: 'Device battery level is critically low',
            category: 'power',
            severity: 'MEDIUM',
            enabled: true,
            threshold: { batteryPercent: 20 },
            defaultThreshold: { batteryPercent: 15 },
            lastModified: '2024-01-16T09:15:00Z',
            modifiedBy: 'admin@acme.com'
          },
          {
            key: 'GPS_ACCURACY_DEGRADED',
            name: 'GPS Accuracy Degraded',
            description: 'GPS accuracy has fallen below acceptable threshold',
            category: 'sensor',
            severity: 'LOW',
            enabled: false,
            threshold: { accuracyMeters: 100 },
            defaultThreshold: { accuracyMeters: 50 },
            lastModified: '2024-01-15T16:45:00Z',
            modifiedBy: 'operator@acme.com'
          }
        ],
        lastUpdated: '2024-01-18T14:30:00Z'
      },
      '01HX1S123456789ABCDEFGHIJK': {
        deviceId: '01HX1S123456789ABCDEFGHIJK',
        deviceName: 'Office Environment Monitor',
        typeId: '01HX1O123456789ABCDEFGHIJK',
        typeName: 'Environmental Sensor',
        symptoms: [
          {
            key: 'SENSOR_MALFUNCTION',
            name: 'Sensor Malfunction',
            description: 'One or more sensors are providing invalid readings',
            category: 'sensor',
            severity: 'HIGH',
            enabled: true,
            threshold: { consecutiveInvalidReadings: 5 },
            defaultThreshold: { consecutiveInvalidReadings: 3 },
            lastModified: '2024-01-19T11:20:00Z',
            modifiedBy: 'facilities@acme.com'
          },
          {
            key: 'CALIBRATION_DRIFT',
            name: 'Calibration Drift',
            description: 'Sensor calibration has drifted beyond acceptable range',
            category: 'sensor',
            severity: 'MEDIUM',
            enabled: true,
            threshold: { driftPercentage: 15 },
            defaultThreshold: { driftPercentage: 10 },
            lastModified: '2024-01-17T13:45:00Z',
            modifiedBy: 'facilities@acme.com'
          },
          {
            key: 'CONNECTIVITY_ISSUE',
            name: 'Connectivity Issue',
            description: 'Device experiencing intermittent connectivity problems',
            category: 'connectivity',
            severity: 'MEDIUM',
            enabled: true,
            threshold: { failedTransmissions: 3 },
            defaultThreshold: { failedTransmissions: 5 },
            lastModified: '2024-01-19T08:30:00Z',
            modifiedBy: 'admin@acme.com'
          }
        ],
        lastUpdated: '2024-01-19T11:20:00Z'
      }
    };

    const deviceConfig = deviceSymptomConfigs[deviceId];
    if (!deviceConfig) {
      return reply.code(404).send({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found or no symptom configuration available'
      });
    }

    return deviceConfig;
  });

  // PATCH /devices/:deviceId/symptoms/:symptomKey
  fastify.patch('/:deviceId/symptoms/:symptomKey', {
    schema: routeSchema.updateDeviceSymptom
  }, async (request, reply) => {
    const { deviceId, symptomKey } = request.params as { 
      deviceId: string; 
      symptomKey: string; 
    };
    const { enabled, threshold } = request.body as {
      enabled?: boolean;
      threshold?: object;
    };
    
    // TODO: Extract user from JWT token
    // TODO: Verify user has admin access to device's organization
    // TODO: Validate device exists and symptom key is valid for device type
    // TODO: Update symptom configuration in database
    // TODO: Delegate configuration update to Quarkus service
    // TODO: Log configuration change for audit trail
    
    // Mock symptom update response
    const updatedSymptom = {
      deviceId: deviceId,
      symptomKey: symptomKey,
      name: symptomKey === 'SIGNAL_LOST' ? 'Signal Lost' : 
            symptomKey === 'LOW_BATTERY' ? 'Low Battery' :
            symptomKey === 'SENSOR_MALFUNCTION' ? 'Sensor Malfunction' : 
            'Unknown Symptom',
      enabled: enabled !== undefined ? enabled : true,
      threshold: threshold || { 
        timeoutMinutes: 15,
        batteryPercent: 20,
        consecutiveInvalidReadings: 5
      },
      defaultThreshold: {
        timeoutMinutes: 10,
        batteryPercent: 15,
        consecutiveInvalidReadings: 3
      },
      updatedAt: '2024-01-20T18:30:00Z',
      updatedBy: 'admin@acme.com'
    };

    return updatedSymptom;
  });

  // GET /organizations/:orgId/symptom-configs
  fastify.get('/:orgId/symptom-configs', {
    schema: routeSchema.getOrganizationSymptomConfigs
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string };
    const { deviceTypeId } = request.query as { deviceTypeId?: string };
    
    // TODO: Extract user from JWT token
    // TODO: Verify user has read access to organization
    // TODO: Fetch organization's device types and their symptom configurations
    // TODO: Apply device type filter if provided
    // TODO: Include any organization-level customizations
    
    const allDeviceTypeConfigs = [
      {
        typeId: '01HX1N123456789ABCDEFGHIJK',
        typeName: 'GPS Tracker Pro',
        category: 'tracker',
        manufacturer: 'ModularIoT',
        defaultSymptomConfig: [
          {
            key: 'SIGNAL_LOST',
            name: 'Signal Lost',
            description: 'Device has lost cellular or GPS signal',
            category: 'connectivity',
            severity: 'HIGH',
            enabledByDefault: true,
            defaultThreshold: { timeoutMinutes: 10 },
            configurableThreshold: true,
            thresholdSchema: {
              type: 'object',
              properties: {
                timeoutMinutes: { type: 'number', minimum: 1, maximum: 60 }
              },
              required: ['timeoutMinutes']
            }
          },
          {
            key: 'LOW_BATTERY',
            name: 'Low Battery',
            description: 'Device battery level is critically low',
            category: 'power',
            severity: 'MEDIUM',
            enabledByDefault: true,
            defaultThreshold: { batteryPercent: 15 },
            configurableThreshold: true,
            thresholdSchema: {
              type: 'object',
              properties: {
                batteryPercent: { type: 'number', minimum: 5, maximum: 50 }
              },
              required: ['batteryPercent']
            }
          }
        ],
        customizations: {
          hasCustomDefaults: true,
          customizedSymptoms: ['SIGNAL_LOST', 'LOW_BATTERY'],
          lastModified: '2024-01-18T14:30:00Z'
        }
      },
      {
        typeId: '01HX1O123456789ABCDEFGHIJK',
        typeName: 'Environmental Sensor',
        category: 'sensor',
        manufacturer: 'SensorTech',
        defaultSymptomConfig: [
          {
            key: 'SENSOR_MALFUNCTION',
            name: 'Sensor Malfunction',
            description: 'One or more sensors are providing invalid readings',
            category: 'sensor',
            severity: 'HIGH',
            enabledByDefault: true,
            defaultThreshold: { consecutiveInvalidReadings: 3 },
            configurableThreshold: true,
            thresholdSchema: {
              type: 'object',
              properties: {
                consecutiveInvalidReadings: { type: 'number', minimum: 1, maximum: 10 }
              },
              required: ['consecutiveInvalidReadings']
            }
          },
          {
            key: 'CALIBRATION_DRIFT',
            name: 'Calibration Drift',
            description: 'Sensor calibration has drifted beyond acceptable range',
            category: 'sensor',
            severity: 'MEDIUM',
            enabledByDefault: true,
            defaultThreshold: { driftPercentage: 10 },
            configurableThreshold: true,
            thresholdSchema: {
              type: 'object',
              properties: {
                driftPercentage: { type: 'number', minimum: 1, maximum: 50 }
              },
              required: ['driftPercentage']
            }
          }
        ],
        customizations: {
          hasCustomDefaults: false,
          customizedSymptoms: [],
          lastModified: null
        }
      }
    ];

    // Apply device type filter if provided
    let filteredConfigs = allDeviceTypeConfigs;
    if (deviceTypeId) {
      filteredConfigs = allDeviceTypeConfigs.filter(config => config.typeId === deviceTypeId);
    }

    return {
      organizationId: orgId,
      organizationName: 'Acme Corporation',
      deviceTypes: filteredConfigs
    };
  });
} 