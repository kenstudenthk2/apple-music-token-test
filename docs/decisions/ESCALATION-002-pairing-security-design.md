# ESCALATION-002: How should the pairing flow be secured?

- **GATE**: G2 — Security Hardening
- **CLASS**: Auth / login (charter §4.5) — **human decision, not a vote**
- **STATUS**: awaiting the project owner. No code will be written until this is answered.
- **RAISED BY**: the agent team, after G1 passed made this the critical path.

## The problem, concretely

Today, `GET /api/session/:code` returns the Music User Token to anybody who
presents the 4-character code. There is nothing else to present.

```
GET /api/session/TV-8X29   ->   { "status": "authorized", "musicUserToken": "..." }
```

| Property | Value today |
|---|---|
| Code space | 32 alphabet × 4 characters ≈ **1.05 million** |
| Rate limiting | **none** |
| Session lifetime | 10 minutes |
| Code reuse | unlimited reads |

An attacker who can send requests to the server can enumerate live codes. At a
modest 500 requests/second, a full sweep of the space takes about 35 minutes,
and any code that is live during the sweep yields a stranger's Music User Token —
which is read/write access to their Apple Music library.

This was an acceptable risk while the whole direction was unproven. G1 passing
changed that: we are now building on this flow.

## The cause

The design conflates two things that need different properties:

| Purpose | Needs to be | Is currently |
|---|---|---|
| A code a human reads off a TV and types into a phone | short, unambiguous, low-entropy by necessity | `TV-8X29` |
| A credential that retrieves the token | long, secret, high-entropy | **the same `TV-8X29`** |

One string cannot be both. That is the whole bug.

## Options

| | Option | What it means | Cost |
|---|---|---|---|
| **A** | **Split the two roles (RFC 8628 device-flow shape)** — the server issues a short `user_code` for the human *and* a long secret `device_code` for the TV. Only the `device_code` can retrieve the token; the `user_code` can never return one. Plus rate limiting, 5-minute expiry, single-use. | Adopts the design the OAuth device-authorization grant already standardised for exactly this problem. Nothing is invented. | Moderate — changes `pairing-server.js`, `tv-client.js`, `activate.html` |
| **B** | **Keep one code, make it long** — e.g. 12 characters, plus rate limiting and expiry. | Simpler diff, but the user must now read and type a 12-character code off a television. The QR still works; anyone who cannot scan suffers. | Low |
| **C** | **Rate limiting and expiry only**, leave the code as-is. | Cheapest. Raises the cost of enumeration but does not remove it — a patient attacker still wins, and the token is still retrievable by code alone. | Very low |

## Recommendation

**A.**

- It is the only option that actually removes the vulnerability rather than
  making it slower. Under A, knowing `TV-8X29` grants nothing at all.
- It keeps the human-facing code short, which the 10-foot UI needs — the design
  system sizes that code as the largest text in the entire app.
- It is a solved problem with a published spec, so we are not inventing security.
- The cost lands now, while there are three call sites. After the real TV app is
  built there will be more.

Under A the four G2 PASS criteria are all met directly:

| Criterion | How A satisfies it |
|---|---|
| Code alone returns 401, no token | `user_code` has no token-retrieval endpoint at all |
| Device secret ≥32 bytes CSPRNG, TLS only, never logged | `device_code` = 32 bytes from `crypto.randomBytes`, logged never, only the `user_code` appears in logs |
| >5 attempts/IP/60 s → 429 | Per-IP token bucket on both lookup and poll |
| Sessions ≤300 s, codes single-use | TTL cut 600 s → 300 s; session deleted the moment the TV collects the token |

## What I need from you

Pick A, B, or C. If A, I will write the proposal for exactly which endpoints
change and get your approval on that before touching `pairing-server.js` — per
charter rule 5, auth code does not get written on a one-word yes.

Two things worth knowing before you choose:

1. **This is not urgent in the sense of "we are under attack".** Nothing is
   exposed right now — the tunnel is closed and the server is local-only. It is
   urgent in the sense that it gets more expensive every week we build on it.
2. **Option A changes the phone page.** `activate.html` is the auth surface; its
   change would be small (it already only ever sees the `user_code`), but it is
   a change, and you should expect to re-test the pairing flow after it.

## Answer

_Awaiting the project owner._
