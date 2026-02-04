
# Feature Request

## Auth0 Integration with Next.js 16.x + Auth.js (Social Login + Credentials)

### Status

📌 **Planned – Milestone: Authentication Foundation**

---

## Objective

Implement a **production-ready authentication layer** for MIOT using:

* **Next.js 16.x**
* **Auth.js (NextAuth v5)**
* **Auth0 as OIDC Identity Provider**
* **Custom MIOT login page (no Auth0 UI)**
* **Social login buttons (Google, GitHub)**
* **Username + Password (Auth0 Database connection)**

The solution must issue **OIDC-compliant JWTs** that can later be **validated by the Alfresco backend** for secure API access.

---

## Goals & Non-Goals

### Goals

* Use **Auth.js as the session manager** in Next.js
* Use **Auth0 as the identity broker**
* Support:

  * Google login
  * GitHub login
  * Email + password login
* Keep full control of the **login UI**
* Ensure JWTs are **verifiable externally** (Alfresco, Quarkus, etc.)
* Avoid vendor lock-in at the application layer

### Non-Goals

* Authorization / RBAC logic (handled in backend)
* User profile management UI
* MFA (future milestone)
* Organizations / enterprise SSO (future milestone)

---

## High-Level Architecture

```
Browser (MIOT UI)
   |
   | 1. User clicks login button
   v
Next.js 16.x + Auth.js
   |
   | 2. Redirect to Auth0 /authorize
   v
Auth0 (OIDC Broker)
   |
   | 3. Redirect to Google / GitHub / DB
   v
Identity Provider
   |
   | 4. Auth response → Auth0 → callback
   v
Auth.js Callback
   |
   | 5. Session + JWT issued
   v
MIOT Backend / Alfresco (OIDC validation)
```

---

## Functional Requirements

### FR-1 — Authentication Framework

* Use **Auth.js (NextAuth v5)** as the authentication framework.
* Use **JWT strategy** (no database session persistence).
* Sessions must be compatible with:

  * SSR
  * API Routes
  * Edge-safe middleware (future)

---

### FR-2 — Auth0 as OIDC Provider

* Configure Auth0 as an **OIDC provider** in Auth.js.
* Use **Authorization Code Flow with PKCE**.
* Use **Custom Domain (if available)** to avoid `*.auth0.com` exposure.

Auth0 configuration must include:

* Issuer
* Client ID
* Client Secret
* Audience (API identifier for Alfresco / MIOT backend)

---

### FR-3 — Custom Login Page

* MIOT must provide its **own login page**.
* No Auth0 Universal Login UI is used.
* UI must include:

  * “Continue with Google” button
  * “Continue with GitHub” button
  * Email + Password form

Buttons must trigger Auth.js `signIn()` with provider hints.

---

### FR-4 — Google Social Login

* Google login must:

  * Be initiated from MIOT UI
  * Redirect directly to Google (no Auth0 UI step)
  * Return to MIOT callback URL

Implementation detail:

* Auth.js must pass `connection=google-oauth2` to Auth0 `/authorize`.

---

### FR-5 — GitHub Social Login

* GitHub login must:

  * Follow the same redirect-only flow
  * Use `connection=github`
  * Return standard OIDC claims

---

### FR-6 — Email & Password Login

* Use **Auth0 Database Connection**.
* Support:

  * Email + password authentication
  * Standard OIDC claims
* No password handling logic must exist in MIOT backend.
* Credentials must never transit MIOT servers.

---

### FR-7 — Token & Claims Design (Critical)

Tokens issued must be:

* **OIDC compliant**
* Signed with **RS256**
* Verifiable via **JWKS**

Required claims:

```json
{
  "iss": "https://<auth0-domain>/",
  "sub": "auth0|xxxxx",
  "aud": "miot-api",
  "exp": 171xxxx,
  "iat": 171xxxx,
  "email": "user@domain.com",
  "email_verified": true,
  "provider": "google|github|auth0"
}
```

Optional custom claims (namespaced):

```
https://miot.cl/claims/user_id
https://miot.cl/claims/tenant_id
https://miot.cl/claims/roles
```

---

### FR-8 — Backend Compatibility (Alfresco / Quarkus)

The JWT must be verifiable by external backends using:

* JWKS endpoint
* `iss`, `aud`, `sub` validation
* Expiration validation

Backend must **not** depend on Auth.js internals.

This ensures:

* Clean separation between frontend auth & backend security
* Future backend services can reuse the same identity layer

---

## Technical Requirements

### Next.js

* Version: **16.x**
* App Router compatible
* Server Actions safe
* Middleware-ready

### Auth.js

* Version: **v5**
* JWT strategy
* Auth handler in `app/api/auth/[...nextauth]/route.ts`

---

## Security Requirements

* Use PKCE (mandatory)
* No implicit flow
* No password handling in MIOT
* Tokens stored using HttpOnly cookies
* CSRF protection enabled via Auth.js
* Token refresh handled by Auth.js

---

## Configuration & Secrets

Environment variables:

```
AUTH_SECRET=
AUTH_AUTH0_ID=
AUTH_AUTH0_SECRET=
AUTH_AUTH0_ISSUER=
AUTH_AUTH0_AUDIENCE=
NEXTAUTH_URL=
```

---

## Acceptance Criteria

* ✅ User can log in with Google from MIOT UI
* ✅ User can log in with GitHub from MIOT UI
* ✅ User can log in with email + password
* ✅ No Auth0 UI is shown
* ✅ JWT can be validated externally using JWKS
* ✅ Alfresco backend can authenticate requests using OIDC
* ✅ Logout clears session correctly
* ✅ Tokens rotate correctly

---

## Deliverables

* Auth.js configuration
* Auth0 application configuration
* Custom login UI
* JWT claim contract documentation
* Backend validation example (pseudo-code or doc)
* README section: Authentication Architecture

---

## Future Extensions (Out of Scope)

* MFA
* Organizations
* Enterprise SSO
* Step-up authentication
* Role synchronization

---

## Design Principle

> **Auth0 answers “who are you”.
> MIOT answers “what can you do”.**

This feature establishes the **identity foundation** for MIOT without coupling business logic to authentication mechanics.