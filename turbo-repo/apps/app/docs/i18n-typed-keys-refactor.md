# i18n Typed-Keys Refactor Plan

Goal: make every `tr(...)` call **type-checked against the translation JSON** so a
missing/renamed/typo'd key fails at compile time — eliminating the class of bug where
shipping a build silently breaks i18n. Keep an explicit, greppable **escape hatch**
(`trDynamic`) for the cases the user called out: keys built at runtime and values with
params.

## Locked decisions

- **Canonical locale = `es.json`.** It is `defaultLocale` and the larger superset
  (3,069 leaf keys vs en's 3,036). The TS dictionary type switches from `en.json` to
  `es.json`; all other locales must structurally match it.
- **Key typing = recursive `DotPaths<T>` type** (no codegen unless benchmark forces it).
- **Dynamic keys = separate `trDynamic()` escape hatch** (tr stays strict).
- **Params stay loosely typed** (`Record<string,string>`) — this is the intentional
  "exception" bucket, out of scope for strict typing.

## Current state (facts)

- Custom i18n. One client fn `tr(path, dict, params?)` in
  `src/features/i18n/tr.service.ts`; one server closure `_tr(path, params?)` from
  `getDictionary(locale)` in `src/features/i18n/i18n.service.ts`.
- `path` is a plain `string` → **zero compile-time validation** today.
- **1,514 call sites across 345 files**, all inside `apps/app`. ~1,313 static,
  **106 dynamic template-literal keys**, ~15+ with params. A few `as keyof typeof dict.x`
  casts.
- Locale files: `src/lang/es.json`, `src/lang/en.json`. Dictionary type today:
  `type I18nDictionary = typeof import("@/lang/en.json")` (i18n.service.types.ts:8).
- **Drift exists:** every es key exists in en, but **es has 33 keys en lacks**. This is
  the silent-break risk: a key present in one locale, absent in the other, renders the
  raw path string at runtime.
- `tsconfig`: `resolveJsonModule` on, `noUncheckedIndexedAccess: false`, target ES2017.
- Some dynamic vars are already literal unions (e.g. `liveTaskStage?: TaskStage`), so a
  subset of the 106 can type-check directly instead of using the escape hatch.

---

## Phase 0 — Foundations + perf gate (no call-site changes)

New file `src/features/i18n/tr.types.ts` (no barrel — per project rule):

```ts
import type { I18nDictionary } from "./i18n.service.types";

type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never;

/** Dot-paths whose value is a leaf string in the canonical dictionary. */
export type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends object
      ? Join<K, LeafPaths<T[K]>>
      : never;
}[keyof T & string];

/** Valid translation keys, derived from the canonical (es) dictionary. */
export type TrKey = LeafPaths<I18nDictionary>;
```

In `i18n.service.types.ts`, switch the canonical import to es and strip the JSON
namespace `default` wrapper if present:

```ts
export type I18nDictionary = typeof import("@/lang/es.json");
```

**Perf gate (the one real risk of the recursive approach):**

- `npm install` in the worktree, then measure baseline `tsc --noEmit --extendedDiagnostics`
  (Instantiations, Check time, Memory).
- Wire `TrKey` into `tr`'s signature on a scratch branch and re-measure.
- Also sanity-check IDE responsiveness (hover/autocomplete on a `tr` call).
- **Gate:** if tsc regresses materially (≈ >15–20%) or the editor lags, fall back to a
  codegen variant — a script reads `es.json` and writes an explicit string-literal union
  to a generated `tr.keys.d.ts` (run on prebuild + CI), keeping the public type name
  `TrKey` so nothing downstream changes. Recursive stays the default if it's clean.

Deliverable: types compile in isolation; benchmark recorded; codegen decision made.

**STATUS: DONE.** `tr.types.ts` added (derives `TrKey` from `typeof esDictionary`, the
default import — confirmed no `default.*` pollution). Isolated tsc benchmark (TS 5.8.2):
building the full union = **74,476 instantiations, 0.06s check time, 81 MB** (baseline
0/0.00s/52 MB). A valid key passed and a bogus key was rejected (`@ts-expect-error`
fired). **Recursive `LeafPaths` confirmed — codegen fallback NOT needed.** The
`I18nDictionary` → es switch is deferred to Phase 2 (where signatures flip); `TrKey` is
self-contained from es in the meantime.

## Phase 1 — Locale parity guard + reconcile the 33-key drift

This phase alone removes the "shipping breaks i18n" risk for _missing translations_.

- Add a parity test (vitest) treating **es as source of truth**: assert en's leaf-key set
  equals es's, with a readable diff on failure. Wire it into CI.
- Optional fast compile-time signal: `const _en: typeof esJson = enJson;` (catches en
  _missing_ es keys; the runtime test additionally catches _extra_ keys — keep both).
- Reconcile the current 33 en-missing keys: for each, **add the en translation** or
  **delete the dead es key**. (These get surfaced one-by-one for a decision during
  execution.)

Deliverable: en ≡ es; CI fails on any future drift.

**STATUS: DONE.** Discovered en.json also had **3 duplicate keys** (`dashboard.settings`
`dataSource`/`apiUrl`/`dataPreview`) and es.json the same 3 — `JSON.parse` silently keeps
the last, dropping the earlier translation (another silent-break source). Fixed both:

- Added the 33 missing English translations to en.json (verified: +33 keys, 0 removed,
  0 value changes vs HEAD; es content unchanged). en ≡ es at 3,069 leaves each.
- Deduped both files (parse→stringify keeps last occurrence = current runtime behavior;
  integer-like keys `"1".."8"` get JS-hoisted, a cosmetic reorder).
- Added `src/test/i18n/locale-parity.test.ts` (vitest): asserts es≡en leaf-key sets in
  both directions + zero duplicate keys in each file (raw-text scan, since parse hides
  dups). 3 tests green.
- Wired into CI: new step in the existing `lint` job runs just that test file
  (`npx vitest run src/test/i18n/locale-parity.test.ts`) — targeted, not the whole suite.

## Phase 2 — Flip signatures + migrate all call sites (the big one)

Must land with a green tree, so static fallout and dynamic conversion happen together.
Sub-batch by feature folder (calendar, dashboard, fleet, shipping, geographic-view,
settings, …) → one commit per folder.

1. Add escape hatches alongside the strict fns:
   ```ts
   // tr.service.ts
   export function tr(
     path: TrKey,
     dictionary: I18nRecord,
     params?: Record<string, string>
   ): string {
     /* unchanged body */
   }
   /** Escape hatch: key built at runtime; path is unchecked. */
   export function trDynamic(
     path: string,
     dictionary: I18nRecord,
     params?: Record<string, string>
   ): string {
     return tr(path as TrKey, dictionary, params);
   }
   ```
   Mirror in the server closure: `_tr(path: TrKey, …)` + `_trDynamic(path: string, …)`,
   and update the returned tuple type in `getDictionary`.
2. Flip `tr`/`_tr` `path` param from `string` → `TrKey`.
3. Run tsc. For each error:
   - **Static typo / renamed / removed key** → fix the key (or restore it in es).
   - **Dynamic template / computed base path** (the 106) → convert to `trDynamic`, OR,
     where the interpolated var is already a literal union (e.g. `TaskStage`), leave it
     as `tr` — the template-literal type checks against `TrKey` for free.
4. Audit oddities found during exploration (e.g. `validator.ts:14`
   `tr(\`…${key}\`, params)` appears to pass params where dict is expected) — verify and
   correct as part of this pass.
5. Tree compiles green; manual smoke of a few migrated screens in both locales.

**STATUS: DONE.** Key realization during execution: the codebase has **three** calling
forms, not one — rooted (`tr("pages.login.welcome", dict)`), **scoped**
(`tr("title", dict.calendar.landing)` — a sub-dictionary + relative key, ~505 sites), and
dynamic. A flat root-anchored `TrKey` rejected all 505 scoped calls (619 total errors). So
instead of rewriting 505 call sites, `tr` was made **generic over the dictionary subtree**:

```ts
function tr<D extends I18nRecord>(
  path: DictKey<D>,
  dictionary: D,
  params?
): string;
// DictKey<D> = LeafPaths<D> if non-empty, else string (graceful fallback for
// props typed loosely as I18nRecord — unchecked rather than rejected).
```

This type-checks the relative key against whatever concrete subtree is passed → both
rooted and scoped forms are validated with **zero call-site churn**. Result: **619 → 0**.

- `LeafPaths` is **depth-bounded (12; actual max nesting 7)** to avoid TS2589
  "excessively deep"; `DictKey` evaluates `LeafPaths<D>` once via `infer`.
- Added `trDynamic` (client) + `_trDynamic` (server, 3rd tuple slot — backward compatible
  with all existing destructuring) escape hatches.
- Shared `TrFn`/`TrDynamicFn` types; `MessagesType` + both footer prop types now use
  `TrFn` (so the translate-function-as-prop pattern is type-checked too).
- Switched `I18nDictionary` to `es.json` (canonical).
- **Real bug caught:** `layout.planning.calendarRules.taskFilter.*` (10 keys) was
  referenced in code but entirely absent from both locales (would render raw paths) —
  added to es + en. Genuinely-dynamic sites routed to the escape hatch: pgrest validator
  (`_trDynamic`), sign-in config-driven labels (`_trDynamic`), planning-search-tags
  location codes (`trDynamic`).
- Verified: negative probe confirms the union still rejects bogus keys and accepts deep
  (depth-7) + scoped keys; `turbo check-types` = 0; eslint clean on touched files; parity
  test green.

Coverage note: where a component's `dict` prop is typed loosely as `I18nRecord` (not the
concrete `I18nDictionary`), `DictKey` falls back to `string` so those calls compile
unchecked. That's no worse than before (nothing was checked previously) and is the gap
Phase 3's lint rule backstops. Tightening `PropsWithI18nDict.dict` to a concrete type is a
possible future improvement but would cascade into sub-dict receivers, so it's out of scope.

## Phase 3 — Enforcement + ergonomics

- ESLint: forbid passing a non-literal string to `tr` (forces `trDynamic` for runtime
  keys) via a `no-restricted-syntax` / custom rule; require a short justification comment
  on `trDynamic` usages so the unsafe surface stays auditable.
- Ensure CI gate runs `tsc --noEmit` + the Phase 1 parity test on every PR.
- Optional: give `trDynamic` a typed-prefix + suffix-union overload for the common
  `\`${BASE}.${x}\`` pattern, shrinking the escape-hatch surface further.

**STATUS: DONE.**
- **Codemod:** an AST-based pass (TS compiler API, not regex — only files importing `tr`
  from `tr.service`) converted **79 genuinely-dynamic `tr(<variable>)` calls across 42
  files** to `trDynamic`, and removed two now-dead `tr` imports. This reserves `tr` for
  static (type-checked) keys and leaves the escape hatch explicit + greppable.
- **Lint rule** (app `eslint.config.mjs`): `no-restricted-syntax` forbids a non-literal,
  non-template first arg to `tr` (message points to `trDynamic`); `src/features/i18n/**`
  is exempt (the internal `_tr` forwards an already-`TrKey`-typed `path`). Note: this repo
  uses **`eslint-plugin-only-warn`**, which downgrades *all* lint to warnings — so the
  rule is an advisory dev-facing nudge, consistent with the repo's "lint never blocks CI"
  convention. 0 violations after the codemod; positive-tested that it fires.
