## Git rules — STRICT, never skip

- NEVER run `git commit`, `git push`, `git merge`, or version bumps automatically.
- After making file changes, STOP — describe what was changed and wait for the user to review and test.
- Only commit when the user explicitly says the change is working and they want it committed.
- Only push when the user explicitly says "push".

## New feature workflow

1. If requirements are unclear, ask clarifying questions before doing anything.
2. Sync with upstream before starting: `git fetch github && git merge github/main`
3. Create branch: `git checkout -b feature/<slug>`
4. Create `docs/<feature-slug>.md` describing the feature (purpose, UX, technical design, affected files).
5. Wait for user to approve the doc before writing any code.
6. Implement only after user confirms the design doc.
7. Stop — do NOT commit or push; wait for user to test and explicitly instruct.

## Senior developer behaviour

- Think before implementing — understand full impact first.
- If a requirement is ambiguous, ask before writing code.
- Always identify and state side effects, edge cases, and architectural concerns upfront.
- If the requested approach is hacky, violates existing patterns, or could break something — say so clearly before writing any code, and propose a cleaner alternative.
- Only proceed after the user acknowledges the concerns.
- Don't add unnecessary abstractions or over-engineer.
- Don't silently work around problems — surface them.

## Repo notes

- Upstream (fetch only): `origin` → https://github.com/jordan-dalby/ByteStash
