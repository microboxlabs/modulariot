/**
 * Auto-generated: DO NOT EDIT BY HAND
 * @module symptom-configs
 */

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { FastifyInstance } from "fastify";
import { closeApp, startApp } from "../../utils/tests/infra";

describe('Symptom Configs Routes', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await startApp();
  });

  afterAll(async () => {
    if (app) {
      await closeApp(app);
    }
  });

  describe('GET /devices/:deviceId/symptoms', () => {
    test('should get symptom configuration for device', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/symptom-configs/01HX1R123456789ABCDEFGHIJK/symptoms',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      expect(payload.deviceId).toBe('01HX1R123456789ABCDEFGHIJK');
      expect(payload.deviceName).toBeDefined();
      expect(payload.typeId).toBeDefined();
      expect(payload.typeName).toBeDefined();
      expect(Array.isArray(payload.symptoms)).toBe(true);
      expect(payload.lastUpdated).toBeDefined();
      
      if (payload.symptoms.length > 0) {
        const symptom = payload.symptoms[0];
        expect(symptom.key).toBeDefined();
        expect(symptom.name).toBeDefined();
        expect(symptom.description).toBeDefined();
        expect(symptom.category).toBeDefined();
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(symptom.severity);
        expect(typeof symptom.enabled).toBe('boolean');
        expect(symptom.threshold).toBeDefined();
        expect(symptom.defaultThreshold).toBeDefined();
        expect(symptom.lastModified).toBeDefined();
        expect(symptom.modifiedBy).toBeDefined();
      }
    });

    test('should return 404 for non-existent device', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/symptom-configs/01HX1NONEXISTENT123456789/symptoms',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(404);
      const payload = response.json();
      expect(payload.error).toBe('DEVICE_NOT_FOUND');
    });
  });

  describe('PATCH /devices/:deviceId/symptoms/:symptomKey', () => {
    test('should update symptom configuration', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'PATCH',
        url: '/symptom-configs/01HX1R123456789ABCDEFGHIJK/symptoms/SIGNAL_LOST',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          enabled: false,
          threshold: {
            timeoutMinutes: 20
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      expect(payload.deviceId).toBe('01HX1R123456789ABCDEFGHIJK');
      expect(payload.symptomKey).toBe('SIGNAL_LOST');
      expect(payload.name).toBeDefined();
      expect(payload.enabled).toBe(false);
      expect(payload.threshold).toBeDefined();
      expect(payload.defaultThreshold).toBeDefined();
      expect(payload.updatedAt).toBeDefined();
      expect(payload.updatedBy).toBeDefined();
    });
  });

  describe('GET /organizations/:orgId/symptom-configs', () => {
    test('should get organization symptom configurations', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/symptom-configs/01HX1F123456789ABCDEFGHIJK/symptom-configs',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      expect(payload.organizationId).toBe('01HX1F123456789ABCDEFGHIJK');
      expect(payload.organizationName).toBeDefined();
      expect(Array.isArray(payload.deviceTypes)).toBe(true);
      
      if (payload.deviceTypes.length > 0) {
        const deviceType = payload.deviceTypes[0];
        expect(deviceType.typeId).toBeDefined();
        expect(deviceType.typeName).toBeDefined();
        expect(deviceType.category).toBeDefined();
        expect(deviceType.manufacturer).toBeDefined();
        expect(Array.isArray(deviceType.defaultSymptomConfig)).toBe(true);
        expect(deviceType.customizations).toBeDefined();
        expect(typeof deviceType.customizations.hasCustomDefaults).toBe('boolean');
        expect(Array.isArray(deviceType.customizations.customizedSymptoms)).toBe(true);
      }
    });

    test('should filter by device type ID', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/symptom-configs/01HX1F123456789ABCDEFGHIJK/symptom-configs?deviceTypeId=01HX1N123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      expect(payload.deviceTypes.length).toBe(1);
      expect(payload.deviceTypes[0].typeId).toBe('01HX1N123456789ABCDEFGHIJK');
    });
  });
}); 