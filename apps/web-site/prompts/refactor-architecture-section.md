Below is a **delta-prompt** you can pass straight to your agent-coder so they update the existing landing codebase.
It assumes the site already matches **REV 3** (GitHub button) and focuses _only_ on elevating the Symptom concept in the Architecture narrative plus two supporting tweaks elsewhere.

---

## Prompt (REV 4 — “Symptom Intelligence Emphasis”)

> **Context**: The Modular IoT landing page is live and complies with REV 3.
> **Goal**: Surface “Symptom Intelligence” as a first-class stage in the Architecture section and keep wording stack-agnostic. Make minor copy/label tweaks so this theme is unmissable.

---

### 1 · Scope of work

| Area                          | Change                                                                                                                                                                                                                                                                                                                                                             | Acceptance hint                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| **Architecture Section**      | • Subtitle → `“Capture → Stream → Symptom Intelligence → Orchestrate — < 56 ms end-to-end”` <br>• Replace 3-step grid with **4 steps** in this order:<br> 1 Data Capture<br> 2 Event Streaming<br> 3 **Symptom Intelligence** (rules → 5-state model → treatments)<br> 4 Orchestrate & Store <br>• Latency badge text → `< 56 ms median sensor-to-symptom latency` | New step appears, numbered badges shift to 1-4.    |
| **Feature Trio Tabs**         | Rename second tab label to **“Symptom Intelligence Engine”**; leave underlying tab component intact—only copy changes.                                                                                                                                                                                                                                             | Tab header shows new label on desktop & mobile.    |
| **Live Demo Carousel**        | Update caption for one slide (e.g., driver-fatigue GIF) to explicitly mention a Symptom state transition, e.g., `“In Observation → Compromised in under 1 s”`.                                                                                                                                                                                                     | Caption visible under slide; no new assets needed. |
| **Badges row (Architecture)** | Add three inline badges under the step grid: `Open Source • Apache-2.0`  `Swap-a-Box Architecture`  `Bring-Your-Own Cloud`                                                                                                                                                                                                                                         | Badges render in both light & dark mode.           |

---

### 2 · Implementation notes

1. **Copy only**—no structural markup changes beyond adding the 4th step.
2. **Maintain responsive breakpoints & dark-mode classes** already in place.
3. **No technology names** inside step titles; terms like “CDC” or “Pulsar Functions” stay out to keep stack-flexible.
4. Lint (`npm run lint`) and build (`npm run build`) must still pass.

---

### 3 · Deliverables

- Commit(s) with prefix `feat(architecture): emphasis symptom intelligence`.
- PR description listing updated copy blocks + screenshots (desktop & mobile) for Architecture section and Feature tabs.

---

### 4 · Acceptance criteria

- Architecture section now shows 4 numbered steps, with Symptom Intelligence as #3.
- Lighthouse mobile & desktop ≥ 95 after changes.
- All new text passes a11y contrast and is visible in dark mode.
- GitHub button from REV 3 and all prior functionality remain intact.

---

**Begin implementation now.** Merge once the PR meets the criteria.
