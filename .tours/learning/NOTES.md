# Teaching notes

- The learner is a beginner and wants to recode this exact current game personally, not just browse architecture.
- Big graphs and broad file tours have been confusing; start from a player action and trace only the files that action crosses.
- Prefer Socratic questions with immediate, encouraging hints; a wrong guess should help locate the confusing boundary, not block progress.
- Do not mark exposure, a correct click, or a test pass as mastery. Ask the learner to explain the path in their own words before adding a learning record.
- Keep the implementation inventory exhaustive within its declared game/runtime scope and label prototypes, experiments, and generated files so they cannot be mistaken for production behavior.
- The current reference is a reviewed working-tree snapshot, not Git `HEAD` alone. `reference-snapshot.json` freezes source hashes; `coverage-map.json` owns lesson links and line ranges; the CodeTour checksum list is a separate evidence baseline.
- After original-game changes: run the impact check, inspect changed source and tests, update every affected lesson/tour/evidence note, then explicitly run `node .tours/learning/scripts/build-catalog.mjs --accept-reviewed-snapshot --reviewed-lessons=<affected-ids>`. Normal generation and checks never accept changes. Listing an id records “reviewed; no lesson edit needed” when no edit was required.
- Keep test evidence date-stamped. Refreshing hashes does not rerun tests and must not make historical results look current.
