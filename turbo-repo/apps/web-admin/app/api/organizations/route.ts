import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { nanoid } from 'nanoid'

const CreateOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(50, 'Organization name must be less than 50 characters'),
  plan: z.enum(['free', 'pro']),
  type: z.enum(['enterprise', 'personal', 'startup', 'non-profit']),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json() 
    const validatedData = CreateOrgSchema.parse(body)

    // Create slug from name
    const slug = validatedData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + nanoid(8)

    // TODO: Create organization in database
    const organization = await prisma.organization.create({
      data: {
        name: validatedData.name,
        slug,
        ownerId: session.user.id,
        typeId: validatedData.type,
        planId: validatedData.plan,
        memberships: {
          create: {
            userId: session.user.id,
            role: 'OWNER',
          }
        }
      },
      include: {
        memberships: true,
      }
    })

    return NextResponse.json(
      {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        role: 'OWNER',
        createdAt: organization.createdAt,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Invalid input', errors: error.issues },
        { status: 400 }
      )
    }

    console.error('Create organization error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
} 

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const includeProjects = request.nextUrl.searchParams.get('projects') === 'true';


  const organizations = await prisma.organization.findMany({
    where: {
      ownerId: session.user.id,
    },
    include: {
      projects: includeProjects,
    },
  });

  console.log(organizations);

  return NextResponse.json(organizations);
}