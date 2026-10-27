# Flow-task Project Operating Guidelines

This project operates under the **Elite Full-Stack Suite** (Frontier 2026 Edition). All contributions must strictly adhere to the standards defined in the global constitution.

---

## 1. Project Tech Stack & Invariants

- **Runtime**: Node.js 22.x
- **Language**: TypeScript 6.0+ (Strict mode, zero `any`)
- **Frontend Framework**: React 19 (`19.2.8`) + Vite 8
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`) with design tokens
- **Client State**: Zustand 5 + IndexedDB (`idb`)
- **Backend / Database**: Firebase Client SDK 12 + Firebase Admin 14 + Cloud Firestore
- **Linter & Formatter**: Oxlint (`npm run lint`)
- **Testing**: Vitest (`npm test`), Playwright (`npm run test:e2e`), Firebase Rules Unit Testing (`npm run test:rules`)

---

## 2. Command Shortcuts & Verification Runbook

Before completing any task, execute the project verification pipeline:

```bash
# 1. Typecheck (Must pass with 0 errors)
npm run typecheck

# 2. Fast Oxlint linter
npm run lint

# 3. Unit & Integration tests
npm test

# 4. Security & Rules tests
npm run test:security
npm run test:rules

# 5. Full automated verification suite
npm run verify
```

---

## 3. Project-Specific Architectural Rules

1. **Firestore Security Rules**: Any change touching database access patterns must have corresponding tests in `scripts/test-rules.mjs` and pass `npm run test:rules`.
2. **State Mutation Discipline**: Zustand store actions must use immutable updates. Never mutate state arrays or objects in-place.
3. **Tailwind v4 Modern Styling**: Leverage CSS variables, modern color palettes, and container queries. Do not use legacy `@apply` cascades or arbitrary pixel margins where token variables exist.
4. **Offline-First & IndexedDB**: Local offline state handled via `idb` must synchronize idempotently with Cloud Firestore upon network reconnection.
5. **No Laziness Policy**: All components must handle loading skeletons, error states, and empty states. No stubbed `// TODO` comments.
