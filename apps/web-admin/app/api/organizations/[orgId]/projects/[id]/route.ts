import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { nanoid } from 'nanoid'

type GetProjectParams = { 
    params: { id: string, orgId: string };
  };

export async function GET(request: NextRequest,  { params }: GetProjectParams) {

    const session = await auth();
  
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        orgId: params.orgId
      },
    });
  
    if (!membership) {
      return NextResponse.json({ message: 'Forbidden: Only organization members can view the project.' }, { status: 403 });
    }
  
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        organization: true,
      },
    });
  
    return NextResponse.json(project);
}

export async function DELETE(request: NextRequest,  { params }: GetProjectParams) {

    const session = await auth();
  
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        orgId: params.orgId,
        role: {
          in: ['ADMIN', 'OWNER']
        }
      },
    });

    if (!membership) {
      return NextResponse.json({ message: 'Forbidden: Only organization members can delete the project.' }, { status: 403 });
    }

    await prisma.project.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Project deleted successfully' });
}