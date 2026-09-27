# Separate service databases on one PostgreSQL instance

Accepted on 2026-09-17. Run one PostgreSQL container with separate databases and credentials for core, game, and chat, balancing service ownership with manageable operations for the one-month delivery target. Each service accesses only its own database and uses another service's API when it needs that service's information.

## Original 2026-09-17 ownership boundary

- Core owns accounts, profiles, friendships, and avatar metadata.
- Game owns matches, teams, roles, puzzle state, penalties, and results.
- Chat owns messages and shared clue cards.

All three services share the database server's availability: an outage affects all of them. References across services are identifiers managed through application logic rather than cross-database foreign keys. Separate PostgreSQL containers were considered for stronger operational isolation but deferred to avoid additional first-release setup.

## Amendment 2026-09-25 (Game-owned match chat)

For the first-release Code Arena runtime, Game owns match-scoped team chat and quick pings. This supersedes the original Chat-owned message boundary for this release. Durable chat records, when implemented, belong in the Game data boundary with matches and collaboration state; the current process-local history in `services/game` is only transport/session evidence. The standalone Chat database configuration and container remain deferred scaffolding, not a dependency of the gameplay chat path.
