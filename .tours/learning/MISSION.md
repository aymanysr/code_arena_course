# Mission: Rebuild Code Arena to understand it

## Why
I want to understand the exact game implementation that is in this repository, then eventually recode the game myself so I can explain and take responsibility for what the vibe-coded version does.

Start at [Before Lesson 1](lessons/0000-before-lesson-one.html) to find the right folders and test commands in your teammate's repo. [Course Home](index.html#build-path) shows what to build and why each step depends on the last one. The 14 numbered lessons trace the reference game; use them to inspect behavior and tests, then write your own code.

## Success looks like
- Trace important player actions through the actual UI, transport, services, game rules, storage, judge, and tests.
- Find every in-scope game source file and know whether a lesson links to it, it changed since that lesson, or it still needs teaching.
- Rebuild features in small slices and write my own tests against the observable behavior of the current reference.
- When the original changes, review the impact report and relevant tests before accepting a newer reference; never let a lesson silently drift to different code.

## Constraints
- Teach me as a beginner: one concrete idea at a time, with predictions, hints, source links, and short retrieval checks.
- Treat the current code and tests as the implementation reference. Specs, diagrams, prototypes, and passing tests are different kinds of evidence.
- Keep CodeTour for navigation in VS Code; use the searchable source map and short lessons to understand and remember.
- Prefer a guided path to a large graph. Keep this course in one folder and make uncovered work visible rather than claiming completeness early.

## Out of scope
- Presentation-ready diagrams for teammates.
- Rewriting or changing game behavior as part of a learning lesson.
- Treating self-check clicks, AI output, or an existing test suite as proof that a separate rewrite is equivalent.
