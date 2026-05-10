# Deploy evals

Operational checks that verify the harness packages and runs as a
container — distinct from the LLM-quality evals one level up
(`miot-harness/evals/judge_prompt.md` + `evals/results/*.json`). Both
suites share a directory but never share a runner; their exit codes
mean different things.

The selection here is intentionally small. We ship only the checks
that catch a class of bug CI doesn't naturally fail on:

- `docker build` failure → CI already fails; we don't double-check.
- The container actually works at runtime → not implicit; **02 catches it.**
- Manifest landed at the registry → push exit 0 isn't a guarantee; **05/06 catch it.**
- Provenance + SBOM attestations present → silently degrades if
  someone removes `provenance: true`; **07 is the negative-control.**

## What's here

| Script | Category | Asserts |
|---|---|---|
| `01-image-builds.sh` | A — image works | `docker build` succeeds; compressed image ≤ `HARNESS_EVAL_MAX_COMPRESSED_MB` (default 250). The build itself is implicit; the size budget is the load-bearing assertion. |
| `02-image-boots.sh` | A — image works | `docker run` boots within timeout; `/health` returns 200 with the deploy-readable shape (`status`, `env`, `nexo.{enabled,tools,snapshot_age_minutes}`). |
| `03-image-runs-demo.sh` | A — image works | `miot-harness demo "..."` runs to completion inside the container. Gated on `HARNESS_EVAL_DEMO=1` or a model API key in env (consumes credit). |
| `05-pulls-from-ghcr.sh` | C — distribution | Anonymous `docker pull` from GHCR succeeds for the given digest/tag. |
| `06-pulls-from-dockerhub.sh` | C — distribution | Same against the Docker Hub mirror; catches PR-skip-guard regressions and rotated `DOCKERHUB_TOKEN`. |
| `07-attestations-present.sh` | C — distribution | `gh attestation verify` finds both a SLSA provenance predicate AND an SBOM predicate (SPDX / CycloneDX). |
| `B-checklist.md` | B — workflow shape | Review-style runbook for claims too brittle to automate. |
| `run-all.sh` | — | Orchestrator. Runs Category A only; Category C scripts take registry-derived args and are invoked by CI's `distribution-evals` job (or manually with a real digest). |

Each script emits `PASS|FAIL <ID>` as its first stdout line so CI logs
are easy to grep. All scripts self-clean their containers/images on
exit (pass or fail) — running twice in a row works.

## Quickstart

From the repository root:

```bash
# Run all Category A evals (no API key required for 01 + 02; 03 skips
# unless ANTHROPIC_API_KEY or OPENAI_API_KEY is in env).
bash miot-harness/evals/deploy/run-all.sh

# Run a single eval directly (useful for iteration).
bash miot-harness/evals/deploy/02-image-boots.sh

# Force the demo eval even without a key (will fail when the agent
# tries to call the model — useful for diagnosing setup, not for
# acceptance).
HARNESS_EVAL_DEMO=1 bash miot-harness/evals/deploy/03-image-runs-demo.sh
```

## Environment knobs

All optional; sensible defaults work for local dev.

| Var | Default | Purpose |
|---|---|---|
| `HARNESS_EVAL_TAG` | `miot-harness:eval` | Image tag built by 01 / consumed by 02 + 03 |
| `HARNESS_EVAL_NAME` | `miot-harness-eval` | Container name (must be unique on the host) |
| `HARNESS_EVAL_PORT` | `18765` | Host port mapped to the container's 8000 |
| `HARNESS_EVAL_BOOT_TIMEOUT_S` | `15` | Max wait for `/health` to respond |
| `HARNESS_EVAL_DEMO_TIMEOUT_S` | `60` | Max wait for `miot-harness demo` to complete |
| `HARNESS_EVAL_MAX_COMPRESSED_MB` | `250` | Compressed image budget (registry/k8s pull cost) |
| `HARNESS_VERSION` | `0.0.0-eval` | Build arg baked into the image label |
| `HARNESS_EVAL_DEMO` | unset | Force-run 03 even without an API key in env |

## Cleanup contract

- Each script registers a `trap … EXIT` handler that removes its
  container (`docker rm -f`).
- `01-image-builds.sh` removes the test image **only on failure** —
  on success it leaves the image for 02 and 03 to consume.
- `run-all.sh` removes the test image at the end of the full suite,
  so a clean run leaves no residue. A single-script run leaves the
  image for iteration; the next 01 invocation overwrites it.

Run twice in a row — the second run starts from a clean slate. If a
container is left over from a manual run, the next eval pre-cleans
before starting.

## What these evals do NOT cover

- **LLM quality** — the agent-quality goldens at `evals/judge_prompt.md`.
- **Workflow shape** — verifying the GitHub Actions job graph as a
  script. The PR check UI already shows missing/failed jobs; a self-
  shape script is paranoid and brittle. See `B-checklist.md` for the
  review-style alternative.
- **Tag-pattern verification** — that PR runs got `pr-<n>` and trunk
  pushes got `latest`. The `metadata-action` config IS the spec; a
  script that re-asserts it would just duplicate the YAML.

## Contract for new scripts

If you add a script under `deploy/`:

1. Numbered prefix (`04-…`, `05-…`, …).
2. First stdout line is exactly `PASS|FAIL <id> — <one-line>` or
   `PASS <id> — SKIPPED (<reason>)`.
3. `set -euo pipefail` and a `trap … EXIT` cleanup.
4. Honor the env knobs above where applicable.
5. Add to the `SCRIPTS` array in `run-all.sh`.
