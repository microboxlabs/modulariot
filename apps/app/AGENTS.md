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
- Compare with `undefined` directly instead of using `typeof`

**Example - Avoid:**

```typescript
if (typeof globalThis.window === "undefined") return null;
```

**Example - Correct:**

```typescript
if (globalThis.window === undefined) return null;
```

## Cognitive Complexity

Cognitive Complexity measures how hard it is to understand the control flow of code. High cognitive complexity makes code hard to read, understand, test, and modify.

**What increases cognitive complexity:**

- Loop structures (for, while, do-while)
- Conditionals (if, else, ternary operators)
- Nested conditions and loops (each nesting level compounds complexity)
- Mixed operators in conditions (`&&`, `||` combined)
- Switch statements, catches, and jumps to labels

**How to reduce cognitive complexity:**

- **Extract complex conditions into functions** - A well-named function summarizes multiple lines and reduces cognitive load
- **Break down large functions** - Each function should have a single responsibility
- **Return early to avoid deep nesting** - Process exceptional cases first and return
- **Use null-safe operations** - Prefer `?.` and `??` operators over multiple null checks
- **Avoid nested ternaries** - Extract to variables or helper functions

**Example - Before (high complexity):**

```typescript
return error
  ? error instanceof Error
    ? error
    : new Error(String(error))
  : null;
```

**Example - After (lower complexity):**

```typescript
const normalizeError = (error: unknown): Error | null => {
  if (!error) return null;
  return error instanceof Error ? error : new Error(String(error));
};
return normalizeError(error);
```

Note: Method calls are free (don't add complexity), but recursive calls do increment the score.

## React Component Rules

- Never define components inside other components (nested components)
- Inline render functions that return JSX should delegate to extracted components
- Extract reusable render logic to separate named components and pass data as props
- This prevents state loss on parent re-renders and avoids unnecessary component recreation

**Example - Avoid (nested component):**

```tsx
function Parent() {
  const ChildComponent = () => <div>...</div>; // Bad: recreated on every render
  return <ChildComponent />;
}
```

**Example - Correct (extracted component):**

```tsx
function ChildComponent({ data }: Readonly<Props>) {
  return <div>...</div>;
}

function Parent() {
  return <ChildComponent data={data} />;
}
```

## Read-Only Props

- **Always mark React component props as read-only** using `Readonly<Props>` wrapper
- This ensures props are treated as immutable, which is a React best practice
- SonarQube enforces this rule: "Mark the props of the component as read-only"

**Example - Avoid:**

```tsx
function MyComponent({ title, onClick }: MyComponentProps) {
  return <div onClick={onClick}>{title}</div>;
}
```

**Example - Correct:**

```tsx
function MyComponent({ title, onClick }: Readonly<MyComponentProps>) {
  return <div onClick={onClick}>{title}</div>;
}
```

For generic components, apply `Readonly` to the typed props:

```tsx
function GenericComponent<T extends string>({
  value,
  onChange,
}: Readonly<GenericComponentProps<T>>) {
  // ...
}
```

## Accessibility

- **Never add event handlers to non-interactive elements** (`<div>`, `<span>`) without proper accessibility attributes
- If a `<div>` or `<span>` needs click/touch handlers for **actual user interaction**, convert it to a `<button>` or add `role`, `tabIndex`, and keyboard support
- If event handlers are only for **event propagation control** (e.g., `stopPropagation`), add `role="presentation"` to indicate the element is not interactive
- SonarQube/ESLint enforces: "Avoid non-native interactive elements"

**Example - Avoid (non-interactive div with handlers):**

```tsx
<div onClick={handleClick}>Click me</div>
```

**Example - Correct (use native button):**

```tsx
<button type="button" onClick={handleClick}>
  Click me
</button>
```

**Example - Correct (propagation control only, not interactive):**

```tsx
<div role="presentation" onMouseDown={(e) => e.stopPropagation()}>
  {children}
</div>
```

## Regular Expressions

- **Never use patterns with super-linear backtracking risk.** Avoid `.*`, `.*?`, `.+`, or nested quantifiers inside regex when the input is unbounded or user-controlled.
- Prefer negated character classes (e.g., `[^}]*`) over dot-star (`.*?`) to guarantee linear-time matching.
- SonarCloud enforces: "Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service."

**Example - Avoid (potential backtracking):**

```typescript
const matches = text.match(/\{\{(.*?)\}\}/g);
```

**Example - Correct (linear-time, no backtracking):**

```typescript
const matches = text.match(/\{\{([^}]*(?:\}(?!\})[^}]*)*)\}\}/g);
```

The corrected pattern uses `[^}]*` to consume non-`}` characters without backtracking, and `\}(?!\})` to allow a single `}` that isn't part of the `}}` closing delimiter.

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

## Context Provider Rules

- **Always wrap Context Provider values in `useMemo`** to prevent unnecessary re-renders
- SonarQube enforces: "The 'value' object passed as the value prop to the Context provider changes every render"
- Include all values and callbacks in the dependency array

**Example - Avoid:**

```tsx
function MyProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(0);
  const value = { state, setState }; // Creates new object every render
  return <MyContext.Provider value={value}>{children}</MyContext.Provider>;
}
```

**Example - Correct:**

```tsx
function MyProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(0);
  const value = useMemo(() => ({ state, setState }), [state]);
  return <MyContext.Provider value={value}>{children}</MyContext.Provider>;
}
```

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
