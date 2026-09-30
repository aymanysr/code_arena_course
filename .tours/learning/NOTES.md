# Teaching notes

- The learner is a beginner and wants to recode this exact current game personally, not just browse architecture.
- Big graphs and broad file tours have been confusing; start from a player action and trace only the files that action crosses.
- Prefer Socratic questions with immediate, encouraging hints; a wrong guess should help locate the confusing boundary, not block progress.
- Do not treat page exposure, a correct click, a local self-check record, or a test pass as mastery. Ask the learner to explain the path in their own words.
- Keep the implementation inventory exhaustive within its declared game/runtime scope and label prototypes, experiments, and generated files so they cannot be mistaken for production behavior.
- Course Home is the learner start. Explore code is a searchable source reference, not a lesson or progress screen. Maintainer workflows live in [MAINTAINING.md](MAINTAINING.md).
- The current reference uses reviewed working-tree source hashes; it is not Git `HEAD` alone. The source snapshot, lesson line ranges, and CodeTour checksums are separate records. See [MAINTAINING.md](MAINTAINING.md) before refreshing any of them.
- Keep test evidence date-stamped. Refreshing hashes does not rerun tests and must not make historical results look current.
