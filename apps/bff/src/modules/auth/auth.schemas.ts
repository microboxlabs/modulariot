import { FastifySchema } from 'fastify';

export const routeSchema = {
  signup: {
    description: 'User signup with email and password',
    tags: ['auth'],
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 }
      }
    },
    response: {
      201: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          emailVerificationSent: { type: 'boolean' }
        }
      }
    }
  } as FastifySchema,

  login: {
    description: 'User login with email and password',
    tags: ['auth'],
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: 'string' }
            }
          }
        }
      }
    }
  } as FastifySchema,

  oauthGoogle: {
    description: 'Google OAuth OIDC redirect flow',
    tags: ['auth'],
    body: {
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string' },
        state: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: 'string' }
            }
          }
        }
      }
    }
  } as FastifySchema,

  refresh: {
    description: 'Refresh access token using refresh token',
    tags: ['auth'],
    body: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' }
        }
      }
    }
  } as FastifySchema,

  logout: {
    description: 'Revoke current tokens and logout',
    tags: ['auth'],
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        }
      }
    }
  } as FastifySchema,

  me: {
    description: 'Get current user profile and organization info',
    tags: ['user'],
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          currentOrgId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  } as FastifySchema,

  organizations: {
    description: 'Get user organizations with roles',
    tags: ['user'],
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['owner', 'admin', 'member'] },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  } as FastifySchema
}; 