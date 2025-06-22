# Contributing to ModularIoT

Thank you for your interest in contributing to ModularIoT! This document provides guidelines and information for contributors.

## Development Environment Setup

### Prerequisites

- **Node.js** 18+ and **pnpm** 8+
- **Java** 17+ and **Maven** 3.8+
- **Docker** and **Docker Compose**
- **Git**

### Getting Started

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/your-username/modulariot.git
   cd modulariot
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

4. **Start the development environment**:
   ```bash
   # Start all JavaScript/TypeScript services
   pnpm dev
   
   # In a separate terminal, start the Quarkus service
   cd apps/ingest-quarkus
   ./mvnw quarkus:dev
   ```

## Project Structure

The project follows a monorepo structure with clear separation of concerns:

- `apps/` - Runnable applications
- `packages/` - Shared libraries and utilities
- `infra/` - Infrastructure as code
- `scripts/` - Utility scripts
- `tests/` - Integration and end-to-end tests

## Development Workflow

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the coding standards
3. Test your changes:
   ```bash
   pnpm test
   pnpm lint
   ```

4. Commit your changes with conventional commits:
   ```bash
   git commit -m "feat: add new feature"
   ```

### Coding Standards

- **TypeScript**: Use strict TypeScript configuration
- **ESLint**: Follow the configured ESLint rules
- **Prettier**: Code is automatically formatted
- **Testing**: Write tests for new features
- **Documentation**: Update documentation for API changes

### Available Scripts

```bash
# Development
pnpm dev              # Start all services
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all code
pnpm fmt              # Format all code

# Database operations
pnpm db:migrate       # Run database migrations
pnpm db:seed          # Seed database
pnpm db:studio        # Open Prisma Studio

# Service-specific commands
pnpm --filter web-admin dev
pnpm --filter bff-node test
pnpm --filter ui build
```

## Pull Request Process

1. Ensure your branch is up to date with `main`
2. Run the full test suite and ensure all tests pass
3. Update documentation as needed
4. Create a pull request with a clear description
5. Wait for code review and address feedback

## Issue Reporting

When reporting issues, please include:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node.js version, etc.)
- Error messages or logs

## Getting Help

- Check existing issues and documentation
- Join our discussions on GitHub
- Reach out to maintainers for guidance

## Code of Conduct

This project adheres to the Contributor Covenant Code of Conduct. By participating, you are expected to uphold this code. 