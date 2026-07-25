## Prompt (REV 3 – “Open-Source Emphasis”)

> **Context**: The Modular IoT landing page is live and already follows the REV 2 spec.
> **Goal**: Highlight Modular IoT as an open-source project by adding a GitHub call-to-action in the header and light touches elsewhere—without re-architecting the whole site.

---

### 1 · Scope of work

1. **Header / Top Nav**

   - Insert a right-aligned `GitHub` button (Flowbite **Button** with `outline` style).
   - Label: `Star us on GitHub` ＋ `FiGithub` icon (Flowbite-icons).
   - Link target: `https://github.com/microboxlabs/modular-iot` (env var `NEXT_PUBLIC_GITHUB_REPO`).

2. **Hero tweaks (optional but recommended)**

   - Under the sub-line, render a small badge: `Open Source · Apache-2.0`.
   - For desktop, place the badge inline with CTAs; on mobile, stack.

3. **Footer**

   - Add a `Contribute` bullet linking to `/CONTRIBUTING.md` in the repo.

4. **SEO / OpenGraph**

   - Update `<meta name="description">` to start with “Modular IoT is an **open-source** real-time monitoring platform…”.

---

### 2 · Implementation details

| Item            | Spec                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Component**   | Create `/components/GitHubButton.tsx` exporting a Flowbite Button with props `href`, `className`, `children`.      |
| **Placement**   | In `/app/layout.tsx` (or `Header.tsx` if split), add `<GitHubButton className="ml-auto hidden md:inline-flex" />`. |
| **Mobile Menu** | Ensure the GitHub link appears inside the hamburger menu for `md:hidden`.                                          |
| **Theming**     | Use palette: `border-blue-500 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900`.                              |
| **Analytics**   | Track clicks via `data-analytics="github-star-btn"`.                                                               |

---

### 3 · Deliverables

1. **Code**

   - Header update, GitHubButton component, hero badge snippet, footer link.
   - No other files changed unless lint demands it.

2. **PR description**

   - Title: `feat(header): add GitHub button & OSS badges`.
   - Checklist: lint ✅ build ✅ Lighthouse ≥ 95 ✅.

3. **Screenshot(s)** in the PR body: desktop + mobile header.

---

### 4 · Acceptance criteria

- GitHub button visible on ≥ 768 px, accessible via mobile menu below.
- Lighthouse, a11y & contrast still pass.
- Badge doesn’t push hero CTA below fold on 1366×768.

---

### 5 · Suggestions for future OSS polish (**_out-of-scope for this task, pick up later if desired_**)

| Area               | Idea                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Feature Trio Tabs  | Add a **“Why open source?”** mini-tab with governance & extensibility bullet list.       |
| Live Demo Carousel | Replace one GIF with a quick glimpse of a GitHub Action CI run.                          |
| Pricing Teaser     | Prepend _“Self-hosted OSS = \$0 licensing”_ note above the table.                        |
| Blog / Docs        | Auto-embed GitHub star + fork badges via shields.io in the `/docs` route when it exists. |

---

**Begin implementation now.** Continue using commit prefix `feat(header):` and submit a PR when ready.
