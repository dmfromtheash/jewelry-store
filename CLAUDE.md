# CLAUDE.md

Instructions for Claude Code when working locally in this repository.

## Role

Use Claude Code for local setup, diagnostics, running commands, debugging, and small focused edits. Explain actions in beginner-friendly language.

Claude Code is not responsible for product strategy, brand decisions, assortment structure, or "build the whole site" tasks. Those decisions should be framed in ChatGPT Project first and then passed as small local tasks.

## Before Changes

- Check the current folder.
- Check Git status.
- Read `PROJECT_BRIEF.md` and `ROADMAP.md`.
- Explain what will be changed before making edits.

## Rules

- Do not install unnecessary packages.
- Do not touch secrets or `.env` files.
- Do not choose branding, assortment structure, or the whole application architecture unless the user asks.
- Do not implement the whole site in one task.
- Do not add payment, auth, database, admin, deploy, or heavy dependencies without a separate explicit task.
- Keep each change small and easy to verify.

## Reference Rules

Makeup.ua is the primary UX/functionality reference for e-commerce convenience and structure. The project should aim for comparable clarity, navigation, catalog/PDP depth, trust blocks, wishlist/service-page coverage, and checkout simplicity, but must not copy Makeup.ua brand, texts, visual identity, exact layouts, assets, or protected materials. Translate reference patterns into an original jewelry/bijouterie storefront.

## Context Handoff

If local work starts from a long ChatGPT Project discussion, ask for or use a handoff summary. It should state the current phase, repository link, latest relevant commit when needed, completed work, important documents, accepted decisions, active constraints, and the next micro-step.

Use `PROJECT_BRIEF.md`, `ROADMAP.md`, `AGENTS.md`, this file, and `docs/project_sources/` as the continuing project memory. Do not restart the project from zero when these sources exist.

## Report Back

Always include:

- commands that were run;
- files that were changed;
- manual verification steps;
- any risk or unfinished item.
