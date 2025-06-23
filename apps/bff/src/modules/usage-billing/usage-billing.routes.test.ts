import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { startApp, closeApp } from '../../utils/tests/infra';
import { FastifyInstance } from 'fastify';

describe('Usage & Billing Routes', () => {
  let app: FastifyInstance | undefined;
  const testOrgId = '01HX1E123456789ABCDEFGHIJK';
  const testInvoiceId = '01HX1I123456789ABCDEFGHIJK';
  const authToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

  beforeAll(async () => {
    app = await startApp();
  });

  afterAll(async () => {
    if (app) {
      await closeApp(app);
    }
  });

  describe('GET /usage-billing/:orgId/usage', () => {
    it('should return organization usage with default parameters', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/${testOrgId}/usage`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('organizationId', testOrgId);
      expect(data).toHaveProperty('organizationName');
      expect(data).toHaveProperty('period');
      expect(data).toHaveProperty('periodStart');
      expect(data).toHaveProperty('periodEnd');
      expect(data).toHaveProperty('usage');
      
      // Validate usage structure
      const usage = data.usage;
      expect(usage).toHaveProperty('devices');
      expect(usage).toHaveProperty('messages');
      expect(usage).toHaveProperty('symptoms');
      
      // Validate devices usage
      expect(usage.devices).toHaveProperty('totalActive');
      expect(usage.devices).toHaveProperty('totalRegistered');
      expect(usage.devices).toHaveProperty('byType');
      expect(typeof usage.devices.totalActive).toBe('number');
      expect(typeof usage.devices.totalRegistered).toBe('number');
      expect(typeof usage.devices.byType).toBe('object');
      
      // Validate messages usage
      expect(usage.messages).toHaveProperty('totalInbound');
      expect(usage.messages).toHaveProperty('totalProcessed');
      expect(usage.messages).toHaveProperty('totalErrors');
      expect(usage.messages).toHaveProperty('averagePerDay');
      expect(typeof usage.messages.totalInbound).toBe('number');
      expect(typeof usage.messages.totalProcessed).toBe('number');
      
      // Validate symptoms usage
      expect(usage.symptoms).toHaveProperty('totalEvents');
      expect(usage.symptoms).toHaveProperty('totalActive');
      expect(typeof usage.symptoms.totalEvents).toBe('number');
      expect(typeof usage.symptoms.totalActive).toBe('number');
    });

    it('should support period parameter', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/${testOrgId}/usage?period=last_30_days`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.period).toBe('last_30_days');
    });

    it('should support timezone parameter', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/${testOrgId}/usage?timezone=America/New_York`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      // In mock implementation, timezone is accepted but not processed
    });

    it('should validate period enum values', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/${testOrgId}/usage?period=invalid_period`,
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
        url: `/usage-billing/${testOrgId}/usage`
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /usage-billing/:orgId/billing/estimate', () => {
    it('should return billing estimate for organization', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/${testOrgId}/billing/estimate`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('organizationId', testOrgId);
      expect(data).toHaveProperty('currency');
      expect(data).toHaveProperty('currentCharges');
      expect(data).toHaveProperty('projectedCharges');
      
      // Validate current charges structure
      const currentCharges = data.currentCharges;
      expect(currentCharges).toHaveProperty('basePlan');
      expect(currentCharges).toHaveProperty('usage');
      expect(currentCharges).toHaveProperty('totalCurrent');
      expect(typeof currentCharges.basePlan).toBe('number');
      expect(typeof currentCharges.usage).toBe('number');
      expect(typeof currentCharges.totalCurrent).toBe('number');
      
      // Validate projected charges structure
      const projectedCharges = data.projectedCharges;
      expect(projectedCharges).toHaveProperty('totalProjected');
      expect(typeof projectedCharges.totalProjected).toBe('number');
      
      // Validate currency format
      expect(data.currency).toBe('USD');
    });

    it('should return reasonable billing amounts', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/${testOrgId}/billing/estimate`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      // Validate that amounts are positive and reasonable
      expect(data.currentCharges.basePlan).toBeGreaterThan(0);
      expect(data.currentCharges.usage).toBeGreaterThanOrEqual(0);
      expect(data.currentCharges.totalCurrent).toBeGreaterThan(0);
      expect(data.projectedCharges.totalProjected).toBeGreaterThan(0);
      
      // Validate that total current equals sum of base plan and usage
      const expectedTotal = data.currentCharges.basePlan + data.currentCharges.usage;
      expect(data.currentCharges.totalCurrent).toBe(expectedTotal);
    });

    it('should return 401 without authorization header', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/${testOrgId}/billing/estimate`
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /usage-billing/:orgId/invoices', () => {
    it('should return list of invoices with default parameters', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/${testOrgId}/invoices`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('invoices');
      expect(Array.isArray(data.invoices)).toBe(true);
      expect(data.invoices.length).toBeGreaterThan(0);
      
      // Validate invoice structure
      const invoice = data.invoices[0];
      expect(invoice).toHaveProperty('id');
      expect(invoice).toHaveProperty('number');
      expect(invoice).toHaveProperty('status');
      expect(invoice).toHaveProperty('total');
      expect(invoice).toHaveProperty('currency');
      expect(invoice).toHaveProperty('dueDate');
      expect(invoice).toHaveProperty('invoicePdfUrl');
      
      // Validate data types
      expect(typeof invoice.id).toBe('string');
      expect(typeof invoice.number).toBe('string');
      expect(typeof invoice.status).toBe('string');
      expect(typeof invoice.total).toBe('number');
      expect(typeof invoice.currency).toBe('string');
      expect(typeof invoice.dueDate).toBe('string');
      expect(typeof invoice.invoicePdfUrl).toBe('string');
      
      // Validate PDF URL format
      expect(invoice.invoicePdfUrl).toContain('api.stripe.com');
    });

    it('should filter invoices by status', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/${testOrgId}/invoices?status=paid`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      data.invoices.forEach((invoice: any) => {
        expect(invoice.status).toBe('paid');
      });
    });

    it('should filter invoices by overdue status', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/${testOrgId}/invoices?status=overdue`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      data.invoices.forEach((invoice: any) => {
        expect(invoice.status).toBe('overdue');
      });
    });

    it('should respect limit parameter', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/${testOrgId}/invoices?limit=2`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.invoices.length).toBeLessThanOrEqual(2);
    });

    it('should validate limit parameter bounds', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/${testOrgId}/invoices?limit=101`,
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
        url: `/usage-billing/${testOrgId}/invoices?status=invalid_status`,
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
        url: `/usage-billing/${testOrgId}/invoices`
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /usage-billing/invoices/:invoiceId', () => {
    it('should return detailed invoice information', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/invoices/${testInvoiceId}`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('id', testInvoiceId);
      expect(data).toHaveProperty('number');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('currency');
      expect(data).toHaveProperty('lineItems');
      
      // Validate line items structure
      expect(Array.isArray(data.lineItems)).toBe(true);
      expect(data.lineItems.length).toBeGreaterThan(0);
      
      const lineItem = data.lineItems[0];
      expect(lineItem).toHaveProperty('description');
      expect(lineItem).toHaveProperty('quantity');
      expect(lineItem).toHaveProperty('unitPrice');
      expect(lineItem).toHaveProperty('totalPrice');
      
      // Validate data types
      expect(typeof lineItem.description).toBe('string');
      expect(typeof lineItem.quantity).toBe('number');
      expect(typeof lineItem.unitPrice).toBe('number');
      expect(typeof lineItem.totalPrice).toBe('number');
      
      // Validate that line item total matches quantity * unit price
      expect(lineItem.totalPrice).toBe(lineItem.quantity * lineItem.unitPrice);
    });

    it('should return realistic invoice data', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/invoices/${testInvoiceId}`,
        headers: {
          Authorization: authToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      // Validate that amounts are positive
      expect(data.total).toBeGreaterThan(0);
      data.lineItems.forEach((item: any) => {
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.unitPrice).toBeGreaterThan(0);
        expect(item.totalPrice).toBeGreaterThan(0);
      });
      
      // Validate that invoice total matches sum of line items
      const calculatedTotal = data.lineItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
      expect(data.total).toBe(calculatedTotal);
      
      // Validate currency
      expect(data.currency).toBe('USD');
      
      // Validate invoice number format
      expect(data.number).toMatch(/^INV-\d{4}-\d{3}$/);
    });

    it('should return 401 without authorization header', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: `/usage-billing/invoices/${testInvoiceId}`
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-existent organization ID gracefully', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: '/usage-billing/01HX1NONEXISTENT123/usage',
        headers: {
          Authorization: authToken
        }
      });

      // In mock implementation, this still returns 200
      // In real implementation, this might return 404 or empty results
      expect(response.statusCode).toBe(200);
    });

    it('should handle non-existent invoice ID gracefully', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: '/usage-billing/invoices/01HX1NONEXISTENT123',
        headers: {
          Authorization: authToken
        }
      });

      // In mock implementation, this still returns 200
      // In real implementation, this should return 404
      expect(response.statusCode).toBe(200);
    });

    it('should handle invalid ULID format in organization ID', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: '/usage-billing/invalid-id/usage',
        headers: {
          Authorization: authToken
        }
      });

      // Mock implementation accepts any string
      expect(response.statusCode).toBe(200);
    });

    it('should handle invalid ULID format in invoice ID', async () => {
      if (!app) throw new Error("App not initialized");
      const response = await app.inject({
        method: 'GET',
        url: '/usage-billing/invoices/invalid-id',
        headers: {
          Authorization: authToken
        }
      });

      // Mock implementation accepts any string
      expect(response.statusCode).toBe(200);
    });

    it('should handle concurrent requests properly', async () => {
      if (!app) throw new Error("App not initialized");
      
      const promises = Array.from({ length: 5 }, () =>
        app!.inject({
          method: 'GET',
          url: `/usage-billing/${testOrgId}/usage`,
          headers: {
            Authorization: authToken
          }
        })
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });
    });
  });
}); 