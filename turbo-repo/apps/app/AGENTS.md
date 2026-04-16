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

## Color Rules Evaluation Pattern

When evaluating color rules in dashlets (matching values against rules to determine colors), **always extract the logic into helper functions** to reduce cognitive complexity:

1. **Extract operator check helpers** - `isGreaterOperator()`, `isLessOperator()`
2. **Extract sorting logic** - `sortColorRules()` function
3. **Extract evaluation logic** - `evaluateColorRules()` returning an object with all colors
4. **Extract style builders** - `buildBgStyle()`, `buildTextStyle()`, etc.

**Example - Pattern for color rule evaluation:**

```typescript
interface EvaluatedColors {
  textColor: string | undefined;
  bgColor: string | undefined;
  iconColor: string | undefined;
}

function isGreaterOperator(op: string): boolean {
  return op === "greater_than" || op === "greater_than_or_equal";
}

function isLessOperator(op: string): boolean {
  return op === "less_than" || op === "less_than_or_equal";
}

function sortColorRules(rules: ValueColorRule[]): ValueColorRule[] {
  return [...rules].sort((a, b) => {
    const aVal = Number(a.value) || 0;
    const bVal = Number(b.value) || 0;
    if (isGreaterOperator(a.operator) && isGreaterOperator(b.operator)) {
      return bVal - aVal;
    }
    if (isLessOperator(a.operator) && isLessOperator(b.operator)) {
      return aVal - bVal;
    }
    return 0;
  });
}

function evaluateColorRules(rules: ValueColorRule[], evalValue: string): EvaluatedColors {
  let textColor: string | undefined;
  let bgColor: string | undefined;
  let iconColor: string | undefined;

  for (const rule of sortColorRules(rules)) {
    const matches = evaluateRule(/* ... */, evalValue);
    if (!matches) continue;

    if (rule.targets.includes("text") && !textColor) textColor = rule.color;
    if (rule.targets.includes("bg") && !bgColor) bgColor = rule.color;
    if (rule.targets.includes("icon") && !iconColor) iconColor = rule.color;
    if (textColor && bgColor && iconColor) break;
  }

  return { textColor, bgColor, iconColor };
}
```

Then in the component:

```typescript
const { textColor, bgColor, iconColor } =
  rules.length > 0
    ? evaluateColorRules(rules, String(value))
    : { textColor: undefined, bgColor: undefined, iconColor: undefined };
```

## Negated Conditions

- **Avoid negated conditions in if-else statements** when the else branch is not empty
- SonarQube enforces: "Unexpected negated condition"
- Reorder conditions so the positive check comes first

**Example - Avoid:**

```typescript
if (options?.fallbackValue !== undefined) {
  resolvedValue = String(options.fallbackValue);
} else {
  return { color: null };
}
```

**Example - Correct:**

```typescript
if (options?.fallbackValue === undefined) {
  return { color: null };
} else {
  resolvedValue = String(options.fallbackValue);
}
```

- **For conditional CSS classes in JSX**, pre-compute the classes using helper functions instead of inline negations:

**Example - Avoid (negated condition in JSX):**

```tsx
<div className={`container ${!effectiveColor ? "bg-gray-100" : ""}`}>
```

**Example - Correct (pre-computed with helper):**

```typescript
function getBgClasses(effectiveColor: string | undefined): string {
  if (effectiveColor) return "";
  return "bg-gray-100";
}

// In component:
const bgClasses = getBgClasses(effectiveColor);
return <div className={`container ${bgClasses}`}>;
```

## Nested Ternary Operations

- **Never use nested ternary operators** - Extract to a helper function with sequential if statements
- SonarQube enforces: "Extract this nested ternary operation into an independent statement"

**Example - Avoid:**

```typescript
const style = ruleColor
  ? { color: `#${ruleColor}` }
  : manualColor
    ? { color: `#${manualColor}` }
    : undefined;
```

**Example - Correct:**

```typescript
function buildTextStyle(
  ruleColor: string | undefined,
  manualColor: string | undefined
): React.CSSProperties | undefined {
  if (ruleColor) return { color: `#${ruleColor}` };
  if (manualColor) return { color: `#${manualColor}` };
  return undefined;
}

