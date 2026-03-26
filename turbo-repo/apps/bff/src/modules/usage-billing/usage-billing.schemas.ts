import { FastifySchema } from 'fastify';

export const routeSchema = {
  getOrganizationUsage: {
    description: 'Get rolled-up usage counters for an organization (devices, messages, etc.)',
    tags: ['usage-billing'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['orgId'],
      properties: {
        orgId: { type: 'string' }
      }
    },
    querystring: {
      type: 'object',
      properties: {
        period: { 
          type: 'string', 
          enum: ['current_month', 'last_month', 'last_7_days', 'last_30_days'],
          default: 'current_month'
        },
        timezone: { 
          type: 'string', 
          default: 'UTC'
        }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          organizationId: { type: 'string' },
          organizationName: { type: 'string' },
          period: { type: 'string' },
          periodStart: { type: 'string', format: 'date-time' },
          periodEnd: { type: 'string', format: 'date-time' },
          usage: {
            type: 'object',
            properties: {
              devices: {
                type: 'object',
                properties: {
                  totalActive: { type: 'number' },
                  totalRegistered: { type: 'number' },
                  byType: {
                    type: 'object',
                    additionalProperties: { type: 'number' }
                  }
                }
              },
              messages: {
                type: 'object',
                properties: {
                  totalInbound: { type: 'number' },
                  totalProcessed: { type: 'number' },
                  totalErrors: { type: 'number' },
                  averagePerDay: { type: 'number' }
                }
              },
              symptoms: {
                type: 'object',
                properties: {
                  totalEvents: { type: 'number' },
                  totalActive: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  } as FastifySchema,

  getBillingEstimate: {
    description: 'Get projected cost estimate for the current month',
    tags: ['usage-billing'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['orgId'],
      properties: {
        orgId: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          organizationId: { type: 'string' },
          currency: { type: 'string' },
          currentCharges: {
            type: 'object',
            properties: {
              basePlan: { type: 'number' },
              usage: { type: 'number' },
              totalCurrent: { type: 'number' }
            }
          },
          projectedCharges: {
            type: 'object',
            properties: {
              totalProjected: { type: 'number' }
            }
          }
        }
      }
    }
  } as FastifySchema,

  getOrganizationInvoices: {
    description: 'Get list of invoices for an organization',
    tags: ['usage-billing'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['orgId'],
      properties: {
        orgId: { type: 'string' }
      }
    },
    querystring: {
      type: 'object',
      properties: {
        status: { 
          type: 'string', 
          enum: ['all', 'paid', 'unpaid', 'overdue'] 
        },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          invoices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                number: { type: 'string' },
                status: { type: 'string' },
                total: { type: 'number' },
                currency: { type: 'string' },
                dueDate: { type: 'string', format: 'date' },
                paidAt: { type: 'string', format: 'date-time' },
                invoicePdfUrl: { type: 'string' }
              }
            }
          }
        }
      }
    }
  } as FastifySchema,

  getInvoiceDetails: {
    description: 'Get detailed invoice information including PDF link and line items',
    tags: ['usage-billing'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['invoiceId'],
      properties: {
        invoiceId: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          number: { type: 'string' },
          status: { type: 'string' },
          total: { type: 'number' },
          currency: { type: 'string' },
          lineItems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                quantity: { type: 'number' },
                unitPrice: { type: 'number' },
                totalPrice: { type: 'number' }
              }
            }
          }
        }
      }
    }
  } as FastifySchema
}; 