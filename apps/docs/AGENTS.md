# AGENTS.md

## Conventions

- Use npm for everything. Do not use pnpm or yarn under any circumstances
- TypeScript is mandatory (strict mode enabled)
- Use Next.js 16 App Router conventions
- Node.js 20+ is required
- Use path aliases: `@/*` for `./src/*` and `@assets/*` for `./public/*`

## Project Setup

- This is a Next.js 16 application with React 19
- Flowbite React is the UI component library
- Tailwind CSS v4 is used for styling
- Do not add dependencies until they are actually needed
- All new code must use TypeScript

## Organization

- Keep components small with a single responsibility
- Prefer composition over complex configurations
- Avoid premature abstractions
- Code is organized by feature domain in `src/features/`:
  - `auth/` - Authentication and authorization
  - `common/` - Shared components, hooks, and utilities
  - `geographic-view/` - Map and location features
  - `i18n/` - Internationalization services
  - `layout/` - Layout components (navbar, sidebar)
  - `shipping/` - Shipping and delivery features
  - `symptoms/` - Symptoms tracking features
  - `task-forms/` - Task form components and services
  - `theme/` - Theme configuration and components
- API routes live in `src/app/api/`
- Types should be colocated with their modules (e.g., `component.types.ts`)
- Shared types go in `src/types/`

## TypeScript Rules

- Avoid `any` and `unknown` types
- Prefer type inference whenever possible
- If types are unclear, stop and clarify before continuing
- All strict compiler options are enabled - respect them
- Use Zod for runtime validation of external data
- Create separate `.types.ts` files for complex type definitions

## Styling

- Use Tailwind CSS utility classes
- Use Flowbite React components when available
- Use `tailwind-merge` for conditional class merging
- Custom animations are defined in `tailwind.config.ts`

## State Management & Data Fetching

- Use SWR for data fetching and caching
- Use React Hook Form for form state management
- Use Zod with `@hookform/resolvers` for form validation
- Server components are preferred; use `"use client"` only when necessary

## Internationalization

- All user-facing text must be internationalized
- Translation files are in `src/lang/` (es.json, en.json)
- Use the i18n service from `src/features/i18n/`

## Error Handling

- Use explicit error types, not generic Error
- Provide meaningful error messages with context
- Handle API errors gracefully with proper user feedback
- Use Pino logger for structured logging (`src/lib/logger.ts`)

## Testing and Quality

- Review CI workflows in `.github/workflows/ci.yaml`
- Run tests with:
  ```bash
  npm run test
  ```
- For Vitest with specific test:
  ```bash
  npm run test -- -t "<test name>"
  ```
- Run linting:
  ```bash
  npm run lint
  ```
- Run formatting:
  ```bash
  npm run format
  ```
- Check for dead code:
  ```bash
  npm run knip:check
  ```
- Code with type errors, lint errors, or failing tests is not accepted
- Add or update tests when behavior changes, even if not explicitly requested
- Tests live in `src/test/` or colocated with their modules as `*.test.ts`

## Before Committing

Run all checks:
```bash
npm run lint
npm run format:check
npm run test:run
npm run knip:check
```

Git hooks are configured in `.githooks/` and installed via `npm run install:hooks`

## Performance and Technical Decisions

- Do not guess performance, bundle size, or load times: measure them
- If something seems slow, add instrumentation before optimizing
- Validate changes on a small scale before applying them project-wide
- Consider the impact on API rate limits and backend load
- Use `server-only` module to prevent server code from leaking to client

## Commits and Pull Requests

- Keep PRs small and focused
- Explain what changed, why, and how it was verified
- If introducing a new constraint ("never X", "always Y"), document it in this file

## Agent Behavior

- If a request is unclear, ask specific questions before executing
- Simple, well-defined tasks can be executed directly
- Complex changes (refactors, new features, architecture decisions) require confirming understanding before acting
- Do not assume implicit requirements. If information is missing, ask for it
- When working with APIs, verify the expected response format before implementing
- Always check the existing codebase patterns before creating new abstractions
