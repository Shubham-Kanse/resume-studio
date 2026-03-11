# Layered Feature Architecture

This project remains a single Next.js deployment. The codebase uses a layered modular monolith, and feature slices are introduced where domains have enough surface area to justify them.

## Current shape

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
- `subscription`
  - Feature slice: `features/subscription/**`
  - Covers plan types, billing UI, client helpers, and server services
  - Backwards-compatible wrappers remain in `lib/subscription.ts`, `lib/services/subscription-service.ts`, `lib/services/account-service.ts`, `lib/services/polar-service.ts`, and `components/plan-dialog.tsx`

## Layers

1. UI layer
   - Components under `components/**`
   - Feature UI under `features/**/components/**`
   - Uses client service helpers from feature slices or `lib/services/gateway-client.ts`
2. Gateway layer
   - Existing Next.js API routes under `app/api/**`
   - Handles HTTP concerns such as request parsing, auth, and rate limiting
3. Service layer
   - Shared domain logic under `lib/services/**`
   - Feature-owned server logic under `features/**/server/**`
   - Returns domain results independent of React components
4. Shared utilities
   - Cross-cutting helpers in `lib/**`
   - Examples: auth adapters, error handling, HTTP policy, storage helpers

## Folder guidance

- `app/`: routes, layouts, API gateway handlers
- `components/`: shared UI not owned by a single feature
- `features/`: feature-first slices that group UI, client logic, server logic, and types by domain
- `lib/`: shared technical and cross-domain utilities
- `tests/`: tests and evaluations
- `supabase/`: schema artifacts

## Why this shape

- Preserves the current UI and routing contracts
- Removes business logic from route handlers
- Supports gradual migration from layer-first organization to feature-first organization
- Keeps shared infrastructure out of feature folders

## Next extraction path

As more domains stabilize, move them into `features/<domain>/{components,client,server,types}.ts` and keep thin compatibility wrappers during the transition. If you later want true distributed microservices, keep `app/api/**` as the gateway/BFF layer and extract the feature server modules into separate deployable services.
