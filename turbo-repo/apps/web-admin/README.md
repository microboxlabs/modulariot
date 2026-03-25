# ModularIoT Web Admin

Admin panel for the ModularIoT platform built with Next.js 15, TypeScript, and Tailwind CSS.

## Features

- 🔐 **Authentication**: Email/password and OAuth (Google, GitHub) via NextAuth.js v5
- 🏢 **Organization Management**: Create, manage, and invite team members
- 👥 **RBAC**: Role-based access control (Owner, Admin, Member)
- 🌙 **Dark Mode**: Full dark mode support with system preference detection
- 📱 **Responsive**: Mobile-first responsive design
- ⚡ **Modern Stack**: Next.js 15, React 19, TypeScript, Tailwind CSS, Prisma

## Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database
- Google OAuth app (optional)
- GitHub OAuth app (optional)

## Getting Started

### 1. Install Dependencies

```bash
npm install
# or
bun install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/modulariot_admin"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# OAuth Providers (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npm run db:push

# Seed with demo data
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Demo Credentials

After seeding the database, you can use these credentials:

- **Email**: demo@miot.dev
- **Password**: demo123

## API Routes

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/signin` - Sign in (handled by NextAuth)
- `POST /api/auth/signout` - Sign out (handled by NextAuth)

### Organizations
- `POST /api/organizations` - Create organization
- `PATCH /api/organizations/:orgId` - Update organization
- `GET /api/organizations/:orgId/members` - List organization members

### Invitations
- `POST /api/invitations` - Send invitation
- `GET /api/invitations/:token` - Accept invitation

## Project Structure

```
apps/web-admin/
├── app/
│   ├── (auth)/           # Authentication pages
│   ├── (org)/            # Organization pages
│   ├── api/              # API routes
│   ├── components/       # Reusable components
│   └── layout.tsx        # Root layout
├── lib/
│   ├── auth.ts           # NextAuth configuration
│   ├── db.ts             # Prisma client
│   └── version.ts        # Version utilities
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seeding
├── styles/
│   └── globals.css       # Global styles
└── package.json
```

## Technologies

- **Framework**: Next.js 15 with App Router
- **Authentication**: NextAuth.js v5
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS + Flowbite React
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React
- **Animations**: Framer Motion

## Deployment

The app is ready for deployment on Vercel, Netlify, or any Node.js hosting platform.

### Environment Variables for Production

Make sure to set all required environment variables in your deployment platform.

### Database Migration

For production deployments, use Prisma migrations instead of `db:push`:

```bash
npx prisma migrate deploy
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if needed
5. Submit a pull request

## License

This project is part of the ModularIoT platform and follows the same license terms.

## Support

For support and questions, please visit our [GitHub repository](https://github.com/modulariot) or join our community discussions.
