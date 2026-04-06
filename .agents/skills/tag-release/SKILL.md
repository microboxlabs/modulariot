---
name: tag-release
description: Tag and release a monorepo package following the project's scoped-tag convention. Use when the user wants to publish a new version of a package, create a release tag, or bump a package version.
---

# Tag & Release

Create versioned releases for packages in this monorepo using scoped tags that trigger CI/CD pipelines.

## When to Use

Use this skill when the user wants to:

- Release a new version of a package
- Create a git tag for a package
- Bump a package version and publish
- Tag a package release (e.g. "tag miot-calendar-client v0.2.0")

## Instructions

### Step 1: Parse Input

Extract the **package name** and **version** from the user's request.

- Package name = the directory name under `packages/` (e.g. `miot-calendar-client`)
- Version = semver string (e.g. `0.2.0`)

If the user provides an npm scoped name (e.g. `@microboxlabs/miot-calendar-client`), map it to the directory name under `packages/`.

If the user provides a bare `v<version>` tag, ask which package it applies to — **never** create a plain `v<version>` tag.

### Step 2: Verify the Package Exists

Confirm the package directory exists:

```bash
ls packages/<package-name>/package.json
```

If it doesn't exist, list available packages and ask the user to choose.

### Step 3: Bump Version in package.json

Read `packages/<package-name>/package.json` and check the current `version` field.

- If it already matches the target version, skip this step.
- If it doesn't match, update the `version` field to the target version.

### Step 4: Commit the Version Bump

If the version was changed in Step 3, stage and commit:

```bash
git add packages/<package-name>/package.json
git commit -m "Bump <package-name> to v<version>"
```

If no changes were needed, skip this step.

### Step 5: Create Annotated Tag

Create an **annotated** tag (not lightweight) using the scoped format:

```bash
git tag -a "<package-name>@v<version>" -m "<package-name>@v<version>"
```

**Example:** `git tag -a "miot-calendar-client@v0.2.0" -m "miot-calendar-client@v0.2.0"`

### Step 6: Push Commits and Tag

Push the commit (if any) and the tag to the remote:

```bash
git push origin trunk
git push origin "<package-name>@v<version>"
```

### Step 7: Create GitHub Release

Create a GitHub release using the `gh` CLI:

```bash
gh release create "<package-name>@v<version>" \
  --title "<package-name>@v<version>" \
  --generate-notes \
  --latest
```

## Tag Convention

These rules are **critical** and must always be followed:

1. **Tag format**: `<package-dir-name>@v<version>` — **NEVER** use plain `v<version>`
2. **Package dir name** = the folder name under `packages/` (e.g. `miot-calendar-client`), not the npm scope name (`@microboxlabs/miot-calendar-client`)
3. **Version sync**: The `version` field in `packages/<name>/package.json` must match the tag version exactly
4. **Annotated tags**: Always use `git tag -a` with a message, never lightweight tags
5. **Release title**: Must match the tag name exactly (e.g. `miot-calendar-client@v0.2.0`)

## CI/CD Integration

Pushing a scoped tag triggers the corresponding GitHub Actions workflow:

- **`publish-npm.yaml`**: Triggered by tags matching `miot-calendar-client@v*`
  - Builds the package with Turbo
  - Runs lint, type-check, and tests
  - Publishes to npm via OIDC trusted publishing

As new publishable packages are added, each will have its own workflow trigger pattern following the same `<package-name>@v*` convention.

## Monorepo Packages

Current packages under `packages/`:

| Directory | npm Name | Publishable |
|---|---|---|
| `miot-calendar-client` | `@microboxlabs/miot-calendar-client` | Yes |
| `db` | — | No (internal) |
| `ui` | — | No (internal) |
| `eslint-config` | — | No (internal) |
| `typescript-config` | — | No (internal) |
| `sonarcloud-tools` | — | No (internal) |
