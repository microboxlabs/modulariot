import { FastifySchema } from 'fastify';

export const routeSchema = {
  createOrganization: {
    description: 'Create a new organization',
    tags: ['organizations'],
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 }
      }
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          ownerId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  getOrganization: {
    description: 'Get organization details',
    tags: ['organizations'],
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
          id: { type: 'string' },
          name: { type: 'string' },
          ownerId: { type: 'string' },
          memberCount: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  updateOrganization: {
    description: 'Update organization (owner only)',
    tags: ['organizations'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['orgId'],
      properties: {
        orgId: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          ownerId: { type: 'string' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  deleteOrganization: {
    description: 'Soft delete organization (owner only)',
    tags: ['organizations'],
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
          message: { type: 'string' },
          deletedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  getMembers: {
    description: 'Get organization members with roles (admin only)',
    tags: ['organizations'],
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
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['owner', 'admin', 'member'] },
            joinedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  } as FastifySchema,

  createInvitation: {
    description: 'Create organization invitation (admin only)',
    tags: ['organizations', 'invitations'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['orgId'],
      properties: {
        orgId: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      required: ['email', 'role'],
      properties: {
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: ['admin', 'member'] }
      }
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          orgId: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
          token: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  acceptInvitation: {
    description: 'Accept organization invitation',
    tags: ['invitations'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          organization: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              role: { type: 'string' }
            }
          }
        }
      }
    }
  } as FastifySchema
}; 