# Eval baselines

`miot-harness-evals` produces a result JSON per run. Some of those runs
are **baselines** — pinned snapshots of the suite's behavior against a
known-good commit, used as the reference for future regression /
drift comparisons.

## Currently canonical

| Mode  | File | Commit | When pinned | Pinned by |
|-------|------|--------|-------------|-----------|
| fake  | `b8948a5e4.json` | `b8948a5e4` | 2026-05-26 | (carries over from PR #535) |
| real  | *not yet pinned* | *—* | *—* | *—* |

## Pinning a new fake-mode baseline

Whenever an intentional change shifts the deterministic fake-mode
scoring (a scoring axis added, a YAML case revised, a tool refactor
that legitimately re-routes), update the row above and commit the new
result JSON alongside the change that caused it. The previous baseline
stays in `evals/results/` for git-log archaeology.

```
uv run miot-harness-evals --mode fake
git add miot-harness/evals/results/<new-sha>.json miot-harness/evals/results/BASELINES.md
git commit -m "test(evals): pin fake-mode baseline at <sha>"
```

## Pinning the first real-mode baseline

Real mode requires:
- `ANTHROPIC_API_KEY` exported
- `MIOT_HARNESS_DATASOURCE_DSN` pointing at the Coordinador DB (tunnel up via
  `db-scripts/bin/tunnel.sh` — see `evals/README.md` for the full
  preflight)
- Budget for ~6 LLM calls × 25 cases ≈ 150 model invocations against
  Haiku + Sonnet tiers

```
# from miot-harness/
uv run miot-harness-evals --mode real
# → writes evals/results/<HEAD-sha>-real.json
git add miot-harness/evals/results/<HEAD-sha>-real.json miot-harness/evals/results/BASELINES.md
# update the "real" row above with the new file/commit/date/author
git commit -m "test(evals): pin real-mode baseline at <sha>"
```

Re-pin when the underlying model changes (a Claude version bump, a
prompt rewrite, a new agent in the graph), not on routine code changes
that leave the fake-mode baseline intact.

## How drift comparison resolves the baseline

In `--mode real`, the runner reads `evals/results/<HEAD-sha>.json` by
default and annotates each scored case with `drift: bool` (whether
`tool_selection` / `filter_sanity` differs from the baseline) plus a
`drift_detail` dict when they do. Pass `--baseline <path>` to compare
against a pinned baseline instead of the same-commit one.
