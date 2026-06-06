# Jewelry Store

Professional e-commerce demo for a bijouterie / jewelry store.

## Goal

Build a small, polished, portfolio-ready online jewelry store in controlled stages. The project starts with repository memory, product rules, UX guidance, quality checklists, and workflow rules before any application code is written.

## Status

`Planning / Repository Bootstrap`

The store is not implemented yet. This repository currently contains project documentation only.

## MVP Scope

The planned MVP is a compact but complete e-commerce demo with:

- home page;
- catalog;
- category pages;
- product detail page / PDP;
- wishlist;
- cart;
- checkout demo;
- delivery, return, and care pages;
- basic SEO;
- accessibility baseline;
- performance baseline;
- security baseline.

Real payments, production secrets, live order processing, and production integrations are not connected at this stage.

## Why This Is a Portfolio Case

This project is intended to show practical e-commerce thinking beyond a static landing page:

- product modeling for jewelry and bijouterie;
- catalog and PDP planning;
- trust, delivery, return, and care content;
- mobile-first UX;
- SEO and structured data planning;
- accessibility and performance requirements;
- safe handling of future auth, checkout, admin, and secrets.

## Working AI Workflow

- ChatGPT Project: strategy, requirements, and task framing.
- Codex: audit, planning, narrow coding tasks, and repository-safe changes.
- Claude Code: local diagnostics, setup, running checks, debugging, and small fixes.

One stage equals one task, one report, and one verification step.

If a ChatGPT Project chat becomes too long, overloaded, or starts losing context, prepare a handoff summary and continue in a new chat inside the same ChatGPT Project. The handoff summary should include the current phase, repository link when known, latest relevant commit when needed, completed work, important documents, accepted decisions, active constraints, and one next micro-step.

New chats should continue from the project sources, `ROADMAP.md`, `PROJECT_BRIEF.md`, `AGENTS.md`, `CLAUDE.md`, and the current GitHub repository state. Do not restart from zero when a handoff summary and project sources exist.

## Primary Product / UX Reference

Makeup.ua is the primary product and UX reference for convenience, navigation depth, catalog system thinking, and e-commerce completeness. The customer requirement is UX/functionality parity: a comparable level of clarity, predictable shopping flow, catalog/PDP depth, trust coverage, and service-page completeness. This project may learn from its e-commerce mechanics: strong navigation, understandable catalog structure, category/subcategory logic, filters, sorting, detailed PDPs, delivery/trust information, wishlist, recently viewed products, cross-sell ideas, reviews, gift selections, service pages, checkout clarity, and SEO-friendly structure.

UX parity means matching the level of user clarity and systemic e-commerce coverage, not matching the look. The project must not clone Makeup.ua or reuse its brand, text, visual design, assets, or protected materials. The goal is a smaller, polished jewelry/bijouterie store with cleaner, lighter, more premium execution.

## Project Roadmap

See [ROADMAP.md](ROADMAP.md) for the planned phases.

Additional project documentation lives in [docs/](docs/). Source guides and checklists for future stages are grouped in [docs/project_sources/](docs/project_sources/).

## Current Repository Contents

This bootstrap stage creates:

- project brief and roadmap;
- product schema notes;
- brand, content, and UX guidance;
- e-commerce, SEO, performance, accessibility, security, and launch checklists;
- AI workflow documentation;
- design handoff notes;
- architecture and QA notes;
- first project decision record.

## Safety Notes

Do not add `.env` files, real secrets, real payment credentials, production customer data, or private business data to this repository.

Use `.env.example` only for safe placeholder names. Real payments and production secrets are not connected.
