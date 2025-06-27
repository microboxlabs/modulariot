import { getServerSession } from 'next-auth'
import { prisma } from '@miot/db'
import { z } from 'zod'

export const ProjectIdSchema = z.string().cuid()

export async function assertOrgOwner(projectId: string): Promise<void> {
  const validatedProjectId = ProjectIdSchema.parse(projectId)
  
  const session = await getServerSession()
  if (!session?.user?.id) {
    throw new Error('Unauthenticated')
  }

  const project = await prisma.project.findUnique({
    where: { id: validatedProjectId },
    include: { 
      organization: { 
        include: { 
          memberships: true 
        } 
      } 
    }
  })

  if (!project) {
    throw new Error('Project not found')
  }

  const membership = project.organization.memberships.find(
    m => m.userId === session.user.id
  )

  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    throw new Error('Forbidden: Insufficient permissions')
  }
}

export async function assertOrgOwnerForOrg(organizationId: string): Promise<void> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    throw new Error('Unauthenticated')
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_orgId: {
        userId: session.user.id,
        orgId: organizationId
      }
    }
  })

  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    throw new Error('Forbidden: Insufficient permissions')
  }
}