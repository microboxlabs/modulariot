/**
 * Auto-generated: DO NOT EDIT BY HAND
 * @module device-types
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { routeSchema } from './device-types.schemas';

export default async function deviceTypesRoutes(fastify: FastifyInstance) {
  // GET /device-types
  fastify.get('/', {
    schema: routeSchema.listDeviceTypes
  }, async (request, reply) => {
    // TODO: Load device types from catalog/registry
    // TODO: Add filtering and pagination if needed
    // TODO: Cache results for performance
    
    return [
      {
        id: '01HX1N123456789ABCDEFGHIJK',
        name: 'GPS Tracker Pro',
        description: 'High-precision GPS tracking device with cellular connectivity',
        category: 'tracker',
        manufacturer: 'ModularIoT',
        supportedSymptoms: ['SIGNAL_LOST', 'LOW_BATTERY', 'GPS_ACCURACY_DEGRADED'],
        version: '1.2.0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T10:30:00Z'
      },
      {
        id: '01HX1O123456789ABCDEFGHIJK',
        name: 'Environmental Sensor',
        description: 'Multi-sensor device for temperature, humidity, and air quality monitoring',
        category: 'sensor',
        manufacturer: 'SensorTech',
        supportedSymptoms: ['SENSOR_MALFUNCTION', 'CALIBRATION_DRIFT', 'CONNECTIVITY_ISSUE'],
        version: '2.1.3',
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-18T14:22:00Z'
      },
      {
        id: '01HX1P123456789ABCDEFGHIJK',
        name: 'Industrial Gateway',
        description: 'Rugged IoT gateway for industrial environments with multiple protocols',
        category: 'gateway',
        manufacturer: 'IndustrialIoT',
        supportedSymptoms: ['NETWORK_CONGESTION', 'HARDWARE_FAILURE', 'SECURITY_BREACH'],
        version: '3.0.1',
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-20T09:45:00Z'
      },
      {
        id: '01HX1Q123456789ABCDEFGHIJK',
        name: 'Smart Energy Meter',
        description: 'Advanced energy monitoring device with real-time consumption tracking',
        category: 'meter',
        manufacturer: 'EnergyTech',
        supportedSymptoms: ['POWER_ANOMALY', 'COMMUNICATION_TIMEOUT', 'TAMPER_DETECTED'],
        version: '1.5.2',
        createdAt: '2024-01-04T00:00:00Z',
        updatedAt: '2024-01-19T16:30:00Z'
      }
    ];
  });

  // GET /device-types/:typeId
  fastify.get('/:typeId', {
    schema: routeSchema.getDeviceType
  }, async (request, reply) => {
    const { typeId } = request.params as { typeId: string };
    
    // TODO: Load specific device type from catalog
    // TODO: Return 404 if device type not found
    // TODO: Load schema and symptoms from definitions
    
    // Mock response based on typeId
    const deviceTypes: Record<string, any> = {
      '01HX1N123456789ABCDEFGHIJK': {
        id: '01HX1N123456789ABCDEFGHIJK',
        name: 'GPS Tracker Pro',
        description: 'High-precision GPS tracking device with cellular connectivity',
        category: 'tracker',
        manufacturer: 'ModularIoT',
        version: '1.2.0',
        schema: {
          properties: {
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lon: { type: 'number', minimum: -180, maximum: 180 },
            speedKph: { type: 'number', minimum: 0 },
            heading: { type: 'number', minimum: 0, maximum: 360 },
            altitude: { type: 'number' },
            accuracy: { type: 'number', minimum: 0 },
            batteryLevel: { type: 'number', minimum: 0, maximum: 100 },
            timestamp: { type: 'number' }
          },
          required: ['lat', 'lon', 'timestamp'],
          additionalProperties: false
        },
        supportedSymptoms: [
          {
            key: 'SIGNAL_LOST',
            name: 'Signal Lost',
            description: 'Device has lost cellular or GPS signal',
            severity: 'HIGH',
            defaultThreshold: { timeoutMinutes: 10 },
            category: 'connectivity'
          },
          {
            key: 'LOW_BATTERY',
            name: 'Low Battery',
            description: 'Device battery level is critically low',
            severity: 'MEDIUM',
            defaultThreshold: { batteryPercent: 15 },
            category: 'power'
          },
          {
            key: 'GPS_ACCURACY_DEGRADED',
            name: 'GPS Accuracy Degraded',
            description: 'GPS accuracy has fallen below acceptable threshold',
            severity: 'LOW',
            defaultThreshold: { accuracyMeters: 50 },
            category: 'sensor'
          }
        ],
        documentation: {
          setupGuide: 'https://docs.modulariot.com/devices/gps-tracker-pro/setup',
          apiReference: 'https://docs.modulariot.com/devices/gps-tracker-pro/api',
          troubleshooting: 'https://docs.modulariot.com/devices/gps-tracker-pro/troubleshooting'
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T10:30:00Z'
      },
      '01HX1O123456789ABCDEFGHIJK': {
        id: '01HX1O123456789ABCDEFGHIJK',
        name: 'Environmental Sensor',
        description: 'Multi-sensor device for temperature, humidity, and air quality monitoring',
        category: 'sensor',
        manufacturer: 'SensorTech',
        version: '2.1.3',
        schema: {
          properties: {
            temperature: { type: 'number', minimum: -50, maximum: 100 },
            humidity: { type: 'number', minimum: 0, maximum: 100 },
            airQualityIndex: { type: 'number', minimum: 0, maximum: 500 },
            co2Ppm: { type: 'number', minimum: 0 },
            pressure: { type: 'number', minimum: 0 },
            batteryVoltage: { type: 'number', minimum: 0 },
            timestamp: { type: 'number' }
          },
          required: ['temperature', 'humidity', 'timestamp'],
          additionalProperties: false
        },
        supportedSymptoms: [
          {
            key: 'SENSOR_MALFUNCTION',
            name: 'Sensor Malfunction',
            description: 'One or more sensors are providing invalid readings',
            severity: 'HIGH',
            defaultThreshold: { consecutiveInvalidReadings: 3 },
            category: 'sensor'
          },
          {
            key: 'CALIBRATION_DRIFT',
            name: 'Calibration Drift',
            description: 'Sensor calibration has drifted beyond acceptable range',
            severity: 'MEDIUM',
            defaultThreshold: { driftPercentage: 10 },
            category: 'sensor'
          },
          {
            key: 'CONNECTIVITY_ISSUE',
            name: 'Connectivity Issue',
            description: 'Device experiencing intermittent connectivity problems',
            severity: 'MEDIUM',
            defaultThreshold: { failedTransmissions: 5 },
            category: 'connectivity'
          }
        ],
        documentation: {
          setupGuide: 'https://docs.sensortech.com/environmental-sensor/setup',
          apiReference: 'https://docs.sensortech.com/environmental-sensor/api',
          troubleshooting: 'https://docs.sensortech.com/environmental-sensor/troubleshooting'
        },
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-18T14:22:00Z'
      }
    };

    const deviceType = deviceTypes[typeId];
    if (!deviceType) {
      return reply.code(404).send({
        error: 'DEVICE_TYPE_NOT_FOUND',
        message: 'Device type not found'
      });
    }

    return deviceType;
  });
} 