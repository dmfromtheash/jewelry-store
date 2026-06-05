# Decision 0001: Repository Bootstrap

## Date

2026-06-06

## Status

Accepted

## Context

The project starts as a portfolio e-commerce demo for bijouterie and jewelry. The user is a beginner, so the repository needs clear memory, scope, and safety rules before implementation starts.

## Decision

First create a documentation-focused GitHub foundation without application code. Do not choose a final stack, install dependencies, create a database, configure auth, or connect payments during this stage.

## Consequences

- Future tasks have clear references and constraints.
- The first commit is small and auditable.
- Development can proceed in controlled stages.
- Codex and Claude Code can be connected with less chaos.
- The actual stack will be selected later in a separate phase.
