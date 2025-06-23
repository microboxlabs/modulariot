/**
 * Auto-generated: DO NOT EDIT BY HAND
 * @module organizations
 */

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { FastifyInstance } from "fastify";
import { closeApp, startApp } from "../../utils/tests/infra";

describe('Organizations Routes', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await startApp();
  });

  afterAll(async () => {
    if (app) {
      await closeApp(app);
    }
  });

  describe('POST /organizations', () => {
    test('should create a new organization', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: {
          name: 'My New Organization'
        }
      });

      expect(response.statusCode).toBe(201);
      const payload = response.json();
      expect(payload.id).toBeDefined();
      expect(payload.name).toBe('My New Organization');
      expect(payload.ownerId).toBeDefined();
      expect(payload.createdAt).toBeDefined();
      expect(payload.updatedAt).toBeDefined();
    });

    test('should validate organization name is required', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: {}
      });

      expect(response.statusCode).toBe(400);
    });

    test('should validate organization name length', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: {
          name: ''
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /organizations/:orgId', () => {
    test('should get organization details', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/organizations/01HX1F123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.id).toBe('01HX1F123456789ABCDEFGHIJK');
      expect(payload.name).toBeDefined();
      expect(payload.ownerId).toBeDefined();
      expect(payload.memberCount).toBeDefined();
      expect(payload.createdAt).toBeDefined();
      expect(payload.updatedAt).toBeDefined();
    });
  });

  describe('PATCH /organizations/:orgId', () => {
    test('should update organization name', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'PATCH',
        url: '/organizations/01HX1F123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: {
          name: 'Updated Organization Name'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.id).toBe('01HX1F123456789ABCDEFGHIJK');
      expect(payload.name).toBe('Updated Organization Name');
      expect(payload.ownerId).toBeDefined();
      expect(payload.updatedAt).toBeDefined();
    });
  });

  describe('DELETE /organizations/:orgId', () => {
    test('should soft delete organization', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'DELETE',
        url: '/organizations/01HX1F123456789ABCDEFGHIJK',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.message).toBe('Organization successfully deleted');
      expect(payload.deletedAt).toBeDefined();
    });
  });

  describe('GET /organizations/:orgId/members', () => {
    test('should get organization members with roles', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/organizations/01HX1F123456789ABCDEFGHIJK/members',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(Array.isArray(payload)).toBe(true);
      expect(payload.length).toBeGreaterThan(0);
      
      const member = payload[0];
      expect(member.id).toBeDefined();
      expect(member.email).toBeDefined();
      expect(member.name).toBeDefined();
      expect(member.role).toBeDefined();
      expect(['owner', 'admin', 'member']).toContain(member.role);
      expect(member.joinedAt).toBeDefined();
    });
  });

  describe('POST /organizations/:orgId/invitations', () => {
    test('should create organization invitation', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/organizations/01HX1F123456789ABCDEFGHIJK/invitations',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: {
          email: 'newmember@example.com',
          role: 'member'
        }
      });

      expect(response.statusCode).toBe(201);
      const payload = response.json();
      expect(payload.id).toBeDefined();
      expect(payload.orgId).toBe('01HX1F123456789ABCDEFGHIJK');
      expect(payload.email).toBe('newmember@example.com');
      expect(payload.role).toBe('member');
      expect(payload.token).toBeDefined();
      expect(payload.expiresAt).toBeDefined();
      expect(payload.createdAt).toBeDefined();
    });

    test('should validate email format', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/organizations/01HX1F123456789ABCDEFGHIJK/invitations',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: {
          email: 'invalid-email',
          role: 'member'
        }
      });

      expect(response.statusCode).toBe(400);
    });

    test('should validate role enum', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/organizations/01HX1F123456789ABCDEFGHIJK/invitations',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: {
          email: 'test@example.com',
          role: 'invalid-role'
        }
      });

      expect(response.statusCode).toBe(400);
    });

    test('should require email and role', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/organizations/01HX1F123456789ABCDEFGHIJK/invitations',
        headers: {
          authorization: 'Bearer valid-token'
        },
        payload: {
          email: 'test@example.com'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /invitations/:token/accept', () => {
    test('should accept organization invitation', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/organizations/invitations/inv_1234567890abcdefghijklmnop/accept',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.message).toBe('Successfully joined organization');
      expect(payload.organization).toBeDefined();
      expect(payload.organization.id).toBeDefined();
      expect(payload.organization.name).toBeDefined();
      expect(payload.organization.role).toBeDefined();
    });
  });
}); 