## Agent skills

### Issue tracker

Local markdown tracker under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical roles as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context with `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

### 42 subject compliance

Every project artifact and change must adhere to the authoritative requirements in `ft_transcendence.pdf`. Before completing a change, check the relevant mandatory requirements and claimed-module requirements; resolve any conflict in favor of the PDF, and never present planned or prototype behavior as implemented evidence.

After every project change, review `prototype/game-ui/42-subject-compliance.md`. Update it in the same change whenever requirement evidence, scope, module claims, assumptions, or compliance status changed.
