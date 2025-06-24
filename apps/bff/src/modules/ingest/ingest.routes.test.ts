/**
 * Auto-generated: DO NOT EDIT BY HAND
 * @module ingest
 */
import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { FastifyInstance } from 'fastify';
import { closeApp, startApp } from "../../utils/tests/infra";
import * as zlib from 'zlib';

describe('Ingest Routes', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await startApp();
  });

  afterAll(async () => {
    if (app) {
      await closeApp(app);
    }
  });

  describe('POST /ingest', () => {
    test('should reject requests without Bearer token', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/ingest',
        headers: {
          'content-type': 'application/x-ndjson'
        },
        payload: '{"deviceId":"01HX1E123456789","ts":1719081723000,"type":"gps","lat":-33.2031,"lon":-70.6695}'
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({
        error: 'MISSING_TOKEN',
        message: 'Bearer token required'
      });
    });

    test('should reject requests with invalid token', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/ingest',
        headers: {
          'content-type': 'application/x-ndjson',
          'authorization': 'Bearer invalid'
        },
        payload: '{"deviceId":"01HX1E123456789","ts":1719081723000,"type":"gps","lat":-33.2031,"lon":-70.6695}'
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      });
    });

    test('should reject requests with insufficient scope', async () => {
      if (!app) throw new Error("App not initialized");

      const response = await app.inject({
        method: 'POST',
        url: '/ingest',
        headers: {
          'content-type': 'application/x-ndjson',
          'authorization': 'Bearer no-ingest-scope'
        },
        payload: '{"deviceId":"01HX1E123456789","ts":1719081723000,"type":"gps","lat":-33.2031,"lon":-70.6695}'
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toEqual({
        error: 'INSUFFICIENT_SCOPE',
        message: 'Token requires ingest scope'
      });
    });

    test('should process valid NDJSON GPS data', async () => {
      if (!app) throw new Error("App not initialized");

      const ndjsonPayload = [
        '{"deviceId":"01HX1E123456789","ts":1719081723000,"type":"gps","lat":-33.2031,"lon":-70.6695,"speedKph":78.2}',
        '{"deviceId":"01HX1E987654321","ts":1719081724000,"type":"gps","lat":-33.2032,"lon":-70.6696,"speedKph":65.5}'
      ].join('\n');

      const response = await app.inject({
        method: 'POST',
        url: '/ingest',
        headers: {
          'content-type': 'application/x-ndjson',
          'authorization': 'Bearer valid-token'
        },
        payload: ndjsonPayload
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        processed: 2,
        errors: []
      });
    });

    test('should process mixed data types in NDJSON', async () => {
      if (!app) throw new Error("App not initialized");

      const ndjsonPayload = [
        '{"deviceId":"01HX1E123456789","ts":1719081723000,"type":"gps","lat":-33.2031,"lon":-70.6695}',
        '{"deviceId":"01HX1E987654321","ts":1719081724000,"type":"temperature","value":23.5,"unit":"celsius"}',
        '{"deviceId":"01HX1E555555555","ts":1719081725000,"type":"vibration","x":0.1,"y":0.2,"z":9.8}'
      ].join('\n');

      const response = await app.inject({
        method: 'POST',
        url: '/ingest',
        headers: {
          'content-type': 'application/x-ndjson',
          'authorization': 'Bearer valid-token'
        },
        payload: ndjsonPayload
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        processed: 3,
        errors: []
      });
    });

    test('should handle malformed JSON lines', async () => {
      if (!app) throw new Error("App not initialized");

      const ndjsonPayload = [
        '{"deviceId":"01HX1E123456789","ts":1719081723000,"type":"gps","lat":-33.2031,"lon":-70.6695}',
        'invalid-json-line',
        '{"deviceId":"01HX1E987654321","ts":1719081724000,"type":"temperature","value":23.5}'
      ].join('\n');

      const response = await app.inject({
        method: 'POST',
        url: '/ingest',
        headers: {
          'content-type': 'application/x-ndjson',
          'authorization': 'Bearer valid-token'
        },
        payload: ndjsonPayload
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        processed: 2,
        errors: [
          {
            line: 2,
            error: 'Invalid JSON format',
            data: 'invalid-json-line'
          }
        ]
      });
    });

    test('should validate required fields', async () => {
      if (!app) throw new Error("App not initialized");

      const ndjsonPayload = [
        '{"deviceId":"01HX1E123456789","ts":1719081723000,"type":"gps","lat":-33.2031,"lon":-70.6695}',
        '{"deviceId":"01HX1E987654321","type":"temperature"}', // missing ts
        '{"ts":1719081725000,"type":"vibration"}' // missing deviceId
      ].join('\n');

      const response = await app.inject({
        method: 'POST',
        url: '/ingest',
        headers: {
          'content-type': 'application/x-ndjson',
          'authorization': 'Bearer valid-token'
        },
        payload: ndjsonPayload
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        processed: 1,
        errors: [
          {
            line: 2,
            error: 'Missing required fields: deviceId, ts, type',
            data: '{"deviceId":"01HX1E987654321","type":"temperature"}'
          },
          {
            line: 3,
            error: 'Missing required fields: deviceId, ts, type',
            data: '{"ts":1719081725000,"type":"vibration"}'
          }
        ]
      });
    });

    test('should handle gzipped content', async () => {
      if (!app) throw new Error("App not initialized");

      const ndjsonPayload = '{"deviceId":"01HX1E123456789","ts":1719081723000,"type":"gps","lat":-33.2031,"lon":-70.6695}';
      const gzippedPayload = zlib.gzipSync(Buffer.from(ndjsonPayload));

      const response = await app.inject({
        method: 'POST',
        url: '/ingest',
        headers: {
          'content-type': 'application/x-ndjson',
          'content-encoding': 'gzip',
          'authorization': 'Bearer valid-token'
        },
        payload: gzippedPayload
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        processed: 1,
        errors: []
      });
    });

    test('should handle empty lines in NDJSON', async () => {
      if (!app) throw new Error("App not initialized");

      const ndjsonPayload = [
        '{"deviceId":"01HX1E123456789","ts":1719081723000,"type":"gps","lat":-33.2031,"lon":-70.6695}',
        '', // empty line
        '   ', // whitespace only
        '{"deviceId":"01HX1E987654321","ts":1719081724000,"type":"temperature","value":23.5}'
      ].join('\n');

      const response = await app.inject({
        method: 'POST',
        url: '/ingest',
        headers: {
          'content-type': 'application/x-ndjson',
          'authorization': 'Bearer valid-token'
        },
        payload: ndjsonPayload
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        processed: 2,
        errors: []
      });
    });

    test('should reject invalid gzip content', async () => {
      if (!app) throw new Error("App not initialized");

      const invalidGzipPayload = Buffer.from('not-gzipped-content');

      const response = await app.inject({
        method: 'POST',
        url: '/ingest',
        headers: {
          'content-type': 'application/x-ndjson',
          'content-encoding': 'gzip',
          'authorization': 'Bearer valid-token'
        },
        payload: invalidGzipPayload
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'INVALID_COMPRESSION',
        message: 'Failed to decompress gzipped content'
      });
    });

    test('should handle text/plain content type', async () => {
      if (!app) throw new Error("App not initialized");

      const ndjsonPayload = '{"deviceId":"01HX1E123456789","ts":1719081723000,"type":"gps","lat":-33.2031,"lon":-70.6695}';

      const response = await app.inject({
        method: 'POST',
        url: '/ingest',
        headers: {
          'content-type': 'text/plain',
          'authorization': 'Bearer valid-token'
        },
        payload: ndjsonPayload
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.processed).toBe(1);
    });
  });
}); 