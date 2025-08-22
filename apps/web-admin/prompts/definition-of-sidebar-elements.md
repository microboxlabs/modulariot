## Prompt: Refactor legacy SideBar into GroupedPanelView + PanelItem (apps/web-admin)

> You are an autonomous front-end engineer.
> Your task is to migrate and refactor a legacy component into a reusable abstraction for the new monorepo. Follow the spec below and pause after posting the plan in a GitHub issue for approval before coding.

---

### 1. Context & goal

- **Legacy source**: `/Users/korutx/Documents/microboxlabs/projects/mintral/flowbite/coordinador-webclient`
- **Target project**: `apps/web-admin` (this monorepo)
- **Objective**: Refactor the legacy `SideBar` pattern (button group + panel content) into two reusable components: `GroupedPanelView` (container) and `PanelItem` (child). Maintain feature parity for Monitoring, Symptoms, and Download content.

---

### 2. Tech & tooling

1. **Framework**: Next.js (App Router) under `apps/web-admin`
2. **Language**: TypeScript, ESLint + Prettier (respect project rules)
3. **UI kit**: Flowbite React (use `Button.Group` for actions)
4. **Styling**: Tailwind CSS; preserve dark-mode classes and transitions used by legacy
5. **CI**: `npm run lint` and `npm run build` must pass in `apps/web-admin`

---

### 3. Component architecture

- **GroupedPanelView** (container)
  - Purpose: Render a grouped set of action buttons (tabs) and a content panel area for the active child.
  - Suggested props:
    - `children: React.ReactNode` (expects `PanelItem` children)
    - `defaultIndex?: number`
    - `onChange?: (index: number) => void` (controlled mode support)
    - `className?: string`
    - `actionsClassName?: string` (wraps `Button.Group`)
    - `panelClassName?: string` (wraps content area)
    - `resolveText?: (key: string) => string` (i18n resolver; fallback to raw text)
  - Behavior:
    - Build actions from child `PanelItem` props and manage `activeIndex` state.
    - Keyboard navigation (Left/Right or Up/Down) between actions.
    - Accessibility: `role="tablist"` for actions, each action `role="tab"` with `aria-selected` and `aria-controls`; panel has `role="tabpanel"` with `aria-labelledby`.
    - Styling: use Flowbite `Button.Group`; preserve overflow scroll in content.

- **PanelItem** (child)
  - Purpose: Declarative content panel; does not render by itself outside of `GroupedPanelView`.
  - Suggested props:
    - `actionText: string` (i18n key or label shown in the action button)
    - `selectedPanelTitle?: string` (i18n key or label for panel title)
    - `disabled?: boolean`
    - `children: React.ReactNode` (panel content)

---

### 4. Component placement & packaging

- Place generic, reusable UI primitives in the shared package: `packages/ui`.
  - Add new components under:
    - `packages/ui/src/grouped-panel/GroupedPanelView.tsx`
    - `packages/ui/src/grouped-panel/PanelItem.tsx`
  - Re-export from `@modulariot/ui` entrypoints for consumer apps.
- Keep app-specific wrappers and data-bound content in `apps/web-admin`:
  - `SideBar` wrapper (handles open/close toggle, layout, MapButton integration).
  - Feature panels: `Monitoring`, `Symptoms`, `Download`.
- Rationale: `GroupedPanelView`/`PanelItem` are generic tab-like primitives, while `SideBar` and its children are domain-specific.

---

### 5. Desired usage

```tsx
<GroupedPanelView resolveText={t}>
  <PanelItem actionText="page.monitoring" selectedPanelTitle="page.monitoring">
    <Monitoring dict={dict} mapPositionsResume={mapPositionsResume} />
  </PanelItem>
  <PanelItem actionText="page.symptoms" selectedPanelTitle="page.symptoms">
    <Symptoms dict={dict} />
  </PanelItem>
  <PanelItem actionText="page.download" selectedPanelTitle="page.download">
    <Download dict={dict} mapPositions={mapPositions} />
  </PanelItem>
</GroupedPanelView>
```

Behavior: each `PanelItem` produces one action inside Flowbite `Button.Group` and renders its `children` when active.

---

### 6. Migration scope

- Create reusable UI components under shared package:
  - `packages/ui/src/grouped-panel/GroupedPanelView.tsx`
  - `packages/ui/src/grouped-panel/PanelItem.tsx`
- Integrate in a new `SideBar` wrapper in `apps/web-admin` that preserves the legacy open/close toggle (e.g., `MapButton` + chevron) and replaces the inner button group + panel with `GroupedPanelView` and `PanelItem`s.
- Wire `dict`, `mapPositionsResume`, and `mapPositions` into the new composition as in legacy.

---

### 7. Acceptance criteria

- Visual/behavioral parity with legacy `SideBar` (button states, transitions, scroll behavior, dark mode)
- Keyboard accessible with proper ARIA roles/attributes
- Type-safe props (no `any`), controlled/uncontrolled selection supported
- `apps/web-admin` lints and builds successfully

---

### 8. Tests & examples

- Unit tests: action rendering from children; selection switching; a11y attributes; disabled items
- Minimal story/demo to preview `GroupedPanelView` with 2–3 `PanelItem`s

---

### 9. Risks & mitigations

- i18n key mismatches → provide `resolveText` and fallback to raw text
- Styling drift vs. Flowbite defaults → expose `className` overrides and adjust Tailwind classes to match legacy

---

### 10. Execution steps

1. Draft a short plan (based on this prompt) and open a GitHub issue in `microboxlabs/modulariot` titled:
   - "Refactor legacy SideBar into GroupedPanelView + PanelItem abstraction (apps/web-admin)"
2. Post the detailed plan as the first issue comment and wait for approval.
3. Implement components in `packages/ui` and the app wrapper in `apps/web-admin` on a feature branch; include tests and demo.
4. Open a PR against `trunk`; ensure CI green; request review.

---

### 11. Notes

- Keep the API minimal and declarative. Avoid leaking Flowbite specifics outside of `GroupedPanelView`.
- Preserve all current i18n strings and behavior from legacy; do not regress UX.
