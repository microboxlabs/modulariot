/**
 * Auto-generated: DO NOT EDIT BY HAND
 * @module auth
 */

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { FastifyInstance } from "fastify";
import { closeApp, startApp } from "../../utils/tests/infra";

describe('Auth Routes', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await startApp();
  });

  afterAll(async () => {
    if (app) {
      await closeApp(app);
    }
  });

  describe('POST /auth/signup', () => {
    test('should create a new user account', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          email: 'test@example.com',
          password: 'password123'
        }
      });

      expect(response.statusCode).toBe(201);
      const payload = response.json();
      expect(payload.message).toContain('User created successfully');
      expect(payload.emailVerificationSent).toBe(true);
    });

    test('should validate email format', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          email: 'invalid-email',
          password: 'password123'
        }
      });

      expect(response.statusCode).toBe(400);
    });

    test('should validate password length', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          email: 'test@example.com',
          password: '123'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    test('should login with valid credentials', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.accessToken).toBeDefined();
      expect(payload.refreshToken).toBeDefined();
      expect(payload.user).toBeDefined();
      expect(payload.user.email).toBe('test@example.com');
    });

    test('should require email and password', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'test@example.com'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /auth/oauth/google', () => {
    test('should handle Google OAuth flow', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/auth/oauth/google',
        payload: {
          code: 'google-auth-code-123',
          state: 'random-state-string'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.accessToken).toBeDefined();
      expect(payload.refreshToken).toBeDefined();
      expect(payload.user).toBeDefined();
      expect(payload.user.email).toBe('user@gmail.com');
    });

    test('should require OAuth code', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/auth/oauth/google',
        payload: {
          state: 'random-state-string'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /auth/refresh', () => {
    test('should refresh tokens', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {
          refreshToken: 'valid-refresh-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.accessToken).toBeDefined();
      expect(payload.refreshToken).toBeDefined();
    });

    test('should require refresh token', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /auth/logout', () => {
    test('should logout successfully', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.message).toBe('Successfully logged out');
    });
  });

  describe('GET /user/me', () => {
    test('should return current user profile', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/user/me',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.id).toBeDefined();
      expect(payload.email).toBeDefined();
      expect(payload.name).toBeDefined();
      expect(payload.currentOrgId).toBeDefined();
      expect(payload.createdAt).toBeDefined();
      expect(payload.updatedAt).toBeDefined();
    });
  });

  describe('GET /user/organizations', () => {
    test('should return user organizations with roles', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'GET',
        url: '/user/organizations',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(Array.isArray(payload)).toBe(true);
      expect(payload.length).toBeGreaterThan(0);
      
      const org = payload[0];
      expect(org.id).toBeDefined();
      expect(org.name).toBeDefined();
      expect(org.role).toBeDefined();
      expect(['owner', 'admin', 'member']).toContain(org.role);
      expect(org.createdAt).toBeDefined();
    });
  });
}); 