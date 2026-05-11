## Summary
<!-- 1-3 sentences: what changes, why now. -->

## Screenshots / evidence
<!-- Drop GIFs or screenshots for any UI change. For API-only changes,
     paste a sample curl or the relevant log line. -->

## Checklist

- [ ] Server TypeScript + tests pass locally (`cd jdawil/server && npx tsc --noEmit && npx vitest run`)
- [ ] Client TypeScript + build pass locally (`cd jdawil/client && npx tsc --noEmit && npx vite build`)
- [ ] No new secrets committed (check `.env.example` if an env var was added)
- [ ] Schema change? `drizzle-kit push` runs idempotently + the migration ships with the deploy script
- [ ] New route? It's authenticated + tenant-guarded where appropriate
- [ ] New write tool / Copilot capability? Preview-then-confirm contract preserved
- [ ] Docs / README updated if a new setup step is required

## Test plan

- [ ] <!-- what did you click / curl / run to prove this works -->
