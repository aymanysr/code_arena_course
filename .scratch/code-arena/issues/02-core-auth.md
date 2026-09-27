# 02. Core auth (email/password, signed tokens, validation)

Status: EXTERNAL — owned by other contributor (not game scope)
Owner: auth contributor (teammate). Game work treats auth as an external dependency via `docs/auth-game-contract.md` and must NOT implement this ticket.
Category: foundation
Week 2: yes
Blocked by: 01

## Scope

Core service: secure email/password registration and login (hashed/salted passwords, two-sided input validation), signed login tokens that Game verifies locally for the first-release HTTP and WebSocket paths, expiry/refresh rotation/logout/revocation applying to HTTP and WebSocket traffic, secure HttpOnly cookies with same-site/origin/CSRF protections. The deferred Chat skeleton is not on the first-release gameplay path. 42 OAuth provider setup begins here but ships in week 3 — it must never gate the Arena path.

## Acceptance criteria

- [ ] Register/login/logout/refresh round-trips pass with validation enforced in frontend and backend (boundary and malformed-input tests).
- [ ] Game independently verifies token signatures and authorizes each first-release action; forged/expired/revoked tokens are rejected on HTTP and sockets. The deferred Chat skeleton remains outside the gameplay path.
- [ ] OAuth work is limited to non-blocking setup (provider registration, callback skeleton); email/password play is fully usable without it.
- [ ] Explicit-link rule is specified for week 3 (matching email alone never links).

## Notes

Spec: authentication/storage section. Owner area: Saad. Revocation state lives in Redis (expiring), never as score/submission truth.

## Comments

2026-09-23 (Wave 1 started): recon only, no code yet. `services/core` is a NestJS skeleton (common/core/platform-express + arena-model; no bcrypt/jwt/passport/cookie-parser installed, `src/` = module + health only). First work: hashing/token/cookie deps, register/login/logout/refresh/me per scope, game+chat local verification. OAuth stays non-blocking per scope.

2026-09-23 (Scope correction): this ticket is EXTERNAL — owned by the auth contributor, not game scope. Game implementation must not add register/login/logout/refresh endpoints, hashing, JWT, OAuth, cookies, or auth UI. Game consumes a trusted principal via the narrow contract in `docs/auth-game-contract.md` (test/mock principal fixture for local game development only). Game work is not blocked on this ticket.
