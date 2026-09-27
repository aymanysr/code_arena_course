# 13. Editor integration (Monaco behind the seam)

Status: complete (2026-09-24, CodeMirror 6 behind the seam)

> NOTE (2026-09-24): brief mandates CodeMirror 6 (Monaco was the old
> presumed default in Scope). Implemented: CodeMirror 6 via EditorAdapter
> props contract + EditorAdapterHandle (focus/selection); @codemirror
> state/view/commands/language/lang-cpp/lang-python. C shares the cpp
> grammar. Swap touches only EditorAdapter + its ref type + 2 e2e
> inputValue call sites (contenteditable has no inputValue).
Category: editor integration
Week 2: no
Blocked by: 12

## Scope

Replace the textarea behind the 12 editor seam with the production code editor (verify current Monaco/CodeMirror documentation at implementation time; Monaco is the presumed default, not a mandate). Carry over language selection, per-problem starters, font sizing, reset-to-starter (CODING-only), revision tracking, and read-only locking for every non-CODING phase. No fake advanced features; 2v2 remote cursors arrive with 15.

## Acceptance criteria

- [ ] Editing, language switch, reset, and read-only locking behave identically to the textarea version across all phases.
- [ ] No editor-originated console errors; keyboard accessibility and focus behavior preserved.
- [ ] Swap touches only the seam implementation, not arena logic (diff demonstrates this).

## Notes

Week 3. The week-2 duel ships the textarea-behind-seam version.

## Comments

- 2026-09-24: verified — typecheck clean, 19 vitest green (3 new
  EditorAdapter language-routing), oxlint clean, vite build clean,
  live-1v1 4/4 widths + reconnect A–D all green, zero app errors.
  No IDE extras (no LSP/autocomplete-server/debugger/terminal/file-tree).
