# Project Vertigo — Project Plan

## 1. Goals

| | |
|---|---|
| **Primary goal** | Ship a real, sellable product |
| **Target user** | Foreigners, new residents, DIS students in Copenhagen |
| **Problem** | Denmark's trash sorting system is confusing for non-natives |
| **End game** | Sell to Copenhagen Kommune; App Store launch |

---

## 2. MVP Definition

**In scope for MVP:**
- App opens directly to camera
- Take photo → AI identifies item → which bin + why
- Scan animation (feels polished)
- Confirm/correct flow (yes/no + typed correction)
- English + Danish language toggle
- Dark mode, minimalistic UI
- No login, no accounts
- Correction data saved to backend

**Deferred to later:**
- Rating/review system
- Custom ML model retraining pipeline
- Additional languages
- Revenue/monetization
- App Store submission (unless research shows it's easy)

**"Done" for MVP:** A friend can pick up any common household item, photograph it, and get the correct Copenhagen bin in under 3 seconds.

---

## 3. Technical Decisions

### Platform: React Native + Expo
**Why:** One codebase → iOS + Android. Native camera access. Direct path to App Store and Play Store. Avoids the "shaky web app" concern. Expo makes dev experience smooth and deployment straightforward.

### AI Strategy: LLM for MVP → Custom ML model for v2
- **MVP:** Use a vision LLM (Claude or GPT-4V) with a strict prompt that maps items to Copenhagen's official bin categories. Fast to build, highly accurate, no training data needed.
- **v2:** Train a custom image classification model on collected correction data. This is the "real ML" version — a better pitch. Swap the API call — the app doesn't change.
- **Why LLM first:** You need something working to collect correction data. That data trains the real model. Can't do ML without data.

### Backend: Node.js/TypeScript on Vercel (serverless)
Thin API layer. Receives image → calls AI → returns structured response. Also writes correction feedback to Supabase. Free tier on Vercel covers MVP traffic.

### Storage & Database: Supabase
- **Bucket:** Stores uploaded photos (for training data collection)
- **Database:** Logs corrections (item name, predicted category, actual category, timestamp)

### Architecture Overview

```
[Expo App]
    │
    ├── Camera → captures photo
    │
    ▼
[Vercel API] (Node.js/TypeScript)
    │
    ├── POST /identify  → calls Vision LLM → returns { item, bin, reason }
    └── POST /correct   → saves correction to Supabase
    │
    ▼
[Supabase]
    ├── Storage bucket: raw photos
    └── Table: corrections { id, photo_url, predicted_item, actual_item, timestamp }
```

---

## 4. Project Spec

### Data Model

```sql
-- Correction feedback (drives future model training)
corrections (
  id          uuid primary key,
  photo_url   text,           -- Supabase storage URL
  predicted   text,           -- What AI thought it was (from taxonomy)
  corrected   text,           -- What user said it was (raw input — see labeling strategy)
  lang        text,           -- 'en' | 'da'
  created_at  timestamptz
)
```

> **Note:** `bin` is intentionally excluded. The user is correcting because they don't know which bin the item belongs in — that is the app's job. The user can only correct the item name, not the category.

### API Design

```
POST /api/identify
  Body: { image: base64 }
  Returns: { item: string, bin: string, reason: string }

POST /api/correct
  Body: { photo_url: string, predicted: string, corrected: string }
  Returns: { ok: true }
```

### Correction Labeling Strategy (for ML Training)

When a user taps "No" on the confirmation screen, they see two paths:

**Path A — Suggested list (structured)**
The AI returns its top 3-5 closest alternative guesses alongside the primary prediction. The user picks from this list. The selected item name is clean, taxonomy-aligned, and immediately usable as a training label.

**Path B — "Other" (free text)**
If none of the suggestions match, the user types freely. This raw text is saved as-is into the `corrected` field. It is intentionally unstructured at this stage.

**Batch normalization pipeline (runs periodically)**
When the number of unprocessed free-text corrections hits a defined threshold, a batch job runs:
1. A cheap LLM (e.g. GPT-4o-mini) maps each free-text entry to its closest match in the item taxonomy.
2. Matched entries are merged with the structured correction data — both are now usable as training labels.
3. Entries that don't match any taxonomy item are flagged separately for a second reasoning step.

**Taxonomy expansion workflow (open decision)**
For flagged entries that fall outside the taxonomy, the LLM reasons whether the item is common enough to warrant adding as a new taxonomy entry. Whether this reasoning runs as part of the same batch job or as a separate, less frequent workflow is undecided — likely depends on how often truly novel items appear in practice.

**Why batching:** Avoids paying for LLM calls on every single correction. Lets unstructured data accumulate cheaply and normalizes it in bulk before each training run.

### Bin Categories (Copenhagen)
Paper/cardboard · Plastic · Metal · Glass · Food/bio · Residual · Hazardous · Electronics

### LLM Prompt Strategy
System prompt locks the model to Copenhagen's exact categories, prevents hallucination, forces structured JSON output. One source of truth: a `bins.ts` config file listing all valid categories with Danish/English names.

### UI Flow

```
Launch → Camera (full screen, no UI chrome)
  → Tap to capture
  → Scanning animation (1-2s)
  → Confirmation: "[Item name]?" + small image
       ├── YES → Result screen: bin name, color-coded, reason text
       └── NO  → Correction input → Result screen
```

---

## 5. Setup Checklist

- [ ] Check if this app already exists (Denmark + globally) — **do this first**
- [ ] Create public GitHub repo
- [ ] Initialize Expo project (`npx create-expo-app`)
- [ ] Set up Supabase project (free tier) — storage bucket + corrections table
- [ ] Create Vercel project, link to GitHub
- [ ] Set up `.env.example` with required keys (LLM API key, Supabase URL/key)
- [ ] Create `CLAUDE.md` in the repo root
- [ ] Create `docs/` folder with: `project_spec.md`, `architecture.md`, `project_status.md`
- [ ] Shared photo album (for collecting training images)
- [ ] Divide research tasks between Martin and Emil

---

## 6. Research List

### Martin
- [ ] Does this app already exist? Search App Store, Play Store, Google for "Denmark trash sorting app", "affaldsortering app"
- [ ] What are Copenhagen Kommune's exact bin categories and rules? (official source)
- [ ] What's the impact of wrong sorting? (for the pitch — contamination rates, cost, etc.)
- [ ] LLM API costs: What does it cost per API call (Claude, GPT-4V)? Estimate monthly cost at 100, 1,000, and 10,000 scans/month. Do we need our own API key or can we use a proxy? What are the rate limits? Is there a free tier that covers MVP traffic?

### Emil
- [ ] App Store submission: process, cost, Apple approval timeline
- [ ] How to sell an app to a municipality — examples of this being done
- [ ] IP/copyright: how to protect the app before pitching (DK law)
- [ ] Model hosting options when we go custom ML (Fly.io, Railway, Hugging Face)

### Together
- [ ] What does DIS offer students on arrival? Who to contact there?
- [ ] How much do apps sell for / what's the pricing model for B2G (business to government)?

---

## 7. Milestones

**Phase 0 — Research (before any code)**
- App existence check complete
- Research tasks done and reviewed together
- Tech decisions locked (confirm Expo, confirm LLM-first approach)
- Copenhagen bin categories documented

**Milestone 1 — Working Core (MVP)**
- Camera opens on launch
- Photo → AI identifies item → correct bin displayed
- Confirm/correct flow works
- Correction saved to Supabase
- English only, light/dark mode

**Milestone 2 — Polish + Danish**
- Danish language support
- Scan animation
- Color-coded bins (matches Copenhagen visual system if possible)
- Error states (no internet, unrecognized item)
- App icon + splash screen

**Milestone 3 — Launch Ready**
- App Store submission (if research confirms straightforward)
- QR code + pamphlet design for DIS pitch
- User feedback/rating screen (for data)
- Analytics (how many scans, most common items, correction rate)

**Milestone 4 — Custom ML Model**
- Collected enough correction data (target: 500+ labeled images)
- Train image classifier
- Swap LLM call for custom model API
- Model hosted on Fly.io or Railway

---

## 8. Key Decisions Log

| Decision | Status | Notes |
|---|---|---|
| Native app vs web app | Leaning Expo/RN | Needs App Store — confirm after research |
| LLM vs custom ML for MVP | Recommend LLM first | Swap to ML in v2 when training data exists |
| Sell vs keep on App Store | Undecided | Research B2G sales strategy |
| Monetization | None for MVP | Free app, sell the product |
| Copenhagen-only vs global | Copenhagen first | Expand if sold to Kommune |
| Monetization / pitch-to-payment strategy | Undecided | The pitch to Copenhagen Kommune (or similar) is: *"We built the MVP ourselves. To take this to real scale — more users, proper infrastructure, App Store, ongoing maintenance — we need a budget. We want that budget from you, and we want to be compensated for the labour already put in."* Sub-decisions: (1) How do we frame the budget ask — lump sum license vs. ongoing contract? (2) How do we value the labour already done? (3) What does "real scale" cost to run (LLM credits, hosting, storage)? This informs how much to ask for. |
