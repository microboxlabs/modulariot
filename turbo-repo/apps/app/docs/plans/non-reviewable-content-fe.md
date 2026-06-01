# FE: distinguish reviewable vs non-reviewable content

## Background

Backend PR (ecm-coordinator #280) made `mintral:reviewableAspect` **conditional**: only
content whose `mintral:contentType` is in a server-side allowlist gets the aspect (with
`mintral:reviewStatus`). Non-reviewable content has **no** `reviewStatus`.

The FE doesn't yet know the difference, so it has two bugs:
1. Non-reviewable items default `reviewStatus` → `"pending"` and land in the **Review**
   tab showing approve/reject controls.
2. The expanded preview offers review actions for content that can't be reviewed.

**Scope: `turbo-repo/apps/app` only.** The `/app/api/bento/multimedia` route already
requests `aspectNames` from Alfresco; approve/reject writes go straight to Alfresco via
`/app/api/bento/properties`. No `ecm-coordinator`/rest-api change.

## Decisions (locked)

- **Tab rename:** "Approved/Aprobados" → **"Listos / Ready"**. The Listos tab holds
  **approved** reviewable items **and all non-reviewable** items. The **Revisión/Review**
  tab holds reviewable items that are pending or rejected.
- **Reviewable signal:** read `aspectNames` in the FE (no route change). The QName check
  is funneled through **one helper** so the literal lives in a single place. The backend
  allowlist is **not** replicated in the FE.

## Source of truth

An item is reviewable ⇔ `entry.aspectNames` includes `mintral:reviewableAspect`.
- Reviewable + status `approved` → Listos
- Reviewable + status `pending`/`rejected` → Revisión
- Not reviewable → Listos, no review UI

---

## Phase 1 — Reviewability helper + type (foundation)

**Files**
- `…/multimedia-manager.tsx/image.types.ts` — add `aspectNames?: string[]` to
  `AlfrescoFileEntry.entry`.
- New `…/multimedia-manager.tsx/reviewable.ts`:
  ```ts
  export const REVIEWABLE_ASPECT = "mintral:reviewableAspect";
  export function isReviewableEntry(entry: AlfrescoFileEntry): boolean {
    return entry.entry.aspectNames?.includes(REVIEWABLE_ASPECT) ?? false;
  }
  ```
- Verify `/app/api/bento/multimedia/route.ts` passes `aspectNames` through untouched
  (it already includes it in the Alfresco query). Confirm the shape reaches the client.

**Done when:** every item carries `aspectNames`; `isReviewableEntry` available. No UI change yet.

---

## Phase 2 — Tab rename, filtering, counts, empty states

**File:** `…/gallery/file-images.tsx`

- **Filtering** (~476–496): replace `status === "approved"` split with:
  - Listos: `!isReviewableEntry(e) || status === "approved"`
  - Revisión: `isReviewableEntry(e) && status !== "approved"`
- **reviewStatuses load** (~712–762): only assign a status for reviewable items; do not
  let a missing `reviewStatus` imply "pending" for non-reviewable ones (use the helper,
  not the `?? "pending"` default, to decide tab placement).
- **reviewSummary / badge dot:** count only **reviewable** pending/rejected items so the
  amber dot doesn't light up for non-reviewable content.
- **Empty states:** copy for each tab given the new split.
- Optional cleanup: rename the `viewMode` union `"approved" → "ready"` for clarity
  (touches the toggle + a few refs). Cosmetic; keep if cheap.

**i18n:** `src/lang/en.json`, `es.json`
- New key `bento.multimedia.tab_ready` = "Ready" / "Listos" (replace `tab_approved`
  usage; remove/retire the old key if unused).

**Done when:** non-reviewable items appear under **Listos**, never **Revisión**; the dot
reflects only real pending/rejected review work.

---

## Phase 3 — Gate review features in preview + rows

Thread `isReviewable` to the viewer and row components.

- **`viewer/viewer-toolbar.tsx`** (~128–181, 247): when `!isReviewable`, render **none**
  of: approve/reject SplitButton, change-status dropdown, review status badge. Show a
  neutral chip instead (i18n `bento.multimedia.not_reviewable` = "Not subject to
  review" / "No requiere revisión").
- **`viewer/media-inline-viewer.tsx`** (~314–357): hide the observations/review section
  and the commit-review controls when `!isReviewable`.
- **`gallery/media-row.tsx`** (~16, 61–63): for non-reviewable rows, suppress the review
  status badge (keep the `contentType` tag); hide any row-level approve/reject quick
  action. Reviewable rows unchanged.

**Done when:** opening a non-reviewable item shows the content + metadata but **zero**
review actions; reviewable items behave exactly as today.

---

## Phase 4 — Classification ↔ reviewability sync

Changing `mintral:contentType` via `updateBentoCategory` makes the backend add/remove the
aspect. The FE must reflect the flip.

- After `updateBentoCategory` succeeds, call `mutateContents()` (re-fetch node contents
  incl. `aspectNames` + `reviewStatus`) so the item re-evaluates reviewability and moves
  tabs. Verify the current category-change handler already revalidates; add it if not.
- When an item flips **reviewable → non-reviewable**, clear any draft decision/observation
  staged for it (it can no longer be reviewed). When it flips the other way, it appears in
  **Revisión** as `PENDING`.
- Confirm optimistic update paths don't strand an item in the wrong tab pre-revalidation.

**Done when:** changing a document's content type live moves it between Listos/Revisión
and toggles its review controls without a manual refresh.

---

## Phase 5 — QA on dev

Use the `alfresco-js-console` (profile `dev`) to seed a service folder with content of
varied `mintral:contentType` (allowlisted + `OTHER`/`CARGO_MANIFEST`). Verify:
- Allowlisted PENDING → Revisión, with approve/reject in preview.
- `OTHER` → Listos, no review controls; neutral chip shown.
- Approve a reviewable item → moves to Listos, change-status dropdown available.
- Change an `OTHER` item to `PROOF_OF_DELIVERY` in the FE → appears in Revisión as PENDING
  after revalidation; change back → returns to Listos, controls gone.
- Feature flag off globally (backend) → everything non-reviewable → all under Listos, no
  controls. (Document, don't special-case.)

## Notes / risks

- CI gates are `check-types` + tests; lint is advisory (only-warn). Run `check-types`
  after each phase.
- Pure FE; no backend deploy required.
- The one QName literal (`mintral:reviewableAspect`) lives only in `reviewable.ts`.
- `viewMode === "approved"` becomes a misnomer if not renamed — low-risk, optional.
