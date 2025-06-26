import { PrismaClient } from '../generated/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create organization types
  const personalType = await prisma.organizationType.upsert({
    where: { name: 'personal' },
    update: {},
    create: {
      name: 'personal',
      description: 'Personal organization for individual users',
      defaultLimits: {
        maxProjects: 3,
        maxMembers: 1,
        maxStorage: 1024 * 1024 * 100 // 100MB
      }
    },
  })

  const businessType = await prisma.organizationType.upsert({
    where: { name: 'business' },
    update: {},
    create: {
      name: 'business',
      description: 'Business organization for teams and companies',
      defaultLimits: {
        maxProjects: 50,
        maxMembers: 100,
        maxStorage: 1024 * 1024 * 1024 * 10 // 10GB
      }
    },
  })

  console.log(`Created organization types: ${personalType.name}, ${businessType.name}`)

  // Create plans
  const freePlan = await prisma.plan.upsert({
    where: { name: 'free' },
    update: {},
    create: {
      name: 'free',
      description: 'Free tier with basic features',
      price: 0,
      features: {
        maxProjects: 3,
        maxMembers: 3,
        maxStorage: 1024 * 1024 * 100, // 100MB
        analytics: false,
        priority_support: false
      }
    },
  })

  const proPlan = await prisma.plan.upsert({
    where: { name: 'pro' },
    update: {},
    create: {
      name: 'pro',
      description: 'Professional tier with advanced features',
      price: 1999, // $19.99 in cents
      features: {
        maxProjects: 25,
        maxMembers: 10,
        maxStorage: 1024 * 1024 * 1024 * 5, // 5GB
        analytics: true,
        priority_support: true
      }
    },
  })

  const teamPlan = await prisma.plan.upsert({
    where: { name: 'team' },
    update: {},
    create: {
      name: 'team',
      description: 'Team tier for larger organizations',
      price: 4999, // $49.99 in cents
      features: {
        maxProjects: 100,
        maxMembers: 50,
        maxStorage: 1024 * 1024 * 1024 * 25, // 25GB
        analytics: true,
        priority_support: true,
        custom_branding: true
      }
    },
  })

  console.log(`Created plans: ${freePlan.name}, ${proPlan.name}, ${teamPlan.name}`)

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@miot.dev' },
    update: {},
    create: {
      email: 'demo@miot.dev',
      name: 'Demo User',
      passwordHash: await Bun.password.hash('demo123', {
        algorithm: 'bcrypt',
        cost: 12,
      })
    },
  })

  console.log(`Created demo user: ${demoUser.email}`)

  // Create demo organization
  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'demo-org-12345678' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-org-12345678',
      ownerId: demoUser.id,
      typeId: personalType.id,
      planId: freePlan.id,
      memberships: {
        create: {
          userId: demoUser.id,
          role: 'OWNER',
        }
      },
      subscriptions: {
        create: {
          planId: freePlan.id,
          status: 'active'
        }
      }
    },
  })

  console.log(`Created demo organization: ${demoOrg.name}`)

  console.log('✅ Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 