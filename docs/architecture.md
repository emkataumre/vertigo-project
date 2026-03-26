# Architecture

## Overview
Vertigo is a mobile-first app with a thin serverless API backend. The Expo app handles camera and UI. All AI logic runs server-side through a Vercel function — never on-device for MVP. Supabase handles storage and the corrections database.

## Components

### Expo App (React Native)
- Full-screen camera on launch
- Sends base64 image to `/api/identify`
- Renders result: bin name, color, reason
- Confirm/correct flow — sends correction to `/api/correct`
- English/Danish toggle
- Dark mode

### Vercel API (Node.js / TypeScript)
- `POST /api/identify` — receives image, calls Vision LLM, returns `{ item, bin, reason }`
- `POST /api/correct` — receives correction, saves to Supabase
- Stateless serverless functions — no persistent server

### Supabase
- **Storage bucket:** raw photos (for future ML training data)
- **Table:** `corrections { id, photo_url, predicted, corrected, lang, created_at }`

### Vision LLM (Claude / GPT-4V)
- Called server-side only
- System prompt locks responses to Copenhagen bin taxonomy
- Returns structured JSON — no free-form text
- Swappable: in v2, replaced by custom ML model with no app changes

## Data flow
```
User taps capture
    → Expo sends base64 image to POST /api/identify
    → Vercel calls Vision LLM with image + system prompt
    → LLM returns { item, bin, reason }
    → Vercel returns response to app
    → App shows result

User taps "No" (correction)
    → App calls POST /api/correct with { photo_url, predicted, corrected }
    → Vercel writes to Supabase corrections table
```

## Key decisions

| Decision | Choice | Reason |
|---|---|---|
| Native vs web | Expo (React Native) | App Store access, native camera, one codebase |
| AI for MVP | Vision LLM | No training data needed; fast to build; accurate |
| AI for v2 | Custom ML model | Better pitch; data collected by then |
| Backend | Vercel serverless | Free tier covers MVP; no infra to manage |
| Database | Supabase | Free tier, easy SDK, handles storage + DB |
| Language | TypeScript only | Type safety across app and API |

## v2 evolution path
When enough correction data is collected (target: 500+ labeled images):
1. Train image classifier on correction data
2. Host on Fly.io or Railway
3. Swap `/api/identify` LLM call for custom model API call
4. App is unchanged
