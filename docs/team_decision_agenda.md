# Campus Puzzle Race — Team Review Agenda

> Historical agenda for the superseded Campus Puzzle Race direction. Do not use its service ownership or gameplay scope as the current Code Arena decision; see `.scratch/code-arena/spec.md` and `docs/adr/`.

## Purpose

Confirm that the Team shares one understanding of the Campus Puzzle Race before production work begins. The current prototypes are review material. They do not demonstrate a working frontend service, backend service, database, or real-time Match.

## Read before the meeting

- `.scratch/campus-puzzle-race/spec.md` — product rules and first-release scope.
- `CONTEXT.md` — shared terms for Match, Lobby, Room, Role, Stage, Submission, Retry cooldown, Hint, and Finish delay.
- `docs/adr/0001-three-service-backend.md` and `docs/adr/0002-separate-databases-shared-postgres.md` — service boundaries.
- `docs/campus-puzzle-race-deck.player.html` — Team review deck.
- `prototype/game-ui/index.html` — numbered player-path prototype.

## Meeting outcome

At the end of the meeting, the Team should have:

1. A shared view of the Player path from Account access to Result and Recovery.
2. A confirmed first-release scope for one Room, three Stages, 2v2 and 3v3 Matches, private Roles, Team chat, and structured clue cards.
3. A confirmed three-service boundary: Core owns accounts and profiles, Game owns Lobbies and Matches, and Chat owns Team messages and shared clue cards.
4. Named owners for the first production tickets and one review deadline.

## Agenda

### 1. Product and player path — 15 minutes

Walk through `00-journey.html` in order. Confirm the meaning of each step:

- Account access and explicit 42 linking.
- Home, private invitation-code Lobby creation, and Lobby join.
- Team and Role selection before a Match.
- Live Match, Submission, Failure trace, Retry cooldown, Hint, and Finish delay.
- Result, reconnect, interrupted Match, Profile, and Policies.

Record only changes that affect the Player flow or the game rules.

### 2. Game rules — 15 minutes

Confirm the current rules from the spec:

- A Match has two equal Teams in one Room.
- A Room has three ordered Stages.
- Each Player has one Role with private clues and controls.
- The Game service checks each Submission and owns the result.
- A failed Submission starts the team-wide Retry cooldown.
- An accepted Hint adds a Finish delay after the final Stage.
- Server-recorded eligibility time decides a win. Equal time is a draw.
- A disconnected Player keeps their place and Role until Match end.

### 3. Architecture and subject requirements — 15 minutes

Confirm the production target. The project needs a frontend, backend, database, secure account handling, input validation, HTTPS, responsive accessible UI, relevant Policies, concurrent users, and a single-command containerized launch.

Confirm the three service responsibilities:

| Service | Owns |
| --- | --- |
| Core | Email/password login, explicit 42 link, profiles, avatars, friends, and online status |
| Game | Lobbies, Teams, Roles, Rooms, Stages, Submissions, penalties, and Match results |
| Chat | Team messages and explicitly shared clue cards |

The 17-point module plan is a target. No module receives credit from the prototype alone.

### 4. Work ownership and first tickets — 15 minutes

Confirm the current ownership proposal:

| Area | Proposed owner | First production outcome |
| --- | --- | --- |
| Game rules, puzzle templates, Game service | Aimane | One server-checked Stage for a real Match |
| Core, authentication, databases, deployment | Saad | Secure email/password account flow and service foundation |
| Screens, game feel, Chat integration | Amal | Responsive production shell and Team message flow |
| Small bounded tasks | Supporting developer | Work reviewed by the relevant owner |

Assign a named owner, acceptance check, and deadline to every first ticket.

## Decisions to record

- Player-path changes that affect the spec.
- Any change to a service boundary, scope, or deadline.
- Real Team ownership names and review dates.

Do not reopen the historical Pong, eight-service, `qa-service`, or 2FA proposals unless the Team explicitly decides to change the current spec.

## After the meeting

1. Triage the Discord review notes.
2. Update the spec only when the Team changes a rule.
3. Commit the reviewed prototypes as design evidence.
4. Create small production tickets in dependency order.
5. Keep `prototype/game-ui/42-subject-compliance.md` current after every project change.
