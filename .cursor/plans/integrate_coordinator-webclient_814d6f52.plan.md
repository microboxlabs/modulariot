---
name: Integrate coordinator-webclient
overview: Integrate coordinator-webclient into the Turbo monorepo as apps/app, migrate monorepo from Bun to pnpm for better Vite/Vitest compatibility, set up Husky for git hooks, and add Knip as a Turbo task.
todos:
  - id: create-branch
    content: Create feature branch for the migration work
    status: completed
  - id: bun-to-pnpm
    content: Migrate monorepo from Bun to pnpm (delete bun.lock, update packageManager, run pnpm install)
    status: completed
  - id: subtree-merge
    content: Run git subtree add (without --squash) to merge coordinator-webclient into apps/app with full history
    status: completed
  - id: update-app-package
    content: Rename package to @modulariot/app, update scripts for pnpm, add knip script
    status: completed
  - id: adopt-eslint
    content: Delete legacy ESLint files, create eslint.config.mjs extending @repo/eslint-config
    status: completed
  - id: adopt-typescript
    content: Update tsconfig.json to extend @repo/typescript-config/nextjs.json
    status: completed
  - id: setup-husky
    content: Install and configure Husky at monorepo root with pre-commit hook
    status: completed
  - id: add-knip-turbo
    content: Add knip task to turbo.json and root package.json scripts
    status: completed
  - id: cleanup
    content: Remove obsolete files (app-level git hooks, bitbucket pipeline, npm lock)
    status: completed
  - id: verify-build
    content: Run pnpm install, check-types, lint, knip, test, and build to verify migration
    status: completed
isProject: false
---

# Integrate coordinator-webclient into Turbo Monorepo

## Overview

Bring the existing `coordinator-webclient` repository into `modulariot-tuborepo` as `apps/app` with full git history preserved. Migrate the entire monorepo from Bun to pnpm for better Vite/Vitest compatibility. Set up Husky at the root for git hooks and integrate Knip as a Turbo task.

## Phase 0: Create Feature Branch

All migration work happens in a dedicated branch to allow review before merging.

```bash
cd /Users/korutx/Documents/microboxlabs/projects/streamhub/monorepo-tests/modulariot-tuborepo
git checkout -b feature/integrate-coordinator-webclient
```

## Phase 1: Migrate Monorepo from Bun to pnpm

This ensures better compatibility with Vitest (which uses Vite under the hood).

### 1.1 Remove Bun artifacts

```bash
rm bun.lock
rm -rf node_modules
# Also remove node_modules from all apps/packages if present
```

### 1.2 Update root package.json

**Changes to `package.json`:**

```diff
- "packageManager": "bun@1.2.17",
+ "packageManager": "pnpm@9.15.0",
  "engines": {
-   "bun": ">=1.0.0"
+   "node": ">=20.0.0"
  },
```

### 1.3 Update all app scripts

Replace `bunx --bun` with standard commands in all apps:

**Example for `apps/web-admin/package.json`:**

```diff
- "dev": "bunx --bun next dev --turbopack --port 3000",
- "build": "bunx --bun next build",
- "start": "bunx --bun next start",
- "lint": "bunx --bun next lint",
+ "dev": "next dev --turbopack --port 3000",
+ "build": "next build",
+ "start": "next start",
+ "lint": "next lint",
```

Apply similar changes to: `web-admin`, `web-site`, `bff`, `docs`, `web`

### 1.4 Create pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 1.5 Update .npmrc (if needed)

```ini
auto-install-peers=true
strict-peer-dependencies=false
```

### 1.6 Install dependencies

```bash
pnpm install
```

This generates `pnpm-lock.yaml`.

### 1.7 Verify existing apps still work

```bash
pnpm run build
pnpm run lint
pnpm run check-types
```

## Phase 2: Git Subtree Integration (Full History)

Merge coordinator-webclient with **full commit history** visible in the log.

```bash
# Add coordinator-webclient as a remote
git remote add coordinador-origin /Users/korutx/Documents/microboxlabs/projects/mintral/flowbite/coordinador-webclient

# Fetch the repository
git fetch coordinador-origin

# Add as subtree WITHOUT --squash (preserves full history in log)
git subtree add --prefix=apps/app coordinador-origin trash

# Remove the temporary remote
git remote remove coordinador-origin
```

**Result:** All commits from coordinator-webclient appear in `git log`, and files are relocated to `apps/app/`.

## Phase 3: Update App Configuration

### 3.1 Update package.json

**Changes to `apps/app/package.json`:**

```json
{
  "name": "@modulariot/app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack --port 3050",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "check-types": "tsc --noEmit",
    "format": "prettier . --write",
    "format:check": "prettier . --check",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "knip": "knip",
    "knip:check": "knip --no-exit-code",
    "postinstall": "flowbite-react patch"
  },
  "dependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*"
  }
}
```

**Key changes:**

- Rename from `coordinador-webclient` to `@modulariot/app`
- Remove `bunx --bun` prefixes (using pnpm now)
- Add `check-types` script for Turbo
- Keep `knip` scripts for dead code detection
- Port 3050 (avoids conflicts)
- Remove `install:hooks` (Husky at root handles this)

### 3.2 Remove npm lock file

```bash
rm apps/app/package-lock.json
```

## Phase 4: Adopt Shared Configurations

### 4.1 ESLint Configuration

**Delete these files:**

- `apps/app/.eslintrc.js`
- `apps/app/.eslintrc.json`
- `apps/app/.eslintignore`

**Create `apps/app/eslint.config.mjs`:**

```javascript
import { config as baseConfig } from "@repo/eslint-config/next-js";

/** @type {import('eslint').Linter.Config[]} */
export default [...baseConfig];
```

**Remove redundant devDependencies from package.json:**

