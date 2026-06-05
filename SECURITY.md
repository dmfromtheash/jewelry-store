# Security Policy

## Project Status

This project is currently in a bootstrap / development stage. It does not process real payments, real customer accounts, or production orders.

## Secrets

Production secrets must not be committed to this repository. Keep real credentials, tokens, private keys, payment keys, and deployment credentials out of Git.

Use `.env.example` only for safe placeholder names. Do not create or commit `.env`.

## Payments

Real payments are not connected at this stage. Payment behavior must be designed, implemented, and audited in a separate future task before any production use.

## Reporting Security Issues

For now, security issues can be tracked through GitHub Issues. A private contact process can be added later when the project is closer to production.

Do not publish tokens, passwords, private customer data, personal data, or exploitable secrets in public issues.
