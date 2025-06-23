/**
 * Auto-generated: DO NOT EDIT BY HAND
 * @module device-types
 */

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { FastifyInstance } from "fastify";
import { closeApp, startApp } from "../../utils/tests/infra";

describe('Device Types Routes', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await startApp();
  });

  afterAll(async () => {
    if (app) {
      await closeApp(app);
    }
  });

  describe('GET /device-types', () => {
    test('should list all built-in device types', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/device-types'
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(Array.isArray(payload)).toBe(true);
      expect(payload.length).toBeGreaterThan(0);
      
      const deviceType = payload[0];
      expect(deviceType.id).toBeDefined();
      expect(deviceType.name).toBeDefined();
      expect(deviceType.description).toBeDefined();
      expect(deviceType.category).toBeDefined();
      expect(deviceType.manufacturer).toBeDefined();
      expect(Array.isArray(deviceType.supportedSymptoms)).toBe(true);
      expect(deviceType.version).toBeDefined();
      expect(deviceType.createdAt).toBeDefined();
      expect(deviceType.updatedAt).toBeDefined();
    });

    test('should return device types with expected categories', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/device-types'
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      const categories = payload.map((dt: any) => dt.category);
      expect(categories).toContain('tracker');
      expect(categories).toContain('sensor');
      expect(categories).toContain('gateway');
      expect(categories).toContain('meter');
    });

    test('should return device types with supported symptoms', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/device-types'
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      const gpsTracker = payload.find((dt: any) => dt.category === 'tracker');
      expect(gpsTracker).toBeDefined();
      expect(gpsTracker.supportedSymptoms).toContain('SIGNAL_LOST');
      expect(gpsTracker.supportedSymptoms).toContain('LOW_BATTERY');
    });
  });

  describe('GET /device-types/:typeId', () => {
    test('should get GPS tracker device type with full details', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/device-types/01HX1N123456789ABCDEFGHIJK'
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      expect(payload.id).toBe('01HX1N123456789ABCDEFGHIJK');
      expect(payload.name).toBe('GPS Tracker Pro');
      expect(payload.category).toBe('tracker');
      expect(payload.manufacturer).toBe('ModularIoT');
      
      // Check schema structure
      expect(payload.schema).toBeDefined();
      expect(payload.schema.properties).toBeDefined();
      expect(payload.schema.properties.lat).toBeDefined();
      expect(payload.schema.properties.lon).toBeDefined();
      expect(payload.schema.required).toContain('lat');
      expect(payload.schema.required).toContain('lon');
      expect(payload.schema.required).toContain('timestamp');
      
      // Check supported symptoms
      expect(Array.isArray(payload.supportedSymptoms)).toBe(true);
      expect(payload.supportedSymptoms.length).toBeGreaterThan(0);
      
      const symptom = payload.supportedSymptoms[0];
      expect(symptom.key).toBeDefined();
      expect(symptom.name).toBeDefined();
      expect(symptom.description).toBeDefined();
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(symptom.severity);
      expect(symptom.defaultThreshold).toBeDefined();
      expect(symptom.category).toBeDefined();
      
      // Check documentation
      expect(payload.documentation).toBeDefined();
      expect(payload.documentation.setupGuide).toBeDefined();
      expect(payload.documentation.apiReference).toBeDefined();
      expect(payload.documentation.troubleshooting).toBeDefined();
    });

    test('should get environmental sensor device type with sensor-specific schema', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/device-types/01HX1O123456789ABCDEFGHIJK'
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      expect(payload.name).toBe('Environmental Sensor');
      expect(payload.category).toBe('sensor');
      
      // Check sensor-specific schema properties
      expect(payload.schema.properties.temperature).toBeDefined();
      expect(payload.schema.properties.humidity).toBeDefined();
      expect(payload.schema.properties.airQualityIndex).toBeDefined();
      expect(payload.schema.properties.co2Ppm).toBeDefined();
      
      // Check temperature constraints
      expect(payload.schema.properties.temperature.minimum).toBe(-50);
      expect(payload.schema.properties.temperature.maximum).toBe(100);
      
      // Check humidity constraints
      expect(payload.schema.properties.humidity.minimum).toBe(0);
      expect(payload.schema.properties.humidity.maximum).toBe(100);
    });

    test('should return 404 for non-existent device type', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/device-types/01HX1NONEXISTENT123456789'
      });

      expect(response.statusCode).toBe(404);
      const payload = response.json();
      expect(payload.error).toBe('DEVICE_TYPE_NOT_FOUND');
      expect(payload.message).toBe('Device type not found');
    });

    test('should validate supported symptoms structure', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/device-types/01HX1N123456789ABCDEFGHIJK'
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      const signalLostSymptom = payload.supportedSymptoms.find(
        (s: any) => s.key === 'SIGNAL_LOST'
      );
      
      expect(signalLostSymptom).toBeDefined();
      expect(signalLostSymptom.name).toBe('Signal Lost');
      expect(signalLostSymptom.severity).toBe('HIGH');
      expect(signalLostSymptom.category).toBe('connectivity');
      expect(signalLostSymptom.defaultThreshold.timeoutMinutes).toBe(10);
    });

    test('should include documentation links', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/device-types/01HX1N123456789ABCDEFGHIJK'
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      expect(payload.documentation.setupGuide).toMatch(/^https:\/\//);
      expect(payload.documentation.apiReference).toMatch(/^https:\/\//);
      expect(payload.documentation.troubleshooting).toMatch(/^https:\/\//);
      expect(payload.documentation.setupGuide).toContain('gps-tracker-pro');
    });

    test('should validate schema constraints for GPS tracker', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/device-types/01HX1N123456789ABCDEFGHIJK'
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      // Check latitude constraints
      expect(payload.schema.properties.lat.minimum).toBe(-90);
      expect(payload.schema.properties.lat.maximum).toBe(90);
      
      // Check longitude constraints
      expect(payload.schema.properties.lon.minimum).toBe(-180);
      expect(payload.schema.properties.lon.maximum).toBe(180);
      
      // Check heading constraints
      expect(payload.schema.properties.heading.minimum).toBe(0);
      expect(payload.schema.properties.heading.maximum).toBe(360);
      
      // Check battery level constraints
      expect(payload.schema.properties.batteryLevel.minimum).toBe(0);
      expect(payload.schema.properties.batteryLevel.maximum).toBe(100);
    });
  });
}); 