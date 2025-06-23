import { PrismaClient } from '../generated/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

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
      memberships: {
        create: {
          userId: demoUser.id,
          role: 'OWNER',
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