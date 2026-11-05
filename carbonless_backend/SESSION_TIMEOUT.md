# Session timeout: what is enforced, what is not

A signed-in session ends after **30 minutes without meaningful user activity** (`SESSION_IDLE_TIMEOUT_SECONDS`, default
1800; the browser's constant `IDLE_MS` in `src/lib/session/idle.js` must match). There is no absolute lifetime: a user who
keeps working stays signed in. Signing out or being timed out deletes no data.

Code: `accounts/session.py`, `accounts/authentication.py`, `accounts/views.py` (`CookieTokenRefreshView`, logout),
`src/lib/utils/api.js`, `src/components/SessionIdleGuard.jsx`, `src/app/api/auth/{refresh,logout}/route.js`.
Tests: `accounts/test_session_idle.py`, `scripts/test-session-idle.mjs`, `scripts/test-auth-routes.mjs`,
`tests/smoke/session-idle.spec.js`.

## How it works

* Every token carries an `act` claim: the time of the user's last activity as the server last learned of it. Login stamps
  `act = now`. The claim is signed with the token; a client cannot edit it.
* **Every authenticated request** refuses an access token whose `act` is more than 30 minutes old (`session_expired`).
* **A refresh** of an idle session is refused and its refresh token is blacklisted. Refreshing cannot revive an idle session.
* A refresh moves `act` forward **only** when it carries `X-User-Activity: <seconds since the user's last activity>`
  (0–1800). Any other refresh (the automatic one after an expired access token) keeps the old `act`.
  The new `act` is `max(old act, now − reported age)` and never later than now.
* The browser tracks presses, taps and key presses (not mouse movement, scrolling, focus, timers, polling or automatic
  refreshes) in localStorage, shared by every open tab. It tells the server at most every 2 minutes while the user works,
  and once after a pause, and only when it has more than a minute of news.

## What `X-User-Activity` is, and is not

It is a **signal reported by the browser. It is not cryptographic proof that a person acted.** The server cannot see clicks;
it can only enforce the 30-minute bound on what it is told.

What the architecture does guarantee (each verified against the running app, see the integration results):

* A refresh token (stolen or not) that is **not used** dies 30 minutes after the user's last reported activity.
* A refresh token used only **automatically** (no activity header, which is what any background refresh looks like) cannot
  keep a session alive: it dies at 30 minutes.
* The header cannot be sent to the backend by a web page of another site: it is not an allowed CORS header, and a
  cross-site request to the Next.js proxy carries no refresh cookie (`SameSite=Strict`) and cannot add a custom header
  without a preflight the proxy does not answer.
* `act` cannot be forged by editing a token (signature).

What it does **not** guarantee:

* **Anyone who holds a refresh token can keep it alive indefinitely by fabricating the header** on each refresh
  (a refresh at least every 30 minutes with `X-User-Activity: 0`). This was demonstrated against the real backend and is
  **not eliminated**. Refresh-token rotation does not prevent it: a thief who keeps rotating simply holds the current token.
  If the thief and the user both use the same token chain, one of them gets a refused refresh (the user is signed out and
  must sign in again); that is a visible symptom, not a detection or a revocation.
* The 30-minute rule protects against a forgotten or abandoned session and against a token that is stolen and then not
  used promptly. It is not a defence against an attacker who is actively using a stolen refresh token.

## One old token starts exactly one new chain

A refresh token is consumed by creating its row in the blacklist table, which is unique in the database
(`BlacklistedToken.token` is one-to-one), **before** anything new is issued. Of any number of simultaneous requests that
present the same token, across threads, processes and gunicorn workers, exactly one creates that row and receives new tokens;
every other request gets a definite `401`. The claim is a single autocommit write, so it needs no Python lock and does not
depend on the replay cache. This also closes a race in stock SimpleJWT (several simultaneous refreshes of one token each
got a live successor; measured with 8 simultaneous requests: 6 to 8 live tokens before, exactly 1 now).
Tests: `accounts/test_refresh_concurrency.py` (real threads, own connections, real SQLite file; also run in CI).

## Retry after a lost refresh answer

A refresh rotates the refresh token (the old one is blacklisted at once). If the answer never reaches the browser the old
token is dead and the user would be signed out for nothing. The browser therefore labels each refresh attempt with a random
id (`X-Refresh-Attempt`, kept in memory only) and repeats the **same** attempt when it got no answer (twice, after 1 s and
3 s; `keepalive` lets the request finish even if the page navigates away). The server remembers, for 60 seconds, only a
hash of (old token id, attempt id) → the id of the token it issued. A repeat that proves **both** the old token and the
attempt id revokes the token the first try issued (it was never acknowledged) and issues a fresh one. It is refused when
that first token has since been used or revoked (so never after a sign-out), after 3 tries in all, when the session is idle,
when the attempt id does not match, and when it arrives less than 0.9 s after the try it repeats (a browser waits a second;
a duplicate that arrives at the same moment is not a retry and loses the race like any other). This delay only separates simultaneous duplicates from retries; a duplicate that reaches the server later (a very slow
server) is treated as a retry. That is still safe: it revokes the first try's token and issues exactly one new one, so there is never
more than one live token, but the first try's answer, if it did arrive, is then void. The revocation of the first
try's token is the same exclusive claim as above, so of simultaneous repeats exactly one succeeds and two live tokens can
never exist. No token is stored, and nothing in the cache is trusted: an entry must have exactly the shape this server wrote,
name an outstanding token of the same user, and belong to a token that was really consumed, or it is ignored. A thief of the cookie alone does not have the attempt id.
The entry lives in a file cache (`session_replay`, shared by the gunicorn workers of one machine; without it a repeat that
lands on another worker falls back to the normal behaviour: the user signs in again).
**The cache is an optimisation that may fail at any time.** Every read and write is guarded: if the cache cannot be read or
written, only the retry for that attempt is lost. The refresh itself (signature, expiry, blacklist, idle rule, rotation) never
depends on it, a cache failure after rotation does not turn the answer into a 500, and a warning naming only the exception
type is logged (no token, key or request data). Tests: `CacheFailureTests` in `accounts/test_session_idle.py`.
A failure to get any answer (network down, 5xx) never signs the user out; only the server's definite refusal does.

## Options reviewed to reduce the risk of a stolen refresh token being kept alive (not implemented)

| Option | What it would buy | Why it is not done |
|---|---|---|
| Revoke the whole token family when an already-rotated token is presented (reuse detection) | The first conflict between thief and user kills the thief's chain | Rotation and sign-out both blacklist; they cannot be told apart without a new column (a migration), so a stale tab after sign-out would revoke live sessions. Needs design and approval. |
| A secret held by the page (not in a cookie) that every refresh must present | A stolen cookie alone becomes useless | Changes login and refresh for everyone; does nothing against theft of the page's own storage (XSS, a compromised device). |
| Bind tokens to IP / device fingerprint | Detects use from elsewhere | Collects tracking data, breaks on mobile networks; excluded by the requirement not to track users. |
| An absolute maximum session length | Bounds the thief's lifetime | Excluded by the requirement that active users are never cut off. |
| Re-authentication (password / 2FA) before sensitive actions | Limits what a hijacked session can do | A separate feature. |

## Sign-out

Manual logout passes the refresh cookie from the Next.js proxy to the backend, which blacklists it. A logout that arrives
with an already-expired access token is refused by the backend (it needs a signed-in user); the cookie is still cleared, and
the idle rule refuses that token anyway.
