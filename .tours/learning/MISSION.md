# Mission: Rebuild Code Arena to understand it

## Why

I want to understand the exact game implementation that is in this repository, then eventually recode the game myself so I can explain and take responsibility for what the vibe-coded version does.

## Success looks like

- Trace important player actions through the actual UI, transport, services, game rules, storage, judge, and tests.
- Find every in-scope game source file and know whether a lesson links to it, it changed since that lesson, or it still needs teaching.
- Rebuild features in small slices and write my own tests against the observable behavior of the current reference.
- When the original changes, review the impact report and relevant tests before accepting a newer reference; never let a lesson silently drift to different code.

## Constraints

- Teach me as a beginner: one concrete idea at a time, with predictions, hints, source links, and short retrieval checks.
- Treat the current code and tests as the implementation reference. Specs, diagrams, prototypes, and passing tests are different kinds of evidence.
- Start with [Course Home](index.html) and M00, which shows the destination and helps choose a workspace. Before coding game rules, open [Before Lesson 1](lessons/0000-before-lesson-one.html) and the [teammate-repo map](reference.html#build-path). Follow the dependency order and find the matching file owners in the team's repo. Use [Explore code](source-map.html) to inspect the reference; its source coverage describes freshness, not learning progress. Keep CodeTours for editor navigation in VS Code.
- Prefer a guided path to a large graph. Keep this course in one folder and make uncovered work visible rather than claiming completeness early.

## Out of scope

- Presentation-ready diagrams for teammates.
- Rewriting or changing game behavior as part of a learning lesson.
- Treating self-check clicks, AI output, or an existing test suite as proof that a separate rewrite is equivalent.
