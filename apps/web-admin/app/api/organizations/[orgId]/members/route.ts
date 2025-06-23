import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/db'
import { Membership, User } from '@modulariot/db'

type MemberWithUser = Membership & {
    user: Pick<User, 'id' | 'name' | 'email' | 'image'>
}

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = params

    // Check if the user is a member of the organization
    const membership = await prisma.membership.findFirst({
        where: {
            userId: session.user.id,
            orgId: orgId,
        }
    });

    if (!membership) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    // Fetch members of the organization
    const members = await prisma.membership.findMany({
      where: { orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          }
        }
      }
    });

    const formattedMembers = members.map((m: MemberWithUser) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
    }));

    return NextResponse.json(formattedMembers)
  } catch (error) {
    console.error('Get members error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
} 