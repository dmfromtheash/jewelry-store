# Codex Workflow Guide

## Ask / Plan Before Code

For non-trivial work, Codex should inspect the repository, explain the plan, and then make small changes.

Codex should not accept a broad "build the whole site" task. It should ask for a smaller staged task that has clear scope, allowed files, checks, and report format.

## Issue-Style Tasks

Prefer tasks with:

- context;
- objective;
- constraints;
- acceptance criteria;
- verification command.

## Git Safety

- Check status before edits.
- Do not overwrite unrelated changes.
- Commit only focused work.
- Do not push without explicit permission.
- Do not add dependencies, payment, auth, database, admin, deploy, or broad architecture changes without a separate explicit task.
- Explain why before risky changes.

## Context Handoff

When continuing from a long ChatGPT Project discussion, use the handoff summary and project documents instead of restarting from zero.

A useful handoff summary includes the current phase, repository link when known, latest relevant commit when needed, completed work, important files, accepted decisions, active constraints, and one next micro-step.

## Report Format

Use the report format from `AGENTS.md`. Include what changed, which files changed, how to verify, risks, and rollback.
