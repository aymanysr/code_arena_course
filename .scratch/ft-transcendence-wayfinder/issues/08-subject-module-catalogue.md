Type: research
Status: resolved
Blocked by: none

## Question

Verify Subject v21.2 Chapter IV module catalogue truth vs `docs/architecture_compliance_research.md` §1.2: exact Major=2pts / Minor=1pt mechanics, 14pt mandatory threshold, 5pt bonus cap / 19pt ceiling, and which services actually earn points vs auxiliary (qa-service, media-service, moderation-service, notification-service)?

AFK — resolve via `/research` subagent against primary sources, capture findings on `research/<name>` branch, link from here.

## Answer

- Major=2 / Minor=1 / 2 Minors=1 Major verified (v14.1 Ch.IV p.8: min 7 majors). 14pt mandatory is correct arithmetic translation, not verbatim. 5 bonus cap / 19 ceiling unverified in v14.1 (Ch.V: 5pts/minor, 10pts/major if mandatory perfect, no cap) — appears only in student tallies + baseline; needs Intra v21.2 PDF to close.
- Auxiliary 0pts verified: no Q&A/media/moderation/notification modules. `qa-service` 0 unless shipped as true second distinct game with history+matchmaking.
- Inconsistencies vs agenda: OAuth Major 2 (agenda says Minor 1, -1); 2FA Major 2 (agenda Minor 1, -1); Live chat Major 2 (agenda drops it); Tournament has no Minor (agenda Minor 1 wrong); AI Major 2 omitted from agenda; WebSockets Major / GameEngine Major / Spectator-Gamification-AdvancedChat Minors are phantom (not in v14.1, match newer generation); IV citations wrong (Second Game is not IV.6, Module of Choice is not IV.10 in v14.1); Tournament-service alone ≠ Add Another Game (needs distinct game, e.g. quiz).
- Net: agenda 17 sums arithmetically but scores ~13–14 under v14.1 rules. Recommended v14.1-strict core 14 = Backend 2 + UserMgmt 2 + OAuth 2 + Remote 2 + LiveChat 2 + 2FA 2 + Microservices 2; 19 = + AI 2 + Frontend 1 + DB 1 + Stats 1. GDPR/Custom/Server-Pong/Second-Game are overflow swaps. NestJS/React keep values but need Ch.II justification vs Django/Bootstrap mandate.
