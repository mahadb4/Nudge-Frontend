# Nudge frontend: security and input validation

Everything the browser checks here is **only for quick, clear feedback**. Anyone can skip it with DevTools, a script or `curl`. The Django REST API must check everything again (part 2).

Run the checks: `npm run typecheck`, `npm run test` (unit), `npm run test:e2e` (browser, against the production build with the real CSP), `npm run audit`.

---

## 1. What the frontend validates, and how

All rules live in [`src/data/validate.ts`](src/data/validate.ts). Forms import from it, so no form has its own looser rule. Limits are in `LIMITS`.

**Normalisation (every text field):** control characters, null bytes, zero-width and bidi-override characters are stripped (`clean`, `cleanMulti`); single-line text collapses whitespace and is trimmed; emails are trimmed and lowercased (`normEmail`) when you leave the field and again on submit. **Passwords are never trimmed, lowercased, logged or stored.** Duplicate checks (contacts, companies, templates, facts, stages, invites) ignore case.

| Field | Required | Rules | Message example |
|---|---|---|---|
| Work email (sign in, sign up, reset, contact, invite, compose) | yes | max 254, local part max 64, one regex for the whole app, no `..`, no leading or trailing dot, domain labels 1 to 63, TLD letters only, no spaces or newlines | "Enter a valid email address, like name@company.com." |
| Password (sign up, new password, change) | yes | 8 to 128 characters, upper and lower case, a number, no control characters, not a common password, must not contain the email name or a name word of 4+ letters, must differ from the current one. `autocomplete` is `new-password` or `current-password` | "Mix upper and lower case letters." |
| Password (sign in) | yes | present, max 128 (no composition rules, so old passwords still work) | "Enter your password." |
| Verification code | yes | exactly 6 digits, paste keeps digits only, 5 tries then locked, `autocomplete="one-time-code"` | "That code is not valid or has expired." |
| Full name (sign up, contact, profile) | yes | 2 to 80 characters, needs a letter, no `<` or `>`, not digits-only. Real names pass: O'Brien, José, Anne-Marie, 李雷, محمد | "Use letters in the name." |
| Company, company name | yes (business) | 2 to 120, no `<` `>`, unique (companies) | "A company with this name already exists." |
| Contact title, industry | no | max 80 | "Keep the title under 80 characters." |
| Phone | no | 7 to 15 digits, optional leading `+`, spaces, dashes and brackets allowed | "Enter a valid phone number, 7 to 15 digits." |
| Domain | no | host name only (`acme.com`): no scheme, path or spaces, labels 1 to 63, max 253. `javascript:` and `http://` are refused | "Use a domain like acme.com." |
| URL (helper, not yet on a form) | n/a | `safeHref`: http, https, mailto only, no credentials, no whitespace, max 2048 | "Use a web address that starts with http:// or https://." |
| Deal name | yes | 2 to 80, no `<` `>` | "The deal name is too short." |
| Amount | yes | digits with up to 2 decimals, above 0, below 1,000,000,000,000. `1e5`, `-1`, `0`, `NaN`, `Infinity`, 3 decimals refused. Commas are removed | "Numbers only, like 25000." |
| Expected close date | no | a real calendar date, not in the past (add), before 2100 | "Pick today or a later date." |
| Deal note | no | max 1,000 | "Keep the note under 1000 characters." |
| Compose: subject | yes | 2 to 200, one line (the browser strips line breaks) | "Keep the subject under 200 characters." |
| Compose message, follow-up draft | yes | 5 to 5,000, line breaks kept | "Enter the message." |
| Review draft (approve) | yes | not empty, max 5,000. The store refuses to approve otherwise, and refuses a contact who is opted out or suspended, or a review that is not pending | "The draft is empty." |
| Compose: recipient | yes | email rules above; opted-out or suspended contacts are refused in any letter case | "This person opted out. Nudge will not send." |
| Reject reason | yes | must be one of the listed reasons; note optional, max 1,000 | "Pick a reason first" |
| Template name | yes | 2 to 80, unique ignoring case | "A template with this name already exists." |
| Template body | yes | 5 to 5,000 | "Write a little more for the template body." |
| Approved fact name, text | yes | name 2 to 60 and unique; text 5 to 200 | "A fact with this name already exists." |
| Deal stage name | yes | 1 to 40, unique, no `<` `>`, at most 12 stages | "Another stage has this name." |
| Workspace name | yes | 2 to 120 | "The workspace name is too short." |
| Invite role | yes | a list: Member or Admin | n/a |
| Confidence bar | yes | whole number 60 to 99, clamped in the store | n/a |
| Search boxes, command palette | no | max 100, `autocomplete="off"` | n/a |
| Ask Nudge chat | no | max 500 | n/a |
| CSV import | yes | `.csv` name and a CSV MIME type, max 1 MB, max 1,000 rows, strict UTF-8 (BOM ignored, bad bytes refused), header must start with Name,Email, quoted commas parsed, each row checked (name, email, duplicate, title length). Names starting `= + - @ tab CR` are skipped; titles have a leading formula character removed | "The first two columns must be Name and Email." |
| CSV export | n/a | every text cell starting `= + - @ tab CR` is prefixed with `'`; numbers stay numbers | n/a |
| `:id` route params | n/a | `idOk`: letters, digits, `_` and `-`, max 64, else the not-found state. Never echoed | "Page not found" |
| `:step`, `:tab` | n/a | step must be 1 to 5, tab must be on the list, else redirect | n/a |
| `?token=` (reset link) | yes | 4 to 200 word characters, read once then removed from the address bar | "This link is not valid" |
| Redirect after sign-in | n/a | `safeInternalPath`: starts with a single `/`, only `/app/` or `/onboarding/`, no `//`, `..` or `\`, max 300 | falls back to `/app/home` |

**Other checks in the UI:** errors show on blur and on submit; submit buttons are disabled while a request runs (`useSubmit`); login and reset use the same wording for every address ("That email and password do not match.", "If an account exists for … a link is on its way."); a verification code and a reset link are single-use in the mock API; the sign-in, verify and reset forms lock for a short time after 5 failed tries.

**Rendering:** all email bodies, drafts, notes, names and subjects are rendered as React text nodes. There is no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write` or `window.open` anywhere in `src/`. The evidence highlight is chosen by paragraph index, so email text cannot add markup. There are no `target="_blank"` links.

