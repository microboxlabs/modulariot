/**
 * Auto-generated: DO NOT EDIT BY HAND
 * @module tokens
 */

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { FastifyInstance } from "fastify";
import { closeApp, startApp } from "../../utils/tests/infra";

describe('Tokens Routes', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await startApp();
  });

  afterAll(async () => {
    if (app) {
      await closeApp(app);
    }
  });

  describe('GET /organizations/:orgId/tokens', () => {
    test('should list API tokens for organization', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/tokens/01HX1F123456789ABCDEFGHIJK/tokens',
        headers: {
          authorization: 'Bearer valid-admin-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(Array.isArray(payload)).toBe(true);
      expect(payload.length).toBeGreaterThan(0);
      
      const token = payload[0];
      expect(token.id).toBeDefined();
      expect(token.label).toBeDefined();
      expect(Array.isArray(token.scopes)).toBe(true);
      expect(['active', 'disabled', 'revoked']).toContain(token.status);
      expect(token.createdAt).toBeDefined();
      expect(token.updatedAt).toBeDefined();
      // Secret should NOT be returned in list
      expect(token.secret).toBeUndefined();
    });

    test('should require organization ID parameter', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/tokens//tokens',
        headers: {
          authorization: 'Bearer valid-admin-token'
        }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /organizations/:orgId/tokens', () => {
    test('should create new API token with ingest scope', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/tokens/01HX1F123456789ABCDEFGHIJK/tokens',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          label: 'Test Ingest Token',
          scopes: ['ingest']
        }
      });

      expect(response.statusCode).toBe(201);
      const payload = response.json();
      expect(payload.id).toBeDefined();
      expect(payload.label).toBe('Test Ingest Token');
      expect(payload.scopes).toEqual(['ingest']);
      expect(payload.secret).toBeDefined();
      expect(payload.secret).toMatch(/^miot_sk_/);
      expect(payload.status).toBe('active');
      expect(payload.createdAt).toBeDefined();
    });

    test('should create token with multiple scopes', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/tokens/01HX1F123456789ABCDEFGHIJK/tokens',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          label: 'Multi-scope Token',
          scopes: ['read', 'admin']
        }
      });

      expect(response.statusCode).toBe(201);
      const payload = response.json();
      expect(payload.scopes).toEqual(['read', 'admin']);
    });

    test('should validate required fields', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/tokens/01HX1F123456789ABCDEFGHIJK/tokens',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          label: 'Missing Scopes Token'
        }
      });

      expect(response.statusCode).toBe(400);
    });

    test('should validate scope enum values', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/tokens/01HX1F123456789ABCDEFGHIJK/tokens',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          label: 'Invalid Scope Token',
          scopes: ['invalid-scope']
        }
      });

      expect(response.statusCode).toBe(400);
    });

    test('should require at least one scope', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/tokens/01HX1F123456789ABCDEFGHIJK/tokens',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          label: 'Empty Scopes Token',
          scopes: []
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /tokens/:tokenId', () => {
    test('should update token label', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'PATCH',
        url: '/tokens/01HX1J123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          label: 'Updated Token Label'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.id).toBe('01HX1J123456789ABCDEFGHIJK');
      expect(payload.label).toBe('Updated Token Label');
      expect(payload.updatedAt).toBeDefined();
      // Secret should not be returned unless rotation requested
      expect(payload.secret).toBeUndefined();
    });

    test('should disable token', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'PATCH',
        url: '/tokens/01HX1J123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          status: 'disabled'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.status).toBe('disabled');
    });

    test('should rotate token secret', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'PATCH',
        url: '/tokens/01HX1J123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          rotate: true
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.secret).toBeDefined();
      expect(payload.secret).toMatch(/^miot_sk_/);
      expect(payload.updatedAt).toBeDefined();
    });

    test('should validate status enum', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'PATCH',
        url: '/tokens/01HX1J123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-admin-token'
        },
        payload: {
          status: 'invalid-status'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /tokens/:tokenId', () => {
    test('should revoke API token', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'DELETE',
        url: '/tokens/01HX1J123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-admin-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.message).toBe('API token successfully revoked');
      expect(payload.revokedAt).toBeDefined();
    });
  });
}); 