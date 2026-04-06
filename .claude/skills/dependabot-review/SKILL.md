---
name: dependabot-review
description: >
  Review Dependabot security alerts, plan resolution, and propose fixes.
  Use when the user asks to check security vulnerabilities, review a Dependabot
  alert, fix a CVE, audit dependencies, or provides a Dependabot alert URL.
  Also use when the user says "check security", "fix vulnerability",
  "dependabot", "CVE", or "security alert".
---

# Dependabot Security Review

Review GitHub Dependabot alerts, plan their resolution, and propose fixes.

## Input

The user provides one of:

- A Dependabot alert URL (e.g. `https://github.com/microboxlabs/modulariot/security/dependabot/112`)
- An alert number (e.g. `112`)
- A keyword like `all`, `critical`, `high` to list/filter open alerts
- A package name to find alerts affecting that package

## Workflow

### 1. Fetch Alert(s)

**Single alert** (URL or number provided):

Extract the alert number from the URL path (last segment) or use the number directly.

```bash
gh api repos/microboxlabs/modulariot/dependabot/alerts/<NUMBER> \
  --jq '{
    number, state, html_url,
    package: .dependency.package.name,
    ecosystem: .dependency.package.ecosystem,
    manifest: .dependency.manifest_path,
    relationship: .dependency.relationship,
    vulnerable_range: .security_vulnerability.vulnerable_version_range,
    patched_version: .security_vulnerability.first_patched_version.identifier,
    severity: .security_advisory.severity,
    cvss: .security_advisory.cvss.score,
    summary: .security_advisory.summary,
    cve: .security_advisory.cve_id,
    ghsa: .security_advisory.ghsa_id,
    cwes: [.security_advisory.cwes[] | "\(.cwe_id): \(.name)"],
    description: .security_advisory.description,
    references: [.security_advisory.references[].url]
  }'
```

**List open alerts** (no number, or keyword like `all`, `critical`, `high`):

```bash
gh api repos/microboxlabs/modulariot/dependabot/alerts?state=open\&per_page=100 \
  --jq '[.[] | {
    number, severity: .security_advisory.severity,
    package: .dependency.package.name,
    ecosystem: .dependency.package.ecosystem,
    manifest: .dependency.manifest_path,
    relationship: .dependency.relationship,
    patched: .security_vulnerability.first_patched_version.identifier,
    summary: .security_advisory.summary
  }]'
```

To filter by severity, pipe through `| map(select(.severity == "critical"))` (or `"high"`, etc.).
To filter by package name, pipe through `| map(select(.package | contains("NAME")))`.

### 2. Triage and Assess

For each alert, determine:

| Factor | How to assess |
|--------|---------------|
| **Severity** | Use the CVSS score and GitHub severity (critical/high/medium/low). |
| **Exploitability** | Read the advisory description: does it require network access, user interaction, special privileges? |
| **Exposure** | Is the dependency `runtime` or `development`? Is it `direct` or `transitive`? |
| **Blast radius** | Which manifest file? Which part of the app does it affect? |
| **Fix availability** | Is there a `patched_version`? If yes, the fix is usually a version bump. If not, a workaround is needed. |

Present a summary table:

```
| # | Severity | Package | Patched | Relationship | Manifest | Fix |
|---|----------|---------|---------|-------------|----------|-----|
```

### 3. Plan Resolution

For each alert, determine the resolution strategy:

#### A. Version bump available (patched version exists)

1. **Direct dependency** — update the version in `package.json` (or `pom.xml` / `build.gradle` for JVM).
2. **Transitive dependency** — find what pulls it in:

```bash
# npm
cd <directory-containing-manifest> && npm ls <package-name>

# For deeper analysis
npm explain <package-name>
```

For transitive deps, the options are:
- Update the **parent** direct dependency that pulls it in (preferred).
- Add an `overrides` entry in `package.json` to force the patched version.
- If the parent has no compatible update, open an issue upstream.

3. Check if the patched version introduces breaking changes by reading the package's changelog or release notes.

#### B. No patched version (workaround needed)

- Check the advisory description for suggested workarounds.
- Evaluate if the vulnerable code path is reachable in our usage.
- If not reachable, document why and dismiss the alert with reason.
- If reachable, propose a code-level mitigation (input validation, alternative package, etc.).

#### C. Dismissal (false positive or not applicable)

If the vulnerability is not exploitable in our context:

```bash
gh api repos/microboxlabs/modulariot/dependabot/alerts/<NUMBER> \
  -X PATCH \
  -f state=dismissed \
  -f dismissed_reason="not_used" \
  -f dismissed_comment="<explanation>"
```

Valid `dismissed_reason` values: `fix_started`, `inaccurate`, `no_bandwidth`, `not_used`, `tolerable_risk`.

### 4. Propose Fix

Apply the chosen resolution:

#### For npm version bumps (direct dependency)

```bash
cd <directory-containing-manifest>
npm install <package>@<patched-version>
```

Then verify the lockfile updated correctly and no peer dependency conflicts arose.

#### For npm transitive overrides

Add to the relevant `package.json`:

```json
{
  "overrides": {
    "<package>": "<patched-version>"
  }
}
```

Then run `npm install` to regenerate the lockfile.

#### For Maven/Gradle (Quarkus)

Update the version property or dependency declaration in `pom.xml` / `build.gradle.kts`.

### 5. Verify

After applying changes:

1. **Check the dependency tree** — confirm the vulnerable version is gone:

```bash
npm ls <package-name>
```

2. **Run tests** — ensure nothing broke:

```bash
# For turbo-repo packages
cd turbo-repo && npx turbo run test --filter=<affected-package>

# For Quarkus
cd quarkus-srv && ./mvnw test
```

3. **Re-check alerts** — after pushing, Dependabot will auto-close resolved alerts.

### 6. Report

Present the results to the user:

- **Alert summary**: number, severity, package, CVE.
- **Resolution applied**: what was changed and why.
- **Verification**: test results, dependency tree confirmation.
- **Remaining risks**: any alerts that could not be fixed, with explanation.
- **Recommendation**: whether to create a PR, dismiss, or escalate.

If the user wants to create a PR for the fix, suggest using `/gh-issue-writer` to track the work and create a development branch.

## Quick Reference: Common Resolution Patterns

| Scenario | Action |
|----------|--------|
| Direct dep, patch available | `npm install pkg@patched` |
| Transitive dep, parent updatable | Update parent direct dependency |
| Transitive dep, parent not updatable | Add `overrides` in `package.json` |
| Dev-only dependency | Lower priority; update or dismiss as `tolerable_risk` |
| No patch, workaround exists | Apply workaround, document in dismiss comment |
| No patch, not reachable | Dismiss as `not_used` with explanation |
| No patch, reachable, no workaround | Escalate: consider alternative package or code change |

## Output Format

Always structure the output as:

```
## Security Alert #<N> — <package> (<severity>)

**CVE:** <cve>  |  **GHSA:** <ghsa>  |  **CVSS:** <score>
**Package:** <package>@<vulnerable-range> → <patched-version>
**Manifest:** <manifest-path>  |  **Relationship:** <direct|transitive>

### Summary
<one-paragraph description of the vulnerability>

### Risk Assessment
- **Severity:** <critical|high|medium|low>
- **Exposure:** <runtime|development> / <direct|transitive>
- **Exploitability:** <assessment based on advisory>
- **Affected area:** <which part of the codebase>

### Resolution Plan
<numbered steps>

### Changes Applied
<what was modified>

### Verification
<test results, dependency tree check>
```
