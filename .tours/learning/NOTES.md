# Teaching notes

## Learner and teaching style

- The learner knows C and is new to TypeScript and web development.
- Begin with the player-visible outcome. Name the owner of each value and show where it moves before introducing files.
- Use easy English, one main idea per step, a prediction before the answer, and four clues that become more specific.
- Each build step names the exact practice path, its owner, what to change, a pattern to follow, and the check that reads the result.
- Ask the learner to explain a changed case. A page visit, correct click, or test pass does not prove understanding.

## Course shape

- The guided route is M00–M13: orient first, set up practice, bridge from C to TypeScript, then build the game by responsibility, and finally inspect and map into the team repository.
- The full reference source map remains searchable. Its source links and the guided practice file map serve different jobs.
- `learning-path.json` has a per-file disposition and a separate list of 19 behavior rows. Build means the guided course cites that file directly; support means keep it as read-only reference context; exclude means the scope exclusion was reviewed.
- Only required behavior rows add executable checks to `courseReady`. Support rows remain visible but do not become required build work.

## Evidence and limits

- Reference, author rehearsal, learner practice, and team evidence have different scopes.
- The check ID and kind identify which authored behavior an evidence row refers to. The command and working directory record what actually ran; a real team command may differ from the practice command.
- The latest result for a workspace and check wins. A newer failed or blocked result reopens the check.
- Current lesson-ready labels do not mean the full author gate passed. The foundation learner walkthrough is separately pending.
- No teammate repository has been supplied. The real database/Judge setup and live 1v1, 2v2, reconnect, and chat journeys remain unproved. Do not promote fixture or practice results into team evidence.
- Source snapshot, lesson ranges, CodeTour hashes, course evidence, and 42-subject sign-off are separate records.