### Browser storage

| Where | Key | Holds |
|---|---|---|
| `localStorage` | `nudge.theme` | `light`, `dark` or `system`. Validated on read. |
| `sessionStorage` | `nudge.demo` | `1` while the **mock** demo user is signed in, so a reload does not sign them out. Not written in real-API mode. |

No password, code, token, email or personal record is stored. In real-API mode the session is an httpOnly cookie that the page cannot read. Signing out, or any 401, wipes the in-memory store (`clearWorkspace`).

### Headers and CSP

`vite build` adds a CSP `<meta>` tag, and `vite preview` sends the full header set (see `vite.config.ts`). **Set the same on the production host or CDN:**

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://API_ORIGIN; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin
Cache-Control: no-store            (for index.html and API responses; hashed assets can be cached for a year)
```

`frame-ancestors` only works as a header, not in the meta tag. The e2e suite checks the policy is enforced with zero violations on every route. Source maps are off (`build.sourcemap: false`). Only `VITE_API_URL` (a public address) is read from the environment; see `.env.example`.

---

## 2. What the Django REST API MUST enforce again

Treat every request as hostile. The frontend rules above are a courtesy to honest users.

1. **All validation, server-side.** Every rule in the table: types, required fields, lengths, allowed characters, email format and lowercase, unique constraints (case-insensitive), amount range and decimals, dates, enum values (stage, role, currency, reply type, reject reason), and ids. Use DRF serializers with explicit `max_length`, validators and `Decimal` fields. Reject unknown fields. Never trust a field the client says it computed (confidence, stage, owner, workspace id, role).
2. **Rate limiting and lockouts** on login, verify-code, resend-code, password reset request, reset confirm and change-password. Limit by account **and** by IP, with exponential back-off, and answer `429` with `Retry-After`. The 5-try lock in the UI is only a hint.
3. **No account enumeration.** Same status, body and timing for a known and unknown email on login, reset and sign-up. Send "someone tried to register" email to existing owners instead of an error.
4. **CSRF protection for cookie sessions.** `SessionAuthentication` with CSRF enforced on every unsafe method, `CSRF_COOKIE_SAMESITE`, `CSRF_TRUSTED_ORIGINS` set to the frontend origin only, and `X-CSRFToken` required (the client already sends it). Session cookie: `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`.
5. **CORS** limited to the exact frontend origin with credentials; never `*`.
6. **Password storage:** Argon2id (or PBKDF2/bcrypt at high cost) via Django's hashers; enforce `AUTH_PASSWORD_VALIDATORS` (length, common, similarity); never log or return passwords; check against a breached-password list; rotate sessions on password change and sign out other devices.
7. **Session or JWT lifetime and rotation.** Short access lifetime, rotating single-use refresh tokens with reuse detection, server-side revocation on sign out and password change, absolute and idle timeouts. "Keep me signed in 30 days" is a longer cookie lifetime chosen by the server, not by the client.
8. **Verification codes and reset links:** random, at least 6 digits (codes) or 128 bits (links), stored hashed, expire (10 minutes, 1 hour), single-use, bound to the account, invalidated when a new one is issued, and attempt-limited.
9. **Authorisation on every object.** Every query is filtered by the caller's workspace and role. A user must never read, change or delete another workspace's deals, contacts, companies, threads, templates, facts, mailboxes, members or audit rows, even with a guessed id. Return `404`, not `403`, for other workspaces' ids. Enforce the role table (Owner, Admin, Manager, Member) and "Act when sure" being locked until 50 approvals **on the server**.
10. **Opt-out and suppression on send.** Before any email is sent, the server checks the recipient (case-insensitive, after normalisation) against the opt-out and suspended lists and refuses. Draft-only mode, approval, undo window, quiet hours and the approved-facts rule must be enforced by the server, never by the UI.
11. **Facts rule:** a draft may only use approved facts; the server validates and strips anything else.
12. **File uploads (CSV and any future file):** check size, row count, extension **and** content (magic bytes or a real parse), decode strict UTF-8, strip control characters, reject formula-leading cells on import as well as export, run in a background job with a timeout, never serve uploads from the app origin, store outside the web root with random names, and virus-scan attachments if they are ever added.
13. **Output safety.** Return JSON with the right `Content-Type`; sanitise any HTML email on the server (allow-list, e.g. `nh3` or `bleach`) before it is ever offered to the client, and keep the client rendering it as plain text unless a sanitiser such as DOMPurify is added.
14. **Audit log** that nobody can edit: actor, action, object, time, IP and user agent for sign-in, failed sign-in, password change, approval, rejection, send, undo, role change, fact change, export and import. Append-only table, no update or delete from the API.
15. **Transport and headers:** HTTPS only, HSTS, secure cookies, the headers in part 1 on the API as well, `DEBUG=False`, no stack traces in responses, generic error bodies, request-size limits, and logging that never records passwords, codes, tokens or email bodies.
16. **Dependencies and secrets:** secrets only in the server environment, rotated; `pip audit` and Dependabot in CI.

---

## 3. What could not be fixed here, and why

| Item | Why |
|---|---|
| **Real authentication, sessions, 401/403/429 and CSRF are untested against a server.** | There is no backend yet. The client in `src/api/` is written for httpOnly cookies and is unit-tested with a mocked `fetch`. Mock mode (`VITE_API_URL` empty) imitates the server rules. |
| **Rate limits and lockouts are not real.** | They cannot be: a browser cannot enforce them. The mock API and the form locks only show the behaviour. |
| **The mock demo flag lives in `sessionStorage` (`nudge.demo`).** | It keeps the demo signed in across a reload. It is not a secret, and it disappears in real-API mode. |
| **`node_modules/` (1,173 files) and `dist/` (15 files) are tracked by git.** | Changing git was not allowed in this task. Run the commands at the end of the report. |
| **Security headers are only sent by the Vite dev and preview servers.** | They must be set on the production host, CDN or reverse proxy (part 1). The CSP meta tag already ships in `index.html`, but `frame-ancestors` and HSTS only work as headers. |
| **Email addresses with non-ASCII letters (`user@münchen.de`, `josé@x.com`) are refused.** | One strict ASCII rule keeps frontend and API identical. Internationalised domains must be sent as punycode. Relax this together with the API if needed. |
| **Look-alike (homoglyph) names and domains are not detected.** | Needs a server-side confusables check. |
| **Double-submit protection covers the forms that will call the API first** (sign in, sign up, verify, reset, new password, change password). | The modal forms (add deal, contact, company, template, fact, invite, compose) run instant mock actions. Wrap each in `useSubmit` when it becomes an API call. |
| **Pasted text in multi-line fields is not sanitised for display.** | It does not need to be: it is rendered as text. It is cleaned (control and invisible characters removed) when it is saved. |
| **The Playwright tests need Google Chrome installed.** | They use `channel: 'chrome'` to avoid downloading a browser. |
| **`eval` cannot be proven blocked by a Playwright test.** | Playwright runs code through the debugger, which bypasses CSP. The header has no `unsafe-eval`, and an injected inline script and inline handler are shown to be blocked. |
