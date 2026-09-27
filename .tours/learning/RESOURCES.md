# Code Arena Learning Resources

## Primary evidence: this exact project

- [Complete 14-lesson course start page](README.md)
  Canonical lesson order, source-map workflow, change/freeze process, and warnings about evidence and parity.
- [Searchable source and coverage map](source-map.html)
  Generated inventory of scoped game, test, configuration, and runtime files. Use it to find what is not taught yet or changed since a lesson snapshot.
- [Lesson 1: follow one Submit](lessons/0001-follow-one-submit.html)
  A short, interactive trace through the real Submit path. Use it to learn the difference between delivery, game authority, and code execution.
- [CodeTour 1: big picture](../1-code-arena-big-picture.tour) and [CodeTour 2: submission journey](../2-submission-journey.tour)
  Editor navigation stops that open actual source locations; they do not by themselves track full codebase coverage.
- [42 project requirements](../../ft_transcendence.pdf)
  Authoritative requirements for the team project. Read alongside the [compliance matrix](../../prototype/game-ui/42-subject-compliance.md); this learning workspace does not change module claims or sign-off.
- [Frozen CodeTour reference snapshot](../reference-baseline.md)
  Records the direct CodeTour file hashes and verification evidence captured for the existing course. It does not freeze every repository file.
- [Code Arena behavior spec](../../.scratch/code-arena/spec.md)
  Intended behavior and acceptance criteria. Compare it with the implementation and tests; it is not proof that a feature is currently implemented.

## Knowledge

- [TypeScript Handbook: Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html)
  Official explanation of object types and interface/type contracts; use when a lesson relies on a TypeScript contract such as `ArenaTransport`.
- [TypeScript Handbook: Classes](https://www.typescriptlang.org/docs/handbook/2/classes.html)
  Official guide to class members and implementations; use when following concrete classes such as `ArenaEngine` or `ContainerJudge`.

## Wisdom (people)

- Your teammates and the ft_transcendence peer-evaluation setting are the real-world check: practice explaining each slice and ask a teammate to challenge where authority lives.

## Gaps

- The complete course now has 14 linked lessons. The source map tracks every in-scope file as lesson-taught or support-only; rerun its check after the reference game changes and review any affected lesson, test, or CodeTour before freezing a newer snapshot.
