# Claude Code Workflow Guide

## Best Use

Use Claude Code for:

- local environment checks;
- installation diagnostics;
- running commands;
- debugging errors;
- small edits;
- explaining results in simple language.

Do not use Claude Code for broad product strategy, final brand decisions, assortment structure, or "build the whole site" tasks. Those should be framed first in ChatGPT Project and then split into small local tasks.

## Local Checks

Start with:

```powershell
Get-Location
git status --short
git branch --show-current
```

## Output

Report commands, results, changed files, and a manual check the user can repeat.

## Context Handoff

If work comes from a long ChatGPT Project thread, use a handoff summary before starting. The summary should include the current phase, repository link, latest relevant commit when needed, completed work, important documents, accepted decisions, active constraints, and the next micro-step.

Continue from `PROJECT_BRIEF.md`, `ROADMAP.md`, `AGENTS.md`, `CLAUDE.md`, and `docs/project_sources/`. Do not restart the project from zero when those sources exist.
