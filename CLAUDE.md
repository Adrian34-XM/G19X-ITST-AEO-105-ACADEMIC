# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Nexo: an HR system with AI (recruitment, team/org chart, onboarding, training, tasks & evidence, performance, analytics, workplace climate). Stack: Node 24, Next.js 16 (App Router, **webpack** mode), React 19, TypeScript, Supabase (Auth, PostgreSQL with RLS + RPC functions, private Storage), Zod 4, amCharts 5. AI runs on Ollama (local) or Gemini, selected by `AI_PROVIDER`. AI output is always advisory and subject to human review — it never hires, approves deliveries, or changes state automatically.

All UI copy, docs, code comments, and commit messages are in **Spanish**. Source files start with a `@file` JSDoc header pointing to `docs/CODIGO.md` / `docs/MAPA_CODIGO.md`; keep that convention in new files.

## Commands

```bash
npm run dev -- --hostname 127.0.0.1   # dev server (webpack) at http://127.0.0.1:3000/login
npm run typecheck                     # tsc --noEmit
npm run lint                          # eslint .
npm test                              # vitest run (tests/**/*.test.ts)
npx vitest run tests/orchestration.test.ts   # single test file
npx vitest run -t "nombre del caso"          # single test by name
npm run test:e2e                      # Playwright (e2e/); uses Edge on Windows, set E2E_BROWSER_CHANNEL=chromium to change
npm run build                         # next build --webpack
npm run format                        # prettier
npm run test:supabase                 # checks Supabase connectivity using .env.local
```

Local Supabase: `npx supabase start`, then `npm run setup:local` (writes `.env.local`). `npx supabase db reset --local` **wipes local data** — only for first install or a deliberate demo reset; follow with `npm run seed` (refuses to run twice). Apply new migrations with `npx supabase migration up --local`. On Windows PowerShell, use `npm.cmd`/`npx.cmd` if script execution is blocked; `scripts/start-local.ps1` starts Next.js (+ Ollama) in the background.

Tests notes:
- `server-only` is aliased to `tests/server-only.ts` in vitest, so server modules are importable in tests.
- `tests/database.test.ts` (and other `*-sql` tests) load `supabase/migrations/*.sql` into PGlite — no Docker needed, but migrations must stay PGlite-compatible.
- `*-live.test.ts` files hit a real AI provider/DB and are skipped unless flags are set: `NEXO_AI_LIVE=1`, `NEXO_OVERVIEW_LIVE`, `NEXO_EVIDENCE_LIVE` (+ `NEXO_EVIDENCE_TASK_ID`), `NEXO_SYNTHETIC_LIVE`.

## Architecture

**Roles** (`src/lib/permissions/index.ts`): `SUPERUSER` → `/admin`, `RH_ADMIN` → `/rh`, `JEFE` → `/manager`, `EMPLEADO` → `/employee`, `CANDIDATO` → `/candidate`. `mayEnter` defines path access; audit (`/…/audit`, `audit_logs`) is SUPERUSER-only.

**Authorization is layered and every layer must hold on its own:**
1. `src/proxy.ts` (Next 16's replacement for middleware) refreshes the Supabase session cookies and gates navigation by role.
2. Every API route calls `authenticate()` / `requireRole()` from `src/lib/auth` and `checkOrigin()` from `src/lib/api.ts`, then validates input with Zod.
3. PostgreSQL RLS policies and `SECURITY DEFINER` RPC functions re-check membership, hierarchy, and state transitions. Hiding a UI button is never authorization.

**Pages**: a single catch-all `src/app/[[...path]]/page.tsx` resolves every view (login/register, public `/jobs`, role areas), loads the authorized dataset via `snapshot()` in `src/modules/workspace/queries.ts`, and renders `src/components/workspace.tsx`, which drives role-based navigation and modules. Business data is loaded with the user's session, not the service-role key.

**Writes**: form → API → RPC → PostgreSQL. `src/modules/commands/schemas.ts` holds a map of strict Zod schemas keyed by operation name (e.g. `"department.save"`); `/api/commands` validates against it and calls the generic `command` SQL function (or a dedicated RPC). `src/app/api/[...segments]/route.ts` is a REST adapter over resources that reuses the same files/AI/command handlers. SQL transactions don't span Auth or Storage — compensate manually (e.g. delete an uploaded object if associating it fails).

**Schema**: `supabase/migrations/` is the source of truth (timestamped `YYYYMMDDNNNN_*.sql`). New features usually need a migration; some API helpers (`requireHrHierarchySchema`, `requireCourseEvidenceSchema`) detect missing migrations and return a clear error. For hosted installs via SQL Editor, `supabase/instalar-proyecto.sql` concatenates the base migrations (empty projects only) and `supabase/activar-mejoras-rh.sql` is a repeatable upgrade on top of them — keep both in sync when adding migrations.

**Files**: private buckets; `src/app/api/files/route.ts` checks access/association and returns temporary signed URLs. Validators in `src/lib/storage/files.ts`.

**AI** (`src/lib/ai/`):
- `provider.ts` abstracts Ollama/Gemini (text + vision attachments, optional review model).
- `/api/ai/orchestrate` coordinates overview, training, tasks, performance and analytics recommendations. Per-module prompts/contracts live in `src/lib/ai/orchestration/*.ts`; `request.ts` selects input, output schema and repair strategy (it does not fetch data or grant permissions). The route handles auth, filters, minimized authorized context, cache, a reservation in `orchestration_runs` (rate-limited in SQL: 3/min, 1 pending per user), persistence, and stripping unauthorized IDs from output.
- `module-scope.ts` classifies whether a question is in scope; `grounding.ts` fact-checks generated answers against the provided data.
- Numbers, KPIs, and alerts are computed in code/SQL (`src/modules/workspace/insights.ts`, `analytics-summary.ts`, etc.); the AI only narrates them. Some questions (e.g. overdue tasks by area) are answered with server-side counts without calling the AI.
- Private AI analyses of candidates/surveys are separated from participant-visible records (`src/lib/private-analyses.ts`).

**Charts**: amCharts 5 loaded on demand in the browser (`src/lib/charts/module-loader.ts`, `src/components/data-chart.tsx`); data is prepared and authorized server-side. Keep the amCharts branding (license, see `THIRD_PARTY_NOTICES.md`).

## Docs

Detailed Spanish docs in `docs/`: `ARQUITECTURA_Y_AGENTES.md` (AI agents and permissions), `API.md` (routes), `CODIGO.md` (business flows), `MAPA_CODIGO.md` (file index — update it when adding/renaming files), `GRAFICAS.md` (charts). README covers install, env vars (`.env.example`), Ollama/Gemini setup, and hosted Supabase.
