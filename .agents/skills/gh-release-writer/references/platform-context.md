# ModularIoT Platform — Release Notes Context

## Platform Overview

ModularIoT is a platform for industrial IoT coordination (trips, drivers, vehicles, tasks, delivery).
Issues are distributed across multiple repositories in the `microboxlabs` org:

| Repo | Type | Role |
|------|------|------|
| `modulariot` | OSS | Main monorepo: calendar client, CLI, web dashboard |
| `ecm-coordinator` | Private | Custom client: coordinator web app (Next.js) |
| `coordinador-webclient` | Private | Legacy coordinator frontend (being superseded) |
| Other repos | Mixed | Shared libs, infrastructure, tooling |

**Source of truth for releases is the GitHub Project (#4), not individual repos.**
Two milestone types combine to form a release:

- **`release` source** — versioned milestone (e.g. `1.27.0`) found in private repos; custom client deliverables
- **`oss` source** — OSS milestone (e.g. `MIOT-0.2.0`) found in public/OSS repos; platform features integrated in this release

## Issue Categorization

### By label (checked first)
| Labels | Section |
|--------|---------|
| `enhancement`, `feature`, `feat` | 🚀 Evolutivos |
| `integration`, `infrastructure`, `devops` | 🔧 Integraciones |
| `bug`, `fix` | 🐛 Correcciones |
| `auth`, `security` | 🔧 Integraciones or 🐛 Correcciones depending on context |
| `ui`, `ux`, `performance` | 🚀 Evolutivos |

### By title prefix (fallback when labels are absent)
| Prefix | Section |
|--------|---------|
| `feat:`, `feat(…):` | 🚀 Evolutivos |
| `bug:`, `fix:`, `fix(…):` | 🐛 Correcciones |
| CI/CD, infra, service config | 🔧 Integraciones |

When source is `oss`, consider adding a short contextual note like
"*(Integración OSS — MIOT-0.2.0)*" to clarify the issue originates from the open-source line.

## MDX Output Format

File: `src/releases/{version}.mdx`

```markdown
# 🔔 Release Notes v{version} — ModularIoT

### Fecha: {DD/MM/YYYY}

**Objetivo**: {1–2 sentence summary of release goals and themes}

## 🚀 Evolutivos

- **📍 Feature Name**
  - **Key point**: What was implemented.
  - **Technical detail**: How it connects with other systems.

## 🔧 Integraciones

- **🔌 Integration Name**
  - **Scope**: What was integrated or changed.

## 🐛 Correcciones

- **🐛 Bug description**
  - **Impact**: What was broken and how it is now fixed.

## 📊 Beneficios

- 🚀 **Benefit 1**: ...
- 🔒 **Benefit 2**: ...
(5–7 bullets covering user, technical, and operational improvements)

## 📌 Conclusión

{2–3 paragraphs: significance, achievements, future implications}
```

## Formatting Guidelines

1. Strip conventional-commit prefixes (`feat:`, `fix:`, `feat(scope):`) from issue titles for display.
2. Bold key terms and feature names.
3. Group related issues into a single bullet when they form one cohesive feature.
4. Keep descriptions concise — use sub-bullets for technical detail, not inline prose.
5. All user-facing text in **Spanish**.
6. Emojis in section headers and lead bullets are expected and consistent with prior releases.
