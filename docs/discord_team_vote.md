# Campus Puzzle Race — Team Review Message

Copy this message to Discord after the files are committed and pushed.

```markdown
Salam drari — we now have the Campus Puzzle Race spec and a clickable player-path prototype.

Start here:
- `prototype/game-ui/index.html` — opens the numbered journey map.
- `docs/campus-puzzle-race-deck.player.html` — rules, scope, services, module plan, and four-week plan.
- `.scratch/campus-puzzle-race/spec.md` — the source for game rules.

The prototype covers: Account access, Home, Lobby, Live Match, Result, Recovery, Profile and friends, and Policies. It shows the intended flow for a Player. It does not include a real backend, database, authentication, WebSocket connection, or shared Match state.

For this round, please review. Do not edit the prototype files yet.

Reply in this thread with one of these:
1. `agree` — the rule or screen works for you.
2. `question: <file or slide number> — <your question>`.
3. `change: <file or slide number> — <your proposed change>`.

Examples:
- `change: 03-lobby.html — show the ready state more clearly.`
- `question: slide 14 — when does the Finish delay start?`

Please use the project words: Lobby before a Match, Room for the three Stages, Role for private clues and controls, Submission for an answer sent to the server, Retry cooldown after a failed Submission, and Finish delay after an accepted Hint.

The current working decisions are already in the spec: one campus-lockdown Room, three Stages, 2v2 or 3v3 Teams, one Role per Player, invitation-code Lobbies, structured answer entry, and three services named Core, Game, and Chat. This review checks the shared understanding. It does not reopen the old Pong or eight-service proposals.
```

## Before sending

- Commit and push the numbered prototype files, `CONTEXT.md`, the spec, and the current documents.
- Attach or link the player deck, never the editable `.bento.html` master.
- Set a review deadline in the Discord message.
- Collect every note in one thread before changing the prototype or writing production tickets.
