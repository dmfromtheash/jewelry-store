# AI Workflow Guide

## Roles

- ChatGPT Project: strategy, requirements, product decisions, planning, task framing, and report review.
- Codex: repository audit, plans, small engineering tasks, repository/code changes, checks, and reports.
- Claude Code: local setup, diagnostics, running checks, environment checks, debugging, and beginner-friendly explanations.

## Rule

One stage equals one task, one result, one report, and one verification step.

Codex and Claude Code should not receive a broad "build the whole site" task. Break work into small staged tasks.

Before risky changes, the AI should explain why the change is needed. Risky changes include dependency additions, architecture changes, auth, payment, database, admin, deploy, or broad refactors.

## Context Hygiene

If a ChatGPT Project chat becomes too long, overloaded, or starts losing context, the assistant should tell the user it is time to open a new chat inside the same ChatGPT Project.

Before switching chats, prepare a handoff summary with:

- current project phase;
- GitHub repository link when known;
- latest relevant commit/hash when needed and known in the current working context;
- completed work;
- important files and documents;
- accepted decisions;
- active constraints;
- one next micro-step.

The new chat should continue from Project Sources, `ROADMAP.md`, `PROJECT_BRIEF.md`, `AGENTS.md`, `CLAUDE.md`, and the current GitHub repository state. Do not restart from zero when a handoff summary and project sources exist.

Do not write a current commit hash into long-lived documentation as permanent state. Handoff summaries may mention a latest commit when it is useful for continuation.

## Good Task Shape

Each task should include:

- goal;
- scope;
- files allowed to change;
- expected checks;
- report format.
