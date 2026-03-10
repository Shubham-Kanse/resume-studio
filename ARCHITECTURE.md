# Microservice-Ready Architecture

This project remains a single Next.js deployment, but its backend logic is now organized as a microservice-ready modular monolith so the UI and route structure stay unchanged.

## Service domains

- `resume`
  - Contract: `/api/generate-resume`
  - Logic: `lib/services/resume-generation-service.ts`
- `ats`
  - Contracts: `/api/ats-score`, `/api/ats-insights`
  - Logic: `lib/services/ats-service.ts`
- `document`
  - Contracts: `/api/extract-resume`, `/api/latex-to-pdf`
  - Logic: `lib/services/document-service.ts`
- `account`
  - Contracts: `/api/account/export`, `/api/account/delete`
  - Logic: `lib/services/account-service.ts`

## Layers

1. UI layer
   - Components and `app/page.tsx`
   - Uses `lib/services/gateway-client.ts`
2. Gateway layer
   - Existing Next.js API routes under `app/api/**`
   - Handles HTTP concerns such as request parsing, auth, and rate limiting
3. Service layer
   - Domain logic under `lib/services/**`
   - Returns domain results independent of React components

## Why this shape

- Preserves the current UI and routing contracts
- Makes each domain independently extractable into its own service later
- Removes business logic from route handlers
- Centralizes client-to-service communication through explicit contracts

## Next extraction path

If you later want true distributed microservices, move each file in `lib/services/**` into its own deployable service and keep `lib/services/contracts.ts` plus the current `app/api/**` files as an API gateway/BFF layer during migration.
