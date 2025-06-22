# ModularIoT

A modern, scalable IoT platform built with a microservices architecture.

## What is ModularIoT?

ModularIoT is a comprehensive IoT platform that provides:

- **Data Ingestion**: High-performance data ingestion service built with Quarkus
- **Web Admin**: Next.js-based administration interface
- **BFF (Backend for Frontend)**: Node.js API layer for web clients
- **Device Simulation**: CLI tools for testing and development
- **Shared Libraries**: Reusable components and utilities

## Architecture

This monorepo uses [Turborepo](https://turbo.build/repo) to manage multiple front-end applications and shared packages.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Admin     │    │    BFF Node      │    │ Ingest Quarkus  │
│   (Next.js)     │◄──►│   (Fastify)      │◄──►│   (Java)        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    │   (Supabase)     │
                    └──────────────────┘
```

## Quick Start

1.  **Prerequisites**:
   - Java 17+ and Maven
   - Docker and Docker Compose
   - [Bun](https://bun.sh/)

2.  **Clone and install**:
   ```bash
   git clone <repository-url>
   cd modulariot
   bun install
   ```

3.  **Start services**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   # Start all services in development mode
   turbo run dev
   ```

4. **Access the applications**:
   Each Next.js application will run on a different port. Check the terminal output after running `bun dev` to see the specific ports for `docs`, `web`, `web-admin`, and `web-site`.

## Development

### Prerequisites

- Java 17+
- Maven 3.8+
- [Bun](https://bun.sh/)

### Project Structure

```
modulariot/
├── apps/              # Runnable applications
│   ├── web-admin/     # Next.js admin interface
│   ├── bff-node/      # Node.js BFF
│   ├── ingest-quarkus/# Quarkus ingestion service
│   └── dummy-simulator/# IoT device simulator
├── packages/          # Shared libraries
│   ├── ui/           # UI components
│   ├── db/           # Database schema and client
│   ├── auth/         # Authentication utilities
│   ├── contracts/    # API contracts
│   └── tsconfig/     # TypeScript configuration
├── infra/            # Infrastructure as code
├── scripts/          # Utility scripts
└── tests/            # Integration and E2E tests
```

### Available Scripts

Run these scripts from the root of the monorepo.

```bash
# Start all services in development mode
turbo run dev

# Build all packages and applications
turbo run build

# Lint all code
turbo run lint

# Format all code
turbo run format

# Check types
turbo run check-types
```

# Database
turbo run db:migrate       # Run database migrations
turbo run db:seed          # Seed database with sample data
turbo run db:studio        # Open Prisma Studio

# Individual service commands
turbo run --filter web-admin dev
turbo run --filter bff-node dev
turbo run --filter ingest-quarkus dev
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed development setup and contribution guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Code of Conduct

This project adheres to the Contributor Covenant [Code of Conduct](./CODE_OF_CONDUCT.md). 