/**
 * Auto-generated: DO NOT EDIT BY HAND
 * @module organizations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { routeSchema } from './organizations.schemas';

export default async function organizationsRoutes(fastify: FastifyInstance) {
  // POST /organizations
  fastify.post('/', {
    schema: routeSchema.createOrganization
  }, async (request, reply) => {
    const { name } = request.body as { name: string };
    
    // TODO: Extract user from JWT token
    // TODO: Create organization in database
    // TODO: Set creator as owner
    
    return reply.code(201).send({
      id: '01HX1F123456789ABCDEFGHIJK',
      name: name,
      ownerId: '01HX1E123456789ABCDEFGHIJK',
      createdAt: '2024-01-20T15:30:00Z',
      updatedAt: '2024-01-20T15:30:00Z'
    });
  });

  // GET /organizations/:orgId
  fastify.get('/:orgId', {
    schema: routeSchema.getOrganization
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string };
    
    // TODO: Extract user from JWT token
    // TODO: Verify user has read access to organization
    // TODO: Fetch organization from database
    
    return {
      id: orgId,
      name: 'Acme Corporation',
      ownerId: '01HX1E123456789ABCDEFGHIJK',
      memberCount: 12,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-18T14:22:00Z'
    };
  });

  // PATCH /organizations/:orgId
  fastify.patch('/:orgId', {
    schema: routeSchema.updateOrganization
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string };
    const { name } = request.body as { name?: string };
    
    // TODO: Extract user from JWT token
    // TODO: Verify user is organization owner
    // TODO: Update organization in database
    
    return {
      id: orgId,
      name: name || 'Updated Organization Name',
      ownerId: '01HX1E123456789ABCDEFGHIJK',
      updatedAt: '2024-01-20T16:45:00Z'
    };
  });

  // DELETE /organizations/:orgId
  fastify.delete('/:orgId', {
    schema: routeSchema.deleteOrganization
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string };
    
    // TODO: Extract user from JWT token
    // TODO: Verify user is organization owner  
    // TODO: Soft delete organization in database
    // TODO: Handle member cleanup and notifications
    
    return {
      message: 'Organization successfully deleted',
      deletedAt: '2024-01-20T17:00:00Z'
    };
  });

  // GET /organizations/:orgId/members
  fastify.get('/:orgId/members', {
    schema: routeSchema.getMembers
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string };
    
    // TODO: Extract user from JWT token
    // TODO: Verify user has admin role in organization
    // TODO: Fetch members from database
    
    return [
      {
        id: '01HX1E123456789ABCDEFGHIJK',
        email: 'owner@acme.com',
        name: 'John Owner',
        role: 'owner',
        joinedAt: '2024-01-15T10:30:00Z'
      },
      {
        id: '01HX1G123456789ABCDEFGHIJK',
        email: 'admin@acme.com',
        name: 'Jane Admin',
        role: 'admin',
        joinedAt: '2024-01-16T09:15:00Z'
      },
      {
        id: '01HX1H123456789ABCDEFGHIJK',
        email: 'member@acme.com',
        name: 'Bob Member',
        role: 'member',
        joinedAt: '2024-01-17T14:20:00Z'
      }
    ];
  });

  // POST /organizations/:orgId/invitations
  fastify.post('/:orgId/invitations', {
    schema: routeSchema.createInvitation
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string };
    const { email, role } = request.body as { email: string; role: string };
    
    // TODO: Extract user from JWT token
    // TODO: Verify user has admin role in organization
    // TODO: Check if user is already a member
    // TODO: Create invitation in database
    // TODO: Send invitation email
    
    return reply.code(201).send({
      id: '01HX1I123456789ABCDEFGHIJK',
      orgId: orgId,
      email: email,
      role: role,
      token: 'inv_1234567890abcdefghijklmnop',
      expiresAt: '2024-01-27T17:00:00Z',
      createdAt: '2024-01-20T17:00:00Z'
    });
  });

  // POST /invitations/:token/accept
  fastify.post('/invitations/:token/accept', {
    schema: routeSchema.acceptInvitation
  }, async (request, reply) => {
    const { token } = request.params as { token: string };
    
    // TODO: Extract user from JWT token
    // TODO: Validate invitation token
    // TODO: Check invitation hasn't expired
    // TODO: Add user to organization with specified role
    // TODO: Mark invitation as accepted
    
    return {
      message: 'Successfully joined organization',
      organization: {
        id: '01HX1F123456789ABCDEFGHIJK',
        name: 'Acme Corporation',
        role: 'member'
      }
    };
  });
} 