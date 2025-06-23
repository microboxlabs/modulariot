import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { nanoid } from 'nanoid'

const InviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['MEMBER', 'ADMIN']),
  orgId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = InviteMemberSchema.parse(body)
    
    // TODO: Verify that the current user has ADMIN or OWNER role in the org
    // For now, we'll just check for membership
    const membership = await prisma.membership.findFirst({
        where: {
            userId: session.user.id,
            orgId: validatedData.orgId,
            // role: { in: ['ADMIN', 'OWNER'] } // <-- Add this check later
        }
    });

    if (!membership) {
        return NextResponse.json({ message: 'Forbidden: You are not a member of this organization.' }, { status: 403 })
    }

    // Check if user is already a member
    const existingMember = await prisma.user.findFirst({
        where: { email: validatedData.email },
        include: { memberships: { where: { orgId: validatedData.orgId } } }
    });

    if (existingMember && existingMember.memberships.length > 0) {
        return NextResponse.json({ message: 'User is already a member of this organization' }, { status: 409 });
    }

    // Create invitation
    const invitationToken = nanoid(32);
    const invitation = await prisma.invitation.create({
      data: {
        email: validatedData.email,
        role: validatedData.role,
        orgId: validatedData.orgId,
        token: invitationToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    })

    // TODO: Send invitation email with the token link

    return NextResponse.json(
      {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token // Sending token in response for now for easy testing
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.issues }, { status: 400 })
    }

    console.error('Create invitation error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
} 