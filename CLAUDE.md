# Project: Vertigo

## What it does
A mobile app that helps foreigners and new residents in Copenhagen identify which trash bin to use by photographing household items. Photo → AI identifies item → correct bin + reason.

## Stack
- **Languages:** TypeScript
- **Frontend:** React Native + Expo (iOS + Android)
- **Backend:** Node.js / TypeScript — Vercel serverless functions
- **Database:** Supabase — PostgreSQL (corrections table) + Storage (photos)
- **AI:** Vision LLM (Claude or GPT-4V) for MVP → custom ML model in v2

## Key commands
- **Dev (app):** `npx expo start`
- **Dev (API):** `vercel dev`
- **Build:** `eas build`
- **Test:** `npm test`
- **Test (e2e):** `npx playwright test`

## Architecture
See `docs/architecture.md` for full breakdown.

Short version:
```
[Expo App] → camera → photo
    ↓
[Vercel API] POST /api/identify → Vision LLM → { item, bin, reason }
             POST /api/correct  → saves correction to Supabase
    ↓
[Supabase] corrections table + photo storage bucket
```

## Bin categories (Copenhagen)
Paper/cardboard · Plastic · Metal · Glass · Food/bio · Residual · Hazardous · Electronics

Single source of truth: `bins.ts` config file with Danish/English names.

## Constraints & rules
- Never commit directly to main — always use feature branches and PRs
- All code in TypeScript — no plain JS
- LLM prompt must return structured JSON — no free-form responses
- `bins.ts` is the only place bin categories are defined — never hardcode them elsewhere
- Correction data must always be saved — this is the future ML training set, treat it carefully
- Run tests before marking any task complete

## Current focus
Phase 0 — Research (before any code)
- App existence check
- Copenhagen bin categories locked down
- Tech decisions confirmed
- Research tasks split between Martin (Emil's co-developer) and Emil

