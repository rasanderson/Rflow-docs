---
applyTo: "**"
---

# Copilot Workflow for Rflow-docs

## Testing and Local Validation

- Do not run tests, builds, or linters, or start services during code changes.
- The developer runs tests locally and reports the results. Use that feedback to fix any issues.
- Do not run `npm run screenshots` or other Playwright test commands.
- Avoid interfering with the developer's running Rflow services.

## Communication

- Clearly distinguish what was changed, what was verified, and what still needs local testing.
- Do not claim success or use expressions such as "Perfect!" without supporting verification.
- Ask for clarification when the setup or requirements are unclear.