const style = buildTextStyle(ruleColor, manualColor);
```

## Number Methods

- **Use `Number.parseInt()` and `Number.parseFloat()`** instead of global `parseInt()` and `parseFloat()`
- ESLint enforces: "Prefer `Number.parseInt` over `parseInt`"

**Example - Avoid:**

```typescript
const r = parseInt(hex.slice(0, 2), 16);
```

**Example - Correct:**

```typescript
const r = Number.parseInt(hex.slice(0, 2), 16);
```

## Unused Variables and State

- **Remove unused state variables** - If a setter is never called, remove the state
- **Remove unused imports** - Especially deprecated ones
- If state is never modified, use the config value directly in calculations

**Example - Avoid:**

```typescript
const [barColor, setBarColor] = useState(config.barColor ?? DEFAULT_COLOR);
// setBarColor is never called anywhere
```

**Example - Correct:**

```typescript
// Use config value directly in save payload
const handleSave = () => {
  onSave({ barColor: config.barColor ?? DEFAULT_COLOR /* ... */ });
};
```

## Unnecessary Type Assertions

- **Don't cast types when the type is already correct**
- TypeScript/ESLint enforces: "This assertion is unnecessary since it does not change the type of the expression"

**Example - Avoid:**

```typescript
// mapping.operator is already ColorRuleOperator
OPERATOR_LABELS[mapping.operator as ColorRuleOperator];
```

**Example - Correct:**

```typescript
OPERATOR_LABELS[mapping.operator];
```

## Redundant Type Aliases

- **Don't create type aliases that just alias primitive types**
- SonarQube enforces: "Remove this redundant type alias and replace its occurrences with 'string'"

**Example - Avoid:**

```typescript
export type RuleColor = string;

interface ColorRule {
  color: RuleColor;
}
```

**Example - Correct:**

```typescript
interface ColorRule {
  color: string;
}
```

## Deprecated Exports

- **Never import deprecated constants or types** - Check JSDoc for `@deprecated` annotations
- Use the recommended replacement or inline the values

**Example - Avoid:**

```typescript
import { RULE_COLORS } from "./color-rule-types"; // @deprecated

if ((RULE_COLORS as string[]).includes(color)) {
  /* ... */
}
```

**Example - Correct:**

```typescript
// For validation, just check it's a string (colors can be any hex value now)
if (typeof color === "string") {
  /* ... */
}
```

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

- **Never add click/keyboard event handlers to non-interactive elements** (`<div>`, `<span>`) that require user action
- If a `<div>` or `<span>` needs click/touch handlers for **actual user interaction**, convert it to a `<button>` or add `role`, `tabIndex`, and keyboard support
- **Mouse-only UX handlers** (e.g., `onMouseEnter`/`onMouseLeave` for hover effects, auto-pause behavior) are acceptable on divs without any role — they don't make the element interactive
- **Do NOT use `role="presentation"`** on divs with event handlers — this role is intended for decorative images and will trigger SonarQube warnings
- For **event propagation control** (e.g., `stopPropagation` only), handlers are acceptable on divs without any role since they don't represent user interaction
- SonarQube/ESLint enforces: "Avoid non-native interactive elements"

**Example - Avoid (non-interactive div with click handler):**

```tsx
<div onClick={handleClick}>Click me</div>
```

**Example - Correct (use native button for interactive elements):**

```tsx
<button type="button" onClick={handleClick}>
  Click me
</button>
```

**Example - Correct (hover-only UX handlers, no role needed):**

```tsx
// Mouse handlers for UX enhancement (e.g., pausing carousel on hover) are fine
<div
  className="carousel-container"
  onMouseEnter={() => setIsPaused(true)}
  onMouseLeave={() => setIsPaused(false)}
>
  {children}
</div>
```

**Example - Correct (propagation control, no role needed):**

```tsx
<div onMouseDown={(e) => e.stopPropagation()}>{children}</div>
```

## Regular Expressions

- **Never use patterns with super-linear backtracking risk.** Avoid `.*`, `.*?`, `.+`, or nested quantifiers inside regex when the input is unbounded or user-controlled.
- Prefer negated character classes (e.g., `[^}]*`) over dot-star (`.*?`) to guarantee linear-time matching.
- **When regex complexity is hard to eliminate, replace the regex with a manual `indexOf`-based scan** — this guarantees O(n) and avoids SonarCloud flags entirely.
- SonarCloud enforces: "Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service."

**Example - Avoid (backtracking risk):**

```typescript
const matches = text.match(/\{\{(.*?)\}\}/g);
```

**Example - Correct (linear-time `indexOf` scan, no regex):**

```typescript
function findHandlebarsExpressions(text: string): string[] {
  const results: string[] = [];
  let start = text.indexOf("{{");
  while (start !== -1) {
    const end = text.indexOf("}}", start + 2);
    if (end === -1) break;
    results.push(text.substring(start, end + 2));
    start = text.indexOf("{{", end + 2);
  }
  return results;
}
```

This avoids regex entirely, guarantees O(n) runtime, and won't trigger SonarCloud backtracking warnings.

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
