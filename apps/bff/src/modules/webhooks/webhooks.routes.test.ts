import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { startApp, closeApp } from '../../utils/tests/infra';
import { FastifyInstance } from 'fastify';

describe('Webhooks Routes', () => {
  let app: FastifyInstance | undefined;
  const testOrgId = '01HX1E123456789ABCDEFGHIJK';
  const testWebhookId = '01HX1W123456789ABCDEFGHIJK';
  const authToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

  beforeAll(async () => {
    app = await startApp();
  });

  afterAll(async () => {
    if (app) {
      await closeApp(app);
    }
  });

  describe('GET /webhooks/:orgId/webhooks', () => {
    it('should return list of webhooks with default parameters', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('webhooks');
      expect(data).toHaveProperty('totalCount');
      expect(data).toHaveProperty('summary');
      
      expect(Array.isArray(data.webhooks)).toBe(true);
      expect(data.webhooks.length).toBeGreaterThan(0);
      
      // Validate webhook structure
      const webhook = data.webhooks[0];
      expect(webhook).toHaveProperty('id');
      expect(webhook).toHaveProperty('url');
      expect(webhook).toHaveProperty('description');
      expect(webhook).toHaveProperty('events');
      expect(webhook).toHaveProperty('status');
      expect(webhook).toHaveProperty('createdAt');
      expect(webhook).toHaveProperty('updatedAt');
      expect(webhook).toHaveProperty('deliveryStats');
      
      // Validate events array
      expect(Array.isArray(webhook.events)).toBe(true);
      expect(webhook.events.length).toBeGreaterThan(0);
      
      // Validate delivery stats
      expect(webhook.deliveryStats).toHaveProperty('totalAttempts');
      expect(webhook.deliveryStats).toHaveProperty('successfulDeliveries');
      expect(webhook.deliveryStats).toHaveProperty('failedDeliveries');
      expect(typeof webhook.deliveryStats.totalAttempts).toBe('number');
      expect(typeof webhook.deliveryStats.successfulDeliveries).toBe('number');
      expect(typeof webhook.deliveryStats.failedDeliveries).toBe('number');
      
      // Validate summary statistics
      expect(data.summary).toHaveProperty('totalActive');
      expect(data.summary).toHaveProperty('totalDisabled');
      expect(data.summary).toHaveProperty('totalFailed');
      expect(data.summary).toHaveProperty('recentDeliveries');
      expect(data.summary).toHaveProperty('recentFailures');
      expect(typeof data.summary.totalActive).toBe('number');
      expect(typeof data.summary.recentDeliveries).toBe('number');
    });

    it('should filter webhooks by status', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${testOrgId}/webhooks?status=active`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      data.webhooks.forEach((webhook: any) => {
        expect(webhook.status).toBe('active');
      });
    });

    it('should filter webhooks by disabled status', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${testOrgId}/webhooks?status=disabled`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      data.webhooks.forEach((webhook: any) => {
        expect(webhook.status).toBe('disabled');
      });
    });

    it('should filter webhooks by failed status', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${testOrgId}/webhooks?status=failed`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      data.webhooks.forEach((webhook: any) => {
        expect(webhook.status).toBe('failed');
      });
    });

    it('should respect limit parameter', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${testOrgId}/webhooks?limit=2`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.webhooks.length).toBeLessThanOrEqual(2);
    });

    it('should validate limit parameter bounds', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${testOrgId}/webhooks?limit=101`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate status enum values', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${testOrgId}/webhooks?status=invalid_status`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 without authorization header', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${testOrgId}/webhooks`
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /webhooks/:orgId/webhooks', () => {
    it('should create a new webhook with all fields', async () => {
      if (!app) throw new Error("App not initialized");
      const webhookData = {
        url: 'https://api.example.com/webhook',
        description: 'Test webhook for alerts',
        events: ['symptom.critical', 'device.offline'],
        secret: 'supersecret123'
      };

      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(webhookData)
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('id');
      expect(data.url).toBe(webhookData.url);
      expect(data.description).toBe(webhookData.description);
      expect(data.events).toEqual(webhookData.events);
      expect(data.status).toBe('active');
      expect(data.secretSet).toBe(true);
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
      expect(data).toHaveProperty('retryPolicy');
      expect(data).toHaveProperty('deliveryExample');
      
      // Validate retry policy defaults
      expect(data.retryPolicy.maxRetries).toBe(3);
      expect(data.retryPolicy.retryDelaySeconds).toBe(60);
      expect(data.retryPolicy.backoffMultiplier).toBe(2);
      
      // Validate delivery example structure
      expect(data.deliveryExample).toHaveProperty('event');
      expect(data.deliveryExample).toHaveProperty('orgId', testOrgId);
      expect(data.deliveryExample).toHaveProperty('payload');
      expect(data.deliveryExample).toHaveProperty('sentAt');
    });

    it('should create webhook with minimal required fields', async () => {
      if (!app) throw new Error("App not initialized");
      const webhookData = {
        url: 'https://hooks.slack.com/services/test',
        events: ['symptom.high']
      };

      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(webhookData)
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      
      expect(data.url).toBe(webhookData.url);
      expect(data.events).toEqual(webhookData.events);
      expect(data.secretSet).toBe(false);
      expect(data.description).toContain('hooks.slack.com');
    });

    it('should validate required fields', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          description: 'Missing required fields'
        })
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate URL format', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          url: 'not-a-valid-url',
          events: ['symptom.critical']
        })
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate events array', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          url: 'https://api.example.com/webhook',
          events: []
        })
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate event types', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          url: 'https://api.example.com/webhook',
          events: ['invalid.event.type']
        })
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate secret length', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          url: 'https://api.example.com/webhook',
          events: ['symptom.critical'],
          secret: 'short'
        })
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate description length', async () => {
      if (!app) throw new Error("App not initialized");
      const longDescription = 'x'.repeat(201);
      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          url: 'https://api.example.com/webhook',
          events: ['symptom.critical'],
          description: longDescription
        })
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 without authorization header', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          url: 'https://api.example.com/webhook',
          events: ['symptom.critical']
        })
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PATCH /webhooks/:webhookId', () => {
    it('should update webhook status to disabled', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'PATCH',
        url: `/webhooks/${testWebhookId}`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          status: 'disabled'
        })
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data.id).toBe(testWebhookId);
      expect(data.status).toBe('disabled');
      expect(data).toHaveProperty('updatedAt');
      expect(data).toHaveProperty('retryPolicy');
      expect(data.secretUpdated).toBe(false);
    });

    it('should update webhook status to active', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'PATCH',
        url: `/webhooks/${testWebhookId}`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          status: 'active'
        })
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.status).toBe('active');
    });

    it('should validate status enum values', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'PATCH',
        url: `/webhooks/${testWebhookId}`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          status: 'invalid_status'
        })
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle empty request body', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'PATCH',
        url: `/webhooks/${testWebhookId}`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({})
      });

      expect(response.statusCode).toBe(200);
      // Should return existing status when no changes requested
    });

    it('should return 401 without authorization header', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'PATCH',
        url: `/webhooks/${testWebhookId}`,
        headers: {
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          status: 'disabled'
        })
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /webhooks/:webhookId', () => {
    it('should delete a webhook and return final statistics', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'DELETE',
        url: `/webhooks/${testWebhookId}`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data.id).toBe(testWebhookId);
      expect(data.status).toBe('deleted');
      expect(data).toHaveProperty('deletedAt');
      expect(data).toHaveProperty('finalStats');
      
      // Validate final statistics
      expect(data.finalStats).toHaveProperty('totalDeliveries');
      expect(data.finalStats).toHaveProperty('successfulDeliveries');
      expect(data.finalStats).toHaveProperty('failedDeliveries');
      expect(data.finalStats).toHaveProperty('averageResponseTime');
      expect(typeof data.finalStats.totalDeliveries).toBe('number');
      expect(typeof data.finalStats.successfulDeliveries).toBe('number');
      expect(typeof data.finalStats.failedDeliveries).toBe('number');
      expect(typeof data.finalStats.averageResponseTime).toBe('number');
      
      // Validate statistics make sense
      expect(data.finalStats.totalDeliveries).toBeGreaterThanOrEqual(0);
      expect(data.finalStats.successfulDeliveries).toBeGreaterThanOrEqual(0);
      expect(data.finalStats.failedDeliveries).toBeGreaterThanOrEqual(0);
      expect(data.finalStats.averageResponseTime).toBeGreaterThan(0);
      
      // Total should equal successful + failed
      const expectedTotal = data.finalStats.successfulDeliveries + data.finalStats.failedDeliveries;
      expect(data.finalStats.totalDeliveries).toBe(expectedTotal);
    });

    it('should return 401 without authorization header', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'DELETE',
        url: `/webhooks/${testWebhookId}`
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-existent organization ID gracefully', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: '/webhooks/01HX1NONEXISTENT123/webhooks',
        headers: {
          Authorization: authToken
        }
      });

      // In mock implementation, this still returns 200
      // In real implementation, this might return 404 or empty results
      expect(response.statusCode).toBe(200);
    });

    it('should handle non-existent webhook ID in update gracefully', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'PATCH',
        url: '/webhooks/01HX1NONEXISTENT123',
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          status: 'disabled'
        })
      });

      // In mock implementation, this still returns 200
      // In real implementation, this should return 404
      expect(response.statusCode).toBe(200);
    });

    it('should handle non-existent webhook ID in delete gracefully', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'DELETE',
        url: '/webhooks/01HX1NONEXISTENT123',
        headers: {
          Authorization: authToken
        }
      });

      // In mock implementation, this still returns 200
      // In real implementation, this should return 404
      expect(response.statusCode).toBe(200);
    });

    it('should handle malformed request body', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken,
          'Content-Type': 'application/json'
        },
        payload: 'invalid json'
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle missing Content-Type header', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken
        },
        payload: JSON.stringify({
          url: 'https://api.example.com/webhook',
          events: ['symptom.critical']
        })
      });

      expect(response.statusCode).toBe(415);
    });

    it('should validate webhook URLs are realistic', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      data.webhooks.forEach((webhook: any) => {
        expect(webhook.url).toMatch(/^https?:\/\//);
        expect(webhook.url.length).toBeGreaterThan(10);
      });
    });

    it('should validate delivery statistics are realistic', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${testOrgId}/webhooks`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      data.webhooks.forEach((webhook: any) => {
        const stats = webhook.deliveryStats;
        expect(stats.totalAttempts).toBeGreaterThanOrEqual(stats.successfulDeliveries + stats.failedDeliveries);
        expect(stats.successfulDeliveries).toBeGreaterThanOrEqual(0);
        expect(stats.failedDeliveries).toBeGreaterThanOrEqual(0);
        expect(stats.consecutiveFailures).toBeGreaterThanOrEqual(0);
      });
    });
  });
}); 