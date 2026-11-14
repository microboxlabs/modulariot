# @modulariot/web

Public website, built with Next.js. It is a package of the `turbo-repo` npm workspace.

## Dependencies

`turbo-repo/package-lock.json` is the only source of dependency versions for this app.
Install from `turbo-repo`, never from `apps/web`. Do not add an `apps/web/package-lock.json`;
`.gitignore` excludes it.

```bash
cd turbo-repo
npm ci
```

## Commands

Run from `turbo-repo`:

| Command | Purpose |
| --- | --- |
| `npm run dev --workspace=@modulariot/web` | Dev server on http://localhost:3041 |
| `npm run build --workspace=@modulariot/web` | Production build (`.next/standalone`) |
| `npm run check-types --workspace=@modulariot/web` | Type check |

## CI and Docker

`.github/workflows/web.yml` runs `npm ci` in `turbo-repo`, builds with
`npx turbo run build --filter=@modulariot/web`, and copies `.next/standalone`, `.next/static`
and `public` into the image. The Dockerfiles copy that compiled output and do not install
dependencies.
