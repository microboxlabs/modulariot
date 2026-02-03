---
name: gh-release-writer
description: Generate release notes from GitHub milestones. Use when the user wants to create release notes for a specific version by fetching issues from a GitHub milestone and formatting them according to the project's release notes template.
---

# GitHub Release Notes Writer

Generate comprehensive release notes for the coordinador-webclient project by fetching issues from a GitHub milestone and formatting them according to the established template.

## When to Use

Use this skill when the user wants to:

- Create release notes for a new version
- Generate release documentation from a GitHub milestone
- Document all changes included in a release

## Instructions

### Step 1: Parse User Input

1. Extract the milestone identifier (can be milestone number or milestone ID from GitHub)
2. Extract the release version number (e.g., `1.26.0`)
3. Optionally extract the release date (if not provided, use current date in format `DD/MM/YYYY`)

**Note:** Milestone numbers are typically what you see in GitHub URLs (e.g., milestone 42). If the user provides a milestone ID (internal GitHub ID), you may need to look it up first.

### Step 2: Load Environment Variables

Read the required configuration from `.env.local` file:

```bash
source .env.local
```

**Required variables:**
- `GH_PROJECT_OWNER` - Organization or user (e.g., microboxlabs)
- `GH_ISSUE_REPO` - Repository for issues (e.g., owner/repo)

### Step 3: Fetch Milestone Information

Get milestone details and associated issues using `gh` CLI:

```bash
source .env.local

# If the user provided a milestone ID (internal GitHub ID), convert it to milestone number
# Otherwise, use the provided value directly as milestone number
MILESTONE_NUM=$(gh api repos/$GH_ISSUE_REPO/milestones --jq ".[] | select(.id == <MILESTONE_ID> or .number == <MILESTONE_ID>) | .number" | head -1)

# If conversion failed, try using the value directly as milestone number
if [ -z "$MILESTONE_NUM" ]; then
  MILESTONE_NUM=<MILESTONE_ID>
fi

# List issues in the milestone
gh issue list \
  --repo $GH_ISSUE_REPO \
  --milestone "$MILESTONE_NUM" \
  --state all \
  --json number,title,body,labels,state,url \
  --limit 1000
```

**Alternative: Using GitHub API directly**
```bash
source .env.local

# Fetch issues using GitHub API with milestone filter
gh api repos/$GH_ISSUE_REPO/issues \
  --jq '.[] | select(.milestone.id == <MILESTONE_ID> or .milestone.number == <MILESTONE_ID>)' \
  --paginate
```

**Note:** The `gh issue list --milestone` command accepts milestone numbers (visible in GitHub UI) or milestone titles. If you have a milestone ID, you may need to look up the milestone number first.

### Step 4: Categorize Issues

Categorize issues into the following sections based on labels and content:

1. **🚀 Evolutivos (Features/Enhancements)**
   - Issues with labels: `enhancement`, `feature`, `feat`
   - Issues with titles starting with `feat:`
   - New functionality or improvements

2. **🔧 Integraciones (Integrations)**
   - Issues with labels: `integration`, `infrastructure`, `devops`
   - Issues related to external services, CI/CD, or infrastructure changes
   - Third-party service integrations

3. **🐛 Correcciones (Bug Fixes)**
   - Issues with labels: `bug`, `fix`
   - Issues with titles starting with `bug:`
   - Bug fixes and corrections

**Note:** If an issue has multiple relevant labels, categorize it in the most appropriate section. Integration-related features should go in Integraciones.

### Step 5: Format Issues

For each issue, format it as a bullet point with:

- **Bold title** based on the issue title (remove prefixes like `feat:`, `bug:`)
- **Description** extracted from the issue body or title
- **Sub-bullets** for key points if the issue body contains detailed information

**Format example:**
```markdown
- **📍 Feature Name**
  - **Key point 1**: Description of what was implemented.
  - **Key point 2**: Additional details or technical notes.
  - **Integration details**: How it connects with other systems.
```

### Step 6: Generate Objective

Create a concise "Objetivo" (Objective) paragraph that summarizes:
- The main goals of the release
- Key themes across all changes
- Overall impact on the system

### Step 7: Generate Benefits Section

Create a **📊 Beneficios** section with 5-7 bullet points highlighting:
- User-facing improvements
- Technical benefits
- Operational advantages
- Performance gains
- Security enhancements

Use emojis to make it visually appealing and consistent with the style.

### Step 8: Generate Conclusion

Create a **📌 Conclusión** section (2-3 paragraphs) that:
- Summarizes the release's significance
- Highlights major achievements
- Contextualizes the release within the project's evolution
- Mentions future implications or foundations laid

### Step 9: Generate MDX File

Create the release notes file in `src/releases/` directory:

**File naming:** `{version}.mdx` (e.g., `1.26.0.mdx`)

**File structure:**
```markdown
# 🔔 Release Notes v{version} — ModularIoT

### Fecha: {DD/MM/YYYY}

**Objetivo**: {Objective paragraph}

## 🚀 Evolutivos

{Formatted feature issues}

## 🔧 Integraciones

{Formatted integration issues}

## 🐛 Correcciones

{Formatted bug fix issues}

## 📊 Beneficios

{Benefits list}

## 📌 Conclusión

{Conclusion paragraphs}
```

### Step 10: Write the File

Write the generated content to `src/releases/{version}.mdx` using the file write tool.

## Required Environment Variables

These values must be set in the `.env.local` file (not committed to git):

```bash
# GitHub Organization/Repository
GH_PROJECT_OWNER=         # Organization or user (e.g., microboxlabs)
GH_ISSUE_REPO=            # Repository for issues (e.g., owner/repo)
```

To find milestone information, use:

```bash
source .env.local

# List all milestones
gh api repos/$GH_ISSUE_REPO/milestones --jq '.[] | {id: .id, number: .number, title: .title, state: .state}'

# Get issues for a specific milestone (by number)
gh issue list --repo $GH_ISSUE_REPO --milestone <NUMBER> --state all
```

## Project Context

When writing release notes, understand that coordinador-webclient is:

- A Next.js 16 application with React 19
- Part of the ModularIoT platform for trip coordination
- Uses Flowbite React for UI components
- Integrates with multiple backend services (ECM, EAM, Alfresco)
- Follows TypeScript strict mode
- Uses internationalization (i18n) with Spanish and English

**Key areas:**
- Trip management and coordination
- Driver and vehicle tracking
- Task forms and workflows
- Geographic visualization
- Symptoms tracking
- Shipping and delivery management

**Common labels to recognize:**
- `enhancement`, `feature`, `feat` → Evolutivos
- `bug`, `fix` → Correcciones
- `integration`, `infrastructure`, `devops` → Integraciones
- `auth`, `security` → May be Evolutivos or Correcciones depending on context
- `ui`, `ux` → Usually Evolutivos
- `performance` → Usually Evolutivos

## Formatting Guidelines

1. **Use emojis consistently** in section headers and bullet points
2. **Bold key terms** and feature names
3. **Keep descriptions concise** but informative
4. **Group related issues** when they form a cohesive feature
5. **Use technical language** appropriately for the audience
6. **Maintain Spanish language** for all user-facing text
7. **Include technical details** when relevant (endpoints, services, technologies)

## Example Usage

User input: "Generate release notes for milestone 42, version 1.26.0"

Process:
1. Fetch milestone 42 issues from GitHub
2. Categorize into Evolutivos, Integraciones, Correcciones
3. Format each issue appropriately
4. Generate Objective, Benefits, and Conclusion
5. Write to `src/releases/1.26.0.mdx`
