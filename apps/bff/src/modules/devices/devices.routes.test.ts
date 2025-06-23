/**
 * Auto-generated: DO NOT EDIT BY HAND
 * @module devices
 */

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { FastifyInstance } from "fastify";
import { closeApp, startApp } from "../../utils/tests/infra";

describe('Devices Routes', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await startApp();
  });

  afterAll(async () => {
    if (app) {
      await closeApp(app);
    }
  });

  describe('GET /organizations/:orgId/devices', () => {
    test('should list devices for organization', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/devices/01HX1F123456789ABCDEFGHIJK/devices',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.devices).toBeDefined();
      expect(Array.isArray(payload.devices)).toBe(true);
      expect(payload.pagination).toBeDefined();
      
      if (payload.devices.length > 0) {
        const device = payload.devices[0];
        expect(device.id).toBeDefined();
        expect(device.hwId).toBeDefined();
        expect(device.name).toBeDefined();
        expect(device.typeId).toBeDefined();
        expect(device.typeName).toBeDefined();
        expect(device.status).toBeDefined();
        expect(['active', 'inactive', 'maintenance', 'offline']).toContain(device.status);
        expect(device.createdAt).toBeDefined();
        expect(device.updatedAt).toBeDefined();
      }
    });

    test('should filter devices by status', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/devices/01HX1F123456789ABCDEFGHIJK/devices?status=active',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      payload.devices.forEach((device: any) => {
        expect(device.status).toBe('active');
      });
    });

    test('should apply pagination', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/devices/01HX1F123456789ABCDEFGHIJK/devices?page=1&limit=2',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      expect(payload.pagination.page).toBe(1);
      expect(payload.pagination.limit).toBe(2);
      expect(payload.pagination.total).toBeDefined();
      expect(payload.pagination.totalPages).toBeDefined();
      expect(payload.devices.length).toBeLessThanOrEqual(2);
    });

    test('should validate pagination parameters', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/devices/01HX1F123456789ABCDEFGHIJK/devices?page=0&limit=200',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /organizations/:orgId/devices', () => {
    test('should register a new device', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/devices/01HX1F123456789ABCDEFGHIJK/devices',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          hwId: 'TEST-GPS-001',
          typeId: '01HX1N123456789ABCDEFGHIJK',
          name: 'Test GPS Device',
          location: 'Test Location',
          metadata: {
            testDevice: true,
            department: 'QA'
          }
        }
      });

      expect(response.statusCode).toBe(201);
      const payload = response.json();
      expect(payload.id).toBeDefined();
      expect(payload.hwId).toBe('TEST-GPS-001');
      expect(payload.name).toBe('Test GPS Device');
      expect(payload.typeId).toBe('01HX1N123456789ABCDEFGHIJK');
      expect(payload.typeName).toBeDefined();
      expect(payload.status).toBe('active');
      expect(payload.location).toBe('Test Location');
      expect(payload.metadata).toEqual({
        testDevice: true,
        department: 'QA'
      });
      expect(payload.createdAt).toBeDefined();
    });

    test('should validate required fields', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/devices/01HX1F123456789ABCDEFGHIJK/devices',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          hwId: 'TEST-GPS-002',
          typeId: '01HX1N123456789ABCDEFGHIJK'
          // Missing required 'name'
        }
      });

      expect(response.statusCode).toBe(400);
    });

    test('should validate hwId is not empty', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/devices/01HX1F123456789ABCDEFGHIJK/devices',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          hwId: '',
          typeId: '01HX1N123456789ABCDEFGHIJK',
          name: 'Test Device'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /organizations/:orgId/devices/bulk', () => {
    test('should process bulk device registration', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/devices/01HX1F123456789ABCDEFGHIJK/devices/bulk',
        headers: {
          authorization: 'Bearer valid-admin-token',
          'content-type': 'multipart/form-data'
        }
        // Note: In real implementation, this would include file upload
      });

      expect(response.statusCode).toBe(201);
      const payload = response.json();
      expect(payload.message).toBeDefined();
      expect(payload.processed).toBeGreaterThan(0);
      expect(payload.successful).toBeDefined();
      expect(payload.failed).toBeDefined();
      expect(Array.isArray(payload.errors)).toBe(true);
      
      if (payload.errors.length > 0) {
        const error = payload.errors[0];
        expect(error.row).toBeDefined();
        expect(error.hwId).toBeDefined();
        expect(error.error).toBeDefined();
      }
    });
  });

  describe('GET /devices/:deviceId', () => {
    test('should get GPS tracker device details', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/devices/01HX1R123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      expect(payload.id).toBe('01HX1R123456789ABCDEFGHIJK');
      expect(payload.hwId).toBe('GPS-001-DEV');
      expect(payload.name).toBe('Fleet Vehicle #1');
      expect(payload.typeId).toBeDefined();
      expect(payload.typeName).toBeDefined();
      expect(payload.status).toBeDefined();
      expect(payload.location).toBeDefined();
      expect(payload.metadata).toBeDefined();
      expect(payload.lastSeen).toBeDefined();
      expect(payload.batteryLevel).toBeDefined();
      expect(payload.firmwareVersion).toBeDefined();
      
      // Check diagnostics
      expect(payload.diagnostics).toBeDefined();
      expect(payload.diagnostics.signalStrength).toBeDefined();
      expect(payload.diagnostics.uptime).toBeDefined();
      expect(payload.diagnostics.memoryUsage).toBeDefined();
      expect(payload.diagnostics.temperature).toBeDefined();
      
      // Check organization info
      expect(payload.organization).toBeDefined();
      expect(payload.organization.id).toBeDefined();
      expect(payload.organization.name).toBeDefined();
      
      expect(payload.createdAt).toBeDefined();
      expect(payload.updatedAt).toBeDefined();
    });

    test('should get environmental sensor device details', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/devices/01HX1S123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      
      expect(payload.name).toBe('Office Environment Monitor');
      expect(payload.typeName).toBe('Environmental Sensor');
      expect(payload.metadata.zone).toBeDefined();
      expect(payload.metadata.responsible).toBeDefined();
      expect(payload.metadata.calibrationDate).toBeDefined();
    });

    test('should return 404 for non-existent device', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/devices/01HX1NONEXISTENT123456789',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(404);
      const payload = response.json();
      expect(payload.error).toBe('DEVICE_NOT_FOUND');
      expect(payload.message).toBe('Device not found');
    });
  });

  describe('PATCH /devices/:deviceId', () => {
    test('should update device name', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'PATCH',
        url: '/devices/01HX1R123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          name: 'Updated Fleet Vehicle #1'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.id).toBe('01HX1R123456789ABCDEFGHIJK');
      expect(payload.name).toBe('Updated Fleet Vehicle #1');
      expect(payload.updatedAt).toBeDefined();
    });

    test('should update device location', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'PATCH',
        url: '/devices/01HX1R123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          location: 'Los Angeles, CA'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.location).toBe('Los Angeles, CA');
    });

    test('should update device metadata', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'PATCH',
        url: '/devices/01HX1R123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          metadata: {
            vehicleId: 'V001',
            driver: 'Jane Doe',
            department: 'Sales'
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.metadata.driver).toBe('Jane Doe');
      expect(payload.metadata.department).toBe('Sales');
    });

    test('should validate name length', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'PATCH',
        url: '/devices/01HX1R123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          name: '' // Empty name should fail validation
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /devices/:deviceId', () => {
    test('should delete device', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'DELETE',
        url: '/devices/01HX1R123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-admin-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.message).toBe('Device successfully removed');
      expect(payload.deletedAt).toBeDefined();
    });
  });

  describe('Device status validation', () => {
    test('should only accept valid status values', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/devices/01HX1F123456789ABCDEFGHIJK/devices?status=invalid-status',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Device metadata validation', () => {
    test('should handle complex metadata objects', async () => {
      if (!app) throw new Error("App not initialized");

      const complexMetadata = {
        vehicle: {
          make: 'Toyota',
          model: 'Camry',
          year: 2023,
          vin: 'ABC123456789'
        },
        driver: {
          id: 'D001',
          name: 'John Smith',
          license: 'DL123456'
        },
        settings: {
          reportingInterval: 60,
          alertThresholds: {
            speed: 80,
            battery: 20
          }
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/devices/01HX1F123456789ABCDEFGHIJK/devices',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          hwId: 'COMPLEX-META-001',
          typeId: '01HX1N123456789ABCDEFGHIJK',
          name: 'Complex Metadata Device',
          metadata: complexMetadata
        }
      });

      expect(response.statusCode).toBe(201);
      const payload = response.json();
      expect(payload.metadata).toEqual(complexMetadata);
    });
  });
}); 