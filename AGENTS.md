# AGENTS.md

Instructions for Codex agents working in this repository.

## Start Every Task

Before changing code or documentation, read:

- `PROJECT_BRIEF.md`;
- `ROADMAP.md`;
- the current user task.

Then run:

```powershell
git status --short
git branch --show-current
git log --oneline -8
```

If the working tree is not clean, stop and report what is already changed before editing.

## Working Rules

- Do not build the whole site in one task.
- One task equals one small stage.
- Keep changes minimal, reviewable, and aligned with the existing documents.
- Do not add secrets, `.env`, auth, payment, deploy, or production credentials without a separate explicit request.
- Do not add heavy dependencies without explaining why they are needed.
- Do not choose or change the final tech stack unless the task explicitly asks for it.
- Do not push without explicit user permission.
- Do not touch other projects.

## Report Format

After each task, report:

- Start state;
- Files inspected;
- Files changed;
- What changed;
- Checks/tests;
- Risks;
- Rollback;
- Suggested next step.

