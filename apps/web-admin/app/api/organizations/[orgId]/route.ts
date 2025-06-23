import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/db'

const UpdateOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(50, 'Organization name must be less than 50 characters'),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = params;
    const body = await request.json()
    const validatedData = UpdateOrgSchema.parse(body)

    // Verify that the user is an OWNER of the org
    const membership = await prisma.membership.findFirst({
        where: {
            userId: session.user.id,
            orgId: orgId,
            role: 'OWNER'
        }
    });

    if (!membership) {
        return NextResponse.json({ message: 'Forbidden: Only the organization owner can change the name.' }, { status: 403 })
    }

    const updatedOrganization = await prisma.organization.update({
        where: { id: orgId },
        data: { name: validatedData.name },
    });

    return NextResponse.json(updatedOrganization)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.issues }, { status: 400 })
    }

    console.error('Update organization error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
} 