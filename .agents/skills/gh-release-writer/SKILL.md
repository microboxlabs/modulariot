---
name: gh-release-writer
description: Generate release notes for a ModularIoT release by scanning all org repos for issues across one or more GitHub milestones (e.g. a versioned release milestone + an OSS integration milestone) and formatting them into a versioned MDX file at src/releases/. Use when the user wants to create or generate release notes for a specific version, combining issues from a private release milestone and/or an OSS milestone across all repositories in the org.
---

# GitHub Release Notes Writer

Multi-repo release notes generator. Collects issues from a versioned release milestone and an optional OSS integration milestone across all org repos, then formats them into a single MDX file.

Read `references/platform-context.md` for: repo overview, issue categorization rules (labels → sections), MDX output format template, and formatting guidelines.

## Inputs

| Input | Example | Notes |
|-------|---------|-------|
| Release version | `1.27.0` | Filename + heading |
| Release milestone | `1.27.0` | Searched across all org repos |
| OSS milestone | `MIOT-0.2.0` | Optional; issues tagged `source: oss` |
| Release date | `23/02/2026` | Defaults to today (`currentDate` in context) |

## Steps

### 1. Parse inputs

Extract release version, release milestone title, optional OSS milestone title, and optional date from the user's message.

### 2. Fetch issues via script

Run the collector script (all diagnostic output goes to stderr; stdout is JSON):

```bash
./generative_ai/tools/sh/fetch-release-issues.sh \
  --release 1.27.0 \
  --oss MIOT-0.2.0
```

The script scans all repos in `GH_PROJECT_OWNER` (from `.env.local`) and outputs a JSON array:

```json
[
  {
    "repo": "microboxlabs/ecm-coordinator",
    "number": 88,
    "title": "feat: new delivery dashboard",
    "body": "...",
    "labels": ["enhancement"],
    "state": "closed",
    "url": "https://github.com/...",
    "milestone": "1.27.0",
    "source": "release"
  },
  {
    "repo": "microboxlabs/modulariot",
    "number": 46,
    "title": "feat(miot-calendar): purge endpoint support",
    "body": "...",
    "labels": ["enhancement"],
    "state": "closed",
    "url": "https://github.com/...",
    "milestone": "MIOT-0.2.0",
    "source": "oss"
  }
]
```

If `.env.local` is not sourced automatically, run `source .env.local` first.

### 3. Categorize issues

Using the rules in `references/platform-context.md`, assign each issue to one of:
- 🚀 **Evolutivos** — features and enhancements
- 🔧 **Integraciones** — infrastructure, CI/CD, external service integrations
- 🐛 **Correcciones** — bug fixes

### 4. Format each issue

Strip conventional-commit prefixes from the title. Format as a bold lead bullet with sub-bullets for key points drawn from the issue body. For `source: oss` issues, add an `*(Integración OSS — MIOT-0.2.0)*` note.

### 5. Write `src/releases/{version}.mdx`

Using the MDX template from `references/platform-context.md`, generate and write the file including:
- **Objetivo** — 1–2 sentences summarising release goals
- **Evolutivos / Integraciones / Correcciones** — categorised issues
- **Beneficios** — 5–7 bullet points on user, technical, and operational improvements
- **Conclusión** — 2–3 paragraphs on significance and future implications

All user-facing text must be in **Spanish**.
