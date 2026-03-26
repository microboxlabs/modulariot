# Dead Code Detection with Knip

This project uses [Knip](https://knip.dev) to automatically detect and eliminate dead code, ensuring a clean and maintainable codebase as it grows.

## Overview

Knip is a powerful tool that finds unused files, dependencies, exports, types, and more in JavaScript and TypeScript projects. It helps maintain code quality by identifying code that can be safely removed.

## Quick Start

### Basic Commands

```bash
# Run full dead code detection
npm run knip

# Check for dead code (non-blocking, for CI/CD)
npm run knip:check

# Auto-fix some issues (removes unused exports)
npm run knip:fix

# Focus only on unused exports/components
npm run knip:exports

# Focus only on unused files
npm run knip:files
```

## Integration Points

### 1. Pre-commit Hook

The pre-commit hook (`.githooks/pre-commit`) automatically checks for dead code before each commit. Currently, it:

- ✅ Warns if dead code is detected
- ✅ Provides helpful commands to investigate
- ⚠️ Does NOT block commits (non-blocking by default)

To make it blocking, uncomment the `exit 1` line in `.githooks/pre-commit`.

**Bypassing the check:**

If you need to commit despite dead code warnings (e.g., during active development), use:

```bash
git commit --no-verify
```

### 2. CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yaml`) includes a Knip check step that runs during the build process. This ensures that dead code is tracked in the CI/CD pipeline.

The check runs with `--no-exit-code` flag, meaning it won't fail the build but will report issues in the workflow logs.

### 3. Manual Usage

Run Knip manually during development to catch dead code early:

```bash
# Full analysis
npm run knip

# Quick check (recommended for frequent use)
npm run knip:check
```

## Configuration

The Knip configuration is in `knip.json`. Key settings:

- **Entry points**: Defined in `entry` array (Next.js app routes, middleware, config files)
- **Project scope**: All TypeScript/JavaScript files in `src/`
- **Ignore patterns**: Test files, type definitions, and build tools
- **Workspaces**: Configured for the monorepo structure

### Customizing Configuration

Edit `knip.json` to:

1. **Add ignore patterns** for legitimate false positives:

   ```json
   {
     "ignore": ["src/**/*.test.{js,ts,jsx,tsx}", "src/path/to/file.ts"]
   }
   ```

2. **Ignore specific dependencies** that are used dynamically:

   ```json
   {
     "ignoreDependencies": ["eslint", "@types/*", "package-name"]
   }
   ```

3. **Add entry points** for new code patterns:
   ```json
   {
     "entry": ["src/app/**/*.{js,ts,jsx,tsx}", "src/new-pattern/**/*.ts"]
   }
   ```

## Handling False Positives

Knip may sometimes report false positives. Common scenarios:

### 1. Dynamic Imports

If a file is imported dynamically (e.g., `import()`), Knip might not detect it. Add it to the ignore list or use entry points.

### 2. API Routes

Next.js API routes are automatically detected, but if you have custom routing patterns, ensure they're in the entry points.

### 3. Type-Only Exports

Type-only exports used across files should be detected, but if not, add the file to ignore patterns.

### 4. Configuration Files

Config files used by tools (like Tailwind config) should be in entry points or ignore patterns.

**To handle false positives:**

1. Verify the export is truly unused (search codebase)
2. If it's used but not detected, check if it needs to be in entry points
3. If it's a false positive, add to `ignore` in `knip.json`

## Best Practices

1. **Run Knip regularly** during development (before committing)
2. **Clean up dead code incrementally** - don't try to fix everything at once
3. **Review false positives** before ignoring them
4. **Use `knip:exports` and `knip:files`** to focus on specific issues
5. **Run `knip:fix`** carefully - review changes before committing

## Workflow

### Daily Development

```bash
# Before committing
npm run knip:check

# If issues found, investigate
npm run knip:exports  # Check unused exports
npm run knip:files    # Check unused files

# Clean up dead code
# ... remove unused code ...
```

### Before Pull Request

```bash
# Full analysis
npm run knip

# Address any issues
# ... clean up dead code ...

# Verify fix
npm run knip:check
```

### Periodic Cleanup

Schedule periodic codebase cleanup sessions:

1. Run `npm run knip` to get full report
2. Review and categorize issues
3. Create cleanup tasks/issues
4. Fix incrementally

## Troubleshooting

### Knip reports issues but code is used

1. Check if the file is in entry points
2. Verify the import path is correct
3. Check for dynamic imports
4. Review `knip.json` configuration

### Pre-commit hook is slow

The hook runs Knip on every commit. If it's too slow:

1. Consider making it non-blocking (current default)
2. Run Knip only on staged files (requires custom script)
3. Run Knip in CI/CD only

### CI/CD reports many issues

1. Run `npm run knip` locally to see issues
2. Address critical issues first
3. Add legitimate false positives to ignore patterns
4. Plan cleanup work incrementally

## Resources

- [Knip Documentation](https://knip.dev)
- [Knip GitHub Repository](https://github.com/webpro/knip)
- [Issue #885](https://github.com/microboxlabs/coordinador-webclient/issues/885) - Implementation tracking

## Support

If you encounter issues or have questions:

1. Check this documentation
2. Review [Knip documentation](https://knip.dev)
3. Create an issue in the repository
4. Ask the team for help

---

**Remember**: The goal is to maintain a clean codebase, not to eliminate every reported item. Use your judgment when deciding what to remove and what to ignore.
