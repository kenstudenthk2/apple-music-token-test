# ESCALATION-002: How should the pairing flow be secured?

- **GATE**: G2 — Security Hardening
- **CLASS**: Auth / login (charter §4.5) — **human decision, not a vote**
- **DECISION**: ✅ **Option A** — split the two roles, RFC 8628 device-flow shape.
  Chosen by the project owner, 2026-08-19.
- **STATUS**: ⏸ **awaiting a second approval on the endpoint design below**, per
  charter rule 5. No code has been written.

---

## The problem (settled)

One string served as both the short code a human reads off a television and the
credential that retrieves the Music User Token. Those need opposite properties,
so rate limiting alone could only slow enumeration of the ~1.05M code space, not
prevent it. Full analysis and the rejected options B and C are in the git
history of this file.

---

# Part 2 — Endpoint design, for approval

## Summary of the change

`user_code` becomes purely a human-facing lookup handle. It gains a sibling,
`device_code`, which is the only thing that can retrieve a token. **There is no
endpoint anywhere that returns a Music User Token in response to a `user_code`.**

## The endpoints

### 1. TV starts a session

```
POST /api/session
→ 201
{
  "user_code":    "TV-8X29",
  "device_code":  "<43 chars, base64url of 32 random bytes>",
  "activate_url": "https://<host>/activate/TV-8X29",
  "expires_in":   300,
  "interval":     2
}
```

- `device_code` is generated with `crypto.randomBytes(32)` and **returned exactly
  once**, in this response, to the caller.
- The server stores **only `sha256(device_code)`**. The raw value is never
  written to memory beyond the response, never logged, never persisted.
- `expires_in` drops from 600 s to **300 s**.

### 2. TV polls for the token

```
GET /api/session/token
Authorization: Bearer <device_code>
```

| Situation | Response |
|---|---|
| Not yet authorized | `200 { "status": "pending" }` |
| Authorized | `200 { "status": "authorized", "musicUserToken": "..." }` — **then the session is deleted** |
| Unknown or expired `device_code` | `404 { "error": "Unknown or expired session." }` |
| Too many failures from this IP | `429` |
| Missing/malformed header | `401` |

Lookup is by hash-table key on `sha256(device_code)`, so there is no
character-by-character comparison to time.

### 3. Phone submits the token

```
POST /api/activate/TV-8X29
{ "musicUserToken": "..." }
→ 204 No Content
```

- Takes the `user_code`, because that is all the phone has ever had.
- **Returns no body.** It cannot leak a token because it never returns one.
- `404` for an unknown or expired `user_code`; `429` when rate limited.

### 4. Phone loads the page — unchanged

```
GET /activate/TV-8X29   →   the existing authorization page
```

### Removed

```
GET /api/session/:code      ← the vulnerability. Deleted, not deprecated.
POST /api/session/:code/token   ← replaced by POST /api/activate/:user_code
```

## Rate limiting — and one interpretation I want on the record

The charter's G2 criterion says ">5 code-redemption attempts from one IP within
60 s return HTTP 429". Applied literally to every request, that would break the
TV: legitimate polling at `interval: 2` is 30 requests/minute by design.

**I propose counting failures, not requests.** A `404` on either endpoint
increments the bucket; a successful poll of a valid session does not.

- Bucket: **5 failures per IP per 60 s**, then `429` until it drains.
- This is what the criterion is actually protecting against — brute force is
  made of failures — and it leaves honest polling untouched.

If you would rather it be literal, say so and I will cap total requests instead
and raise the poll interval to compensate.

## What else changes

| Property | Before | After |
|---|---|---|
| Session TTL | 600 s | **300 s** |
| Token retrievable | unlimited times by code | **once**, by `device_code`, then session destroyed |
| Logged | `[pairing] TV-8X29 authorized` | unchanged — only ever the `user_code` |
| `device_code` in logs | n/a | **never**, not even truncated |
| `musicUserToken` in logs | never | never |

## How this meets the four G2 criteria

| Criterion | Met by |
|---|---|
| Code alone → 401/404, no token | No token-returning endpoint accepts a `user_code` at all |
| Device secret ≥32 B CSPRNG, TLS only, never logged | `crypto.randomBytes(32)`; stored only as a SHA-256 hash; never logged |
| >5 attempts/IP/60 s → 429 | Failure-counting bucket above |
| ≤300 s expiry, single-use codes | TTL 300 s; session deleted on successful token retrieval |

## Work plan — three tasks, because of the 3-file rule

| # | Files | Contents |
|---|---|---|
| 1 | `pairing-server.test.js` | **Tests first.** One test per G2 criterion, each failing against today's server — that is the evidence the vulnerability was real, not just asserted |
| 2 | `pairing-server.js` | The implementation, until task 1's tests pass |
| 3 | `tv-client.js`, `public/activate.html`, `public/pocb/index.html` | The three callers moved onto the new endpoints |

Task 3 matters: the POC-B harness calls the old endpoints, so it breaks until
updated. Re-running POC-B after this lands is the regression check.

## What I need from you

**Approve, or push back on any line above.** Two specific things worth a look:

1. **The failure-counting interpretation of the rate limit** — a deliberate
   deviation from a literal reading of your charter, flagged rather than done
   quietly.
2. **`activate.html` changes** — it is the auth surface. The change is small (the
   endpoint it POSTs to, and no longer expecting a response body), but you should
   plan to re-test pairing end to end afterwards.

## Answer

_Awaiting the project owner._
