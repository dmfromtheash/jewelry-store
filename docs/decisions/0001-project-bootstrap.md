# Decision 0001: Project Bootstrap Before Application Code

## Status

Accepted

## Context

The project is a new portfolio-oriented e-commerce demo for bijouterie and jewelry. The user is a beginner, so the repository needs clear memory, scope, and safety rules before implementation starts.

## Decision

Start with a documentation-only repository bootstrap. Do not create application code, choose a final stack, install dependencies, create a database, configure auth, or connect payments during this stage.

## Consequences

- Future tasks have clear references and constraints.
- The first commit is small and auditable.
- Development can proceed in controlled stages.
- The actual application still needs to be planned and implemented later.

