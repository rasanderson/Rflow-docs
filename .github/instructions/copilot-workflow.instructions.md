---
applyTo: "**"
---

# Copilot Workflow for Rflow-docs

## Testing and Local Validation

- Ask for the developer's approval before running tests. Do not run builds or linters, or start services during code changes.
- Prefer existing tests or temporary checks outside the repository. Ask for approval before adding new `*.test.js` files.
- Do not run `npm run screenshots` or other Playwright test commands.
- Avoid interfering with the developer's running Rflow services.

## Communication

- Clearly distinguish what was changed, what was verified, and what still needs local testing.
- Do not claim success or use expressions such as "Perfect!" without supporting verification.
- Ask for clarification when the setup or requirements are unclear.
