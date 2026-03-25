---
name: No barrel files
description: User does not want barrel/index.ts export files in this project
type: feedback
---

Do not create barrel files (index.ts re-export files) in this project.

**Why:** User preference — they explicitly asked not to use them.

**How to apply:** Always import directly from the specific module file rather than through an index.ts barrel. When creating new features/modules, skip the index.ts.
