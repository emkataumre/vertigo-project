# Vertigo

AI-powered trash sorting app for Copenhagen. Photo → Vision LLM → correct bin + reason.

## Stack
- React Native + Expo (iOS + Android)
- TypeScript (strict)
- Supabase Edge Functions (Deno/TypeScript)
- Supabase (PostgreSQL + Storage)
- Vision LLM (Claude or GPT-4V)

## Dev commands
- `npx expo start` — start Expo dev server
- `supabase functions serve` — run Edge Functions locally
- `eas build` — production build
- `npm test` — run tests

## Constraints
- TypeScript only — no plain JS
- Never commit directly to main — always use feature branches + PRs
- `app/constants/bins.ts` is the single source of truth for bin categories — never hardcode them elsewhere
- LLM prompt must return structured JSON — no free-form responses
- Correction data must always be saved — it is the future ML training set

## Future phases
- **Device attestation (iOS App Attest + Android Play Integrity):** The `identify` endpoint is currently protected by in-memory rate limiting only. For production hardening, add device attestation so requests are cryptographically verified as coming from a genuine, unmodified Vertigo binary on a real device. Requires: server-side attestation verification in the Edge Function, and integration with `DCAppAttestService` (iOS) and Play Integrity API (Android) in the app. This is the strongest available protection for a no-auth mobile app endpoint.

## Architecture & context
See the `vertigo-comms` private repo for full architecture, project plan, spec, and design decisions.
