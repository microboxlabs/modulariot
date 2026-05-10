# Category B — workflow-shape checklist

Per plan
[`13-server-deployment/10-deploy-evals.md`](../../../.cursor/plans/ai-first/13-server-deployment/10-deploy-evals.md),
Category B is intentionally a review-style checklist rather than a
script. Automating "did the YAML do what I meant" against itself is
brittle for low payoff — these claims are easy to verify with a quick
pass through the run UI plus a spot-check on the YAML diff.

Run this after every meaningful change to `.github/workflows/harness.yaml`,
and as part of any incident review where CI behaved unexpectedly.

## Trigger surface

- [ ] Path filter `miot-harness/**` triggers the workflow on edits
      under that directory (verify by pushing a one-line README change
      and watching the Actions tab).
- [ ] Path filter `.github/workflows/harness.yaml` triggers when the
      workflow itself changes (changes to YAML must trigger a self-run).

## Job ordering and gating

- [ ] `lint-and-test` runs first.
- [ ] `image-evals-pre-publish` is gated on `lint-and-test` (red
      lint = no eval; saves CI minutes).
- [ ] `publish-image` is gated on `image-evals-pre-publish` (failed
      eval must block the registry push).
- [ ] `distribution-evals` is gated on `publish-image` (no point
      pulling what we didn't push).
- [ ] `security-scan` is gated on `publish-image` AND skipped on PR.
- [ ] `summary` runs `if: always()` so failed runs still get a
      readable summary block.

## Tag policy

These claims live in the `metadata-action` config inside
`harness.yaml`. Spot-check a recent run's image tags against the
expected pattern. (We deliberately don't ship a script: the
`metadata-action` config IS the spec; re-asserting it from a script
would duplicate YAML.)

- [ ] PR build: tags `pr-<n>` + `sha-<short>` on GHCR ONLY. **Nothing
      on Docker Hub.**
- [ ] Default-branch (trunk/main) build: `latest` + `sha-<short>` on
      both registries.
- [ ] `v*` tag build: `<full version>` + `<major>.<minor>` +
      `sha-<short>` on both registries.

## Attestations

- [ ] Published images have a SLSA provenance attestation
      (verified by `07-attestations-present.sh`).
- [ ] Published images have an SBOM attestation (SPDX or CycloneDX).
- [ ] `provenance: true, sbom: true` is set on the
      `docker/build-push-action@v6` invocation. Removing either must
      cause `07-attestations-present.sh` to FAIL — that's the
      negative-control proof the eval works.

## Observability

- [ ] `security-scan` uploaded SARIF to the GitHub Security tab on
      the most recent non-PR run (Code → Security → Code scanning).
- [ ] `summary` job wrote a table to `$GITHUB_STEP_SUMMARY` that
      shows lint, evals, image, distribution, security results.
- [ ] Removing `provenance: true` or `sbom: true` from the
      `build-push-action@v6` call must make `07-attestations-present.sh`
      FAIL. That's the negative-control proof the supply-chain eval
      works; verify manually whenever that step is touched.

## Secrets surface

- [ ] Only `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` come from
      org-level secrets; `GITHUB_TOKEN` is the auto-injected one.
- [ ] No new secrets introduced relative to the existing
      `quarkus.yml` / `ci.yaml` workflows.

## What's NOT verified here

- Image pull semantics → `05-pulls-from-ghcr.sh`, `06-pulls-from-dockerhub.sh`
- Attestation predicate types → `07-attestations-present.sh`
- Tag discipline + workflow self-shape are deliberately NOT scripted.
  The PR check UI surfaces missing/failed jobs; the metadata-action
  config IS the tag spec. Scripting either is paranoid and brittle.
