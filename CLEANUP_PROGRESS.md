# Dead Code Cleanup Progress

Status: **IN PROGRESS**

## Summary

Creating PRs for dead code cleanup in chunks, similar to Dependabot.

## Completed PRs

### ✅ Chunk 2: Icons Feature (10 files)

- **PR**: #887
- **Branch**: `based/885-cleanup-chunk2-icons`
- **Status**: PR created
- **Files**: 10 unused icon components

### ⚠️ Chunk 7: Core Features (4 files)

- **Branch**: `based/885-cleanup-chunk7-core-features`
- **Status**: Branch created, needs PR
- **Files**:
  - src/features/auth/services/actions-auth.service.ts
  - src/features/signal-history/hooks/use-debounce-callback.ts
  - src/features/sse/context/sse-context.ts
  - src/features/where-is-my-load/timeline-old.tsx

### ⚠️ Chunk 8: Infrastructure (4 files)

- **Branch**: `based/885-cleanup-chunk8-infrastructure`
- **Status**: Branch created, needs PR
- **Files**:
  - src/lib/console-replacer.ts
  - src/middleware/pino-http.ts
  - src/utils/comments.ts
  - src/utils/version.ts

### ⚠️ Chunk 9: Rest-api Shared Library (2 files)

- **Branch**: `based/885-cleanup-chunk9-rest-api`
- **Status**: Skipped (submodule)
- **Note**: Rest-api is a git submodule, requires different approach

## Remaining Chunks

### Pending: Chunk 3: Task-forms Feature (29 files)

- **Risk**: Medium-High (largest chunk)
- **Files**: 29 files in task-forms feature

### Pending: Chunk 4: Common Feature (8 files)

- **Risk**: Medium (shared components)
- **Files**: 8 files in common feature

### Pending: Chunk 5: Layout Feature (8 files)

- **Risk**: Medium (UI components)
- **Files**: 8 files in layout feature

### Pending: Chunk 6: Shipping/Symptoms/Geographic-view (9 files)

- **Risk**: Medium (business features)
- **Files**: 9 files across shipping, symptoms, geographic-view

### Pending: Chunk 10: Dependencies (10 deps + 11 devDeps)

- **Risk**: Low (npm packages)
- **Files**: 21 unused npm packages

## Next Steps

1. Fix commits for Chunks 7 and 8 (ensure commits are pushed)
2. Create PRs for Chunks 7 and 8
3. Continue with remaining chunks (3, 4, 5, 6, 10)
4. Consider breaking Chunk 3 into sub-chunks if needed

## Notes

- Working from base branch: `based/885-dead-code-detection`
- All PRs merge to: `based/885-dead-code-detection`
- Related issue: #885
- See `DEAD_CODE_CLEANUP_PLAN.md` for detailed plan
