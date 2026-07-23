# Dependabot alert inventory and resolution map

Snapshot taken from the GitHub Dependabot API on 2026-07-23.

## Summary

- Open alerts: **77**
- Ecosystems: **75 npm**, **2 pip**
- Package families: **20**
- Severity mix: critical, high, medium, and low
- Baseline npm audit: **22 vulnerable installed nodes** (2 critical, 10 high,
  6 moderate, 4 low)
- Baseline npm clean install: passed
- Baseline npm type checks: 20/20 tasks passed
- Baseline npm lint: passed with pre-existing warnings
- Baseline Python tests: 1,021 passed, 4 skipped

The root Turbo test command has a pre-existing ordering race: the
`@microboxlabs/miot-cli` tests can start while `@microboxlabs/miot-chat`
cleans/rebuilds its `dist` directory. Building `@microboxlabs/miot-chat`
first makes the CLI suite pass (70/70). Final verification therefore runs
that build before the Turbo test graph.

## Alert-to-resolution map

| Package | Alerts | Severity / exposure | Manifest and relationship | Affected range -> target | Actual parent | Resolution |
|---|---:|---|---|---|---|---|
| `@babel/core` | #260 | low / development | `turbo-repo/package-lock.json`, transitive | `<=7.29.0` -> `>=7.29.6` | Next ESLint stack | Refresh to 7.29.6 or newer through the upgraded lint stack. |
| `brace-expansion` | #300, #299, #277 | high / mixed | `turbo-repo/package-lock.json`, transitive | 1.x `<1.1.16`; 2.x `<2.1.2`; 3-5.x `<5.0.7` -> corresponding patched releases | `minimatch` instances | Refresh each supported major to its patched release. |
| `cookie` | #69 | low / runtime | `turbo-repo/package-lock.json`, transitive | `<0.7.0` -> removed or `>=0.7.0` | `@auth/core@0.34.3` | Upgrade `next-auth` beta to 5.0.0-beta.32, which uses `@auth/core@0.41.3` and removes this dependency. |
| `dompurify` | #303, #272, #271, #270, #269, #268, #267, #266, #265 | medium/low / runtime | `turbo-repo/package-lock.json`, transitive | overlapping ranges through `<=3.4.11` -> `>=3.4.12` | `jspdf`, `mermaid` | Refresh the shared compatible dependency to 3.4.12 or newer. |
| `echarts` | #276 | medium / runtime | `turbo-repo/package-lock.json`, transitive peer | `<6.1.0` -> `>=6.1.0` | `echarts-for-react` peer | Resolve the peer explicitly at 6.1.0 or newer. |
| `esbuild` | #242 | low / development | `turbo-repo/package-lock.json`, transitive | `>=0.27.3 <0.28.1` -> `>=0.28.1` | `vite`, `tsup`, `tsx` | Upgrade parents and apply a documented root override to 0.28.1 because current Vite/tsup ranges still select vulnerable 0.27.x. |
| `fast-jwt` | #163, #138, #137, #135, #130, #126 | critical/high/medium / runtime | `turbo-repo/package-lock.json`, transitive | overlapping ranges through `<=6.2.3` -> `>=6.2.4` | `@fastify/jwt@9.1.0` | Upgrade `@fastify/jwt` to 10.2.0, which supports Fastify 5 and requires `fast-jwt^6.2.4`. |
| `fast-uri` | #305, #302 | high / runtime | `turbo-repo/package-lock.json`, transitive | `3.0.0-3.1.3` -> `>=3.1.4` | AJV/Fastify schema stack | Refresh the shared compatible dependency to 3.1.4 or newer. |
| `form-data` | #264 | high / runtime | `turbo-repo/package-lock.json`, transitive | `4.0.0-4.0.5` -> `>=4.0.6` | `jsdom`, `superagent` | Refresh within the parents' `^4.0.0` range. |
| `js-yaml` | #301, #275 | high/medium / development | `turbo-repo/package-lock.json`, transitive | `4.0.0-4.2.0` -> `>=4.3.0` | `@eslint/eslintrc` | Upgrade `@eslint/eslintrc` to 3.3.6, which requires `js-yaml^4.3.0`. |
| `next` | #322-#306, #298-#281 | high/medium / runtime | lockfile plus direct `apps/app` and `apps/web` manifests | Next 16 `<16.2.11`; Next 15 `<15.5.21` -> 16.2.11 / 15.5.21 | four Next apps plus `packages/ui` development dependency | Align Next 16 workspaces and companion packages at 16.2.11; align `web-admin` at 15.5.21. |
| `postcss` | #157 | medium / runtime | `turbo-repo/package-lock.json`, transitive | `<8.5.10` -> `>=8.5.10` | Next 15/16 pin 8.4.31 | Apply a documented root override to 8.5.17 because even patched Next releases pin the vulnerable 8.4.31. |
| `pyasn1` | #279, #278 | high / runtime | `miot-harness/uv.lock`, transitive | `<=0.6.3` -> `>=0.6.4` | `deepagents -> langchain-google-genai -> google-genai -> google-auth -> pyasn1-modules` | Refresh only `pyasn1` in the uv lockfile. |
| `qs` | #231 | medium / runtime | `turbo-repo/package-lock.json`, transitive | `6.11.1-6.15.1` -> `>=6.15.2` | `superagent` | Refresh within the parent's compatible range. |
| `sharp` | #304, #280 | high / runtime | lockfile plus direct `apps/app` manifest | `<0.35.0` -> `>=0.35.0` | direct app dependency and Next optional dependencies | Upgrade direct sharp to 0.35.3 and override Next's vulnerable 0.34.x optional resolution. |
| `tmp` | #233 | high / development | `turbo-repo/package-lock.json`, transitive | `<0.2.6` -> `>=0.2.6` | `patch-package` | Refresh within the parent's `^0.2.4` range. |
| `uuid` | #232 | medium / runtime | `turbo-repo/package-lock.json`, transitive | `<11.1.1` -> `>=11.1.1` | `auth0@4.37.0` | Upgrade to `auth0@4.37.1`, which pins `uuid@11.1.1`. |
| `vite` | #263, #262 | high/medium / development | `turbo-repo/package-lock.json`, transitive | `7.0.0-7.3.4` -> `>=7.3.5` | Vitest 3/4 dependency graph | Refresh the Vite 7 resolution to 7.3.5 or newer without forcing all workspaces onto Vite 8. |
| `ws` | #259 | high / runtime | `turbo-repo/package-lock.json`, transitive | `8.0.0-8.20.1` -> `>=8.21.0` | `ink`, `jsdom` | Refresh within compatible 8.x ranges. |
| `xlsx` | #161, #160, #159, #158 | high / runtime | lockfile plus direct `apps/app` manifest | `<0.20.2` and `<0.19.3` -> `0.20.3` | direct `@modulariot/app` dependency | Replace the stale npm registry release with SheetJS's official Apache-2.0 `xlsx-0.20.3.tgz`; preserve and test the existing dynamic `read`/`sheet_to_json` API. |

The alert counts in the table sum to 77. No alert is planned for dismissal,
risk acceptance, or `not_used` treatment.

## Planned verification

1. Verify every installed version against its advisory range with `npm ls`,
   lockfile inspection, and `uv tree`.
2. Run clean installs, lint, TypeScript checks, targeted tests, the complete
   test graph, and affected production builds.
3. Require `npm audit --audit-level=low` to report zero vulnerabilities.
4. Push the branch and poll the Dependabot API until GitHub reconciles the
   open alert set.
