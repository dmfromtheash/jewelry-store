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
- One stage equals one task, one result, one report, and one verification step.
- Keep changes minimal, reviewable, and aligned with the existing documents.
- Do not add secrets, `.env`, auth, payment, deploy, or production credentials without a separate explicit request.
- Do not add heavy dependencies without explaining why they are needed.
- Do not choose or change the final tech stack unless the task explicitly asks for it.
- Do not push without explicit user permission, except for the current repository bootstrap stage where push is explicitly allowed by the task prompt.
- Do not touch other projects.
- Do not accept tasks shaped as "build the whole site"; ask for a smaller staged task instead.
- Explain why before risky changes such as dependency additions, architecture changes, auth, payment, database, admin, deploy, or broad refactors.

## AI Role Boundaries

- ChatGPT Project: strategy, product decisions, planning, task framing, and report review.
- Codex: audit, plan, small engineering tasks, repository/code changes, checks, and reports.
- Claude Code: local diagnostics, local project runs, environment checks, debugging, and beginner-friendly explanations.

## Reference Rules

Makeup.ua is the primary UX/functionality reference for e-commerce convenience and structure. The project should aim for comparable clarity, navigation, catalog/PDP depth, trust blocks, wishlist/service-page coverage, and checkout simplicity, but must not copy Makeup.ua brand, texts, visual identity, exact layouts, assets, or protected materials. Translate reference patterns into an original jewelry/bijouterie storefront.

## Context Handoff

If a ChatGPT Project chat becomes too long, overloaded, or starts losing context, tell the user to prepare a handoff summary and continue in a new chat inside the same ChatGPT Project.

A handoff summary should include:

- current project phase;
- GitHub repository link when known;
- latest relevant commit/hash when needed and known in the current working context;
- completed work;
- important files and documents;
- accepted decisions;
- active constraints;
- one next micro-step.

Do not hard-code a current commit hash into long-lived project documentation as permanent state. Describe the handoff rule instead.

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