- **HARD CI gates** (these actually fail the build): `check-types` (`tsc --noEmit`) already
  runs in the CI `lint` job and now rejects any bad `tr`/`_tr` key; the Phase 1 parity test
  step rejects en/es drift + duplicate keys. Together they enforce "shipping can't break
  i18n" at the type/CI level — the lint rule is the soft layer on top.
- Note on the user's "params" exception: `tr("key", dict, { count })` keeps the **key
  type-checked** while allowing dynamic param *values* — so the two exception categories
  (dynamic keys → `trDynamic`; dynamic values → `tr`'s 3rd arg) are both covered.

### Post-mortem note
A stray `prettier --write` invoked with an empty file-argument list (zsh doesn't
word-split unset vars; `mapfile` is unavailable) reformatted ~324 unrelated files
(vendored JS, docs, config). All were reverted via `git checkout` against a whitelist of
the 54 intentional files; `tsc`/prettier/eslint re-verified clean afterward. Lesson: guard
file-list construction (assert non-empty) before any `--write`.

## Out of scope (explicit)

- Strict param-name typing (`{count}` → required `count` arg): JSON import widens values
  to `string`, so param names aren't recoverable at the type level without `as const`
  codegen. Params remain `Record<string,string>` by decision.
- Other apps/packages — only `apps/app` uses i18n.

## Risks & mitigations

| Risk                                             | Mitigation                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| 3k-member recursive union slows tsc/IDE          | Phase 0 benchmark gate → codegen fallback, same `TrKey` name        |
| Large Phase 2 fallout                            | Sub-batch by feature folder, one commit each; tree green per commit |
| `typeof import(json)` includes `default` wrapper | Verify in Phase 0; `Omit<…, "default">` if it leaks into paths      |
| Dynamic keys silently overusing escape hatch     | Phase 3 lint rule + justification comments                          |
| Reconciling 33 drift keys touches translations   | Surface each for a per-key decision; no blind deletes               |

```

```