```diff
- "eslint-config-prettier": "^9.1.0",
- "eslint-import-resolver-typescript": "^3.6.1",
- "eslint-plugin-import": "^2.29.1",
- "eslint-plugin-jsx-a11y": "^6.9.0",
- "eslint-plugin-prettier": "^5.2.1",
- "eslint-plugin-react": "^7.35.0",
- "eslint-plugin-react-hooks": "^7.0.1",
```

### 4.2 TypeScript Configuration

**Update `apps/app/tsconfig.json`:**

```json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@assets/*": ["./public/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

### 4.3 Next.js Configuration (Convert to ESM)

**Rename** `apps/app/next.config.js` to `apps/app/next.config.mjs`

**Update content:**

```javascript
import withMDX from "@next/mdx";
import withFlowbiteReact from "flowbite-react/plugin/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  output: "standalone",
  basePath: "/app",
  productionBrowserSourceMaps: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mintcargaimagenesprbfc3.blob.core.windows.net",
        pathname: "/**",
      },
    ],
  },
  serverExternalPackages: ["pino", "pino-pretty"],
};

const mdxConfig = withMDX({
  extension: /\.mdx?$/,
});

export default withFlowbiteReact(mdxConfig(nextConfig));
```

## Phase 5: Set Up Husky at Monorepo Root

### 5.1 Install Husky

```bash
pnpm add -D -w husky
pnpm exec husky init
```

This creates `.husky/` directory at the root.

### 5.2 Create pre-commit hook

**Create `.husky/pre-commit`:**

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Branch protection
branch=$(git symbolic-ref --short HEAD 2>/dev/null)
if [ "$branch" = "based/develop" ] || [ "$branch" = "develop" ]; then
    echo ""
    echo "❌ Direct commits to $branch are not allowed"
    echo ""
    exit 1
fi

# Run lint-staged (optional, if you add it later)
# pnpm exec lint-staged

# Run Knip dead code check on apps/app (warning only)
echo ""
echo "🔍 Checking for dead code with Knip..."
echo ""

KNIP_OUTPUT=$(pnpm --filter @modulariot/app run knip:check 2>&1)

if echo "$KNIP_OUTPUT" | grep -qE "(✂️|unused|Unused)"; then
    echo ""
    echo "⚠️  Dead code detected in @modulariot/app"
    echo "    Run: pnpm --filter @modulariot/app run knip"
    echo ""
    # Not blocking - just a warning
fi

echo "✅ Pre-commit checks passed"
exit 0
```

### 5.3 Create pre-push hook

**Create `.husky/pre-push`:**

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Protected branches
while read local_ref local_sha remote_ref remote_sha; do
    branch_name=${local_ref#refs/heads/}
    
    if [ "$branch_name" = "develop" ] || [ "$branch_name" = "based/develop" ]; then
        echo ""
        echo "❌ Pushing directly to $branch_name is not allowed"
        echo ""
        exit 1
    fi
done

exit 0
```

### 5.4 Update root package.json

Add prepare script:

```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

## Phase 6: Add Knip as Turbo Task

### 6.1 Update turbo.json

Add knip task:

```json
{
  "tasks": {
    "knip": {
      "cache": false
    },
    "knip:check": {
      "cache": false
    }
  }
}
```

### 6.2 Update root package.json scripts

```json
{
  "scripts": {
    "knip": "turbo run knip",
    "knip:check": "turbo run knip:check"
  }
}
```

## Phase 7: Cleanup

### 7.1 Files to delete from apps/app

```bash
rm -rf apps/app/.githooks/
rm -f apps/app/scripts/install-hooks.sh
rm -f apps/app/bitbucket-pipelines.yml
rm -f apps/app/.eslintrc.js
rm -f apps/app/.eslintrc.json
rm -f apps/app/.eslintignore
```

### 7.2 Files to keep and review

- `apps/app/.prettierrc` - consider aligning with monorepo root
- `apps/app/.prettierignore` - keep
- `apps/app/vitest.config.ts` - works with pnpm
- `apps/app/knip.json` - keep as-is

## Phase 8: Verification

```bash
# Install all dependencies
pnpm install

# Type check
pnpm run check-types --filter=@modulariot/app

# Lint
pnpm run lint --filter=@modulariot/app

# Dead code check
pnpm run knip:check --filter=@modulariot/app

# Run tests
pnpm run test --filter=@modulariot/app -- run

# Build
pnpm run build --filter=@modulariot/app

# Dev server (verify it starts)
pnpm run dev --filter=@modulariot/app
```

## Architecture After Migration

```
modulariot-tuborepo/
├── .husky/                 # NEW - Git hooks at root
│   ├── pre-commit
│   └── pre-push
├── pnpm-workspace.yaml     # NEW - pnpm workspace config
├── pnpm-lock.yaml          # NEW - replaces bun.lock
├── apps/
│   ├── app/                # NEW - main app (ex coordinator-webclient)
│   ├── web-admin/          # Reference/deprecated
│   ├── bff/
│   ├── docs/
│   ├── web/
│   └── web-site/
└── packages/
    ├── db/
    ├── eslint-config/
    ├── typescript-config/
    └── ui/
```

## Port Assignments


| App       | Port     |
| --------- | -------- |
| web-admin | 3000     |
| docs      | 3001     |
| web       | 3003     |
| bff       | 3030     |
| web-site  | 3040     |
| **app**   | **3050** |


## Rollback Plan

If issues arise, the feature branch can be abandoned:

```bash
git checkout trunk
git branch -D feature/integrate-coordinator-webclient
```

To rollback just the pnpm migration:

```bash
rm pnpm-lock.yaml pnpm-workspace.yaml
git checkout -- package.json apps/*/package.json
bun install
```

