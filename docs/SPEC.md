# HalfSaid — Engineering Specification (SPEC.md)

> **Status:** authoritative, committed. This document is the source of truth for
> the HalfSaid hackathon MVP. It is written to be **self-sufficient without the
> PRD** — the PRD (`docs/PRD_v1.0.pdf` / `.md`) is intentionally *gitignored* and
> is not present in most clones (see [docs/README.md](README.md)).
>
> Every non-obvious claim cites a PRD chapter as `[PRD §N]` so a human holding the
> PDF can trace it back. If this file and the PRD ever disagree, the PRD wins and
> this file must be corrected.
>
> Scope of this document: the **48-hour hackathon MVP** defined in `[PRD §31.1]`,
> plus exactly enough of the surrounding platform design to build the MVP data
> model so the full vision stays possible. Post-MVP material is summarized only
> where it constrains an MVP decision.

---

## 0. The three governing rules

These three rules govern the entire project. Violating any one of them is worse
than shipping nothing.

### Rule 1 — The Hard Rule (verbatim, `[PRD §22.1]`)

> **CRITICAL — HalfSaid's Most Important Rule.**
> User-facing utterances are constrained-decoded from PCG items only. No free-form
> LLM generation reaches the user as a suggestion. PCG items are user-authored,
> family-validated, or therapist-approved. The Generation Agent retrieves ranked
> PCG items and either selects the top item or composes 2–3 items via a constrained
> grammar. Free-form LLM generation is restricted to internal operations: intent
> classification, paraphasia resolution, semantic similarity scoring, translation
> of approved items. This rule is non-negotiable and is enforced in code review,
> in product review, and in the Safety Agent's policy filter.

**Why it is existential** `[PRD §22]`: an aphasia user *cannot verify* what
HalfSaid said on their behalf. The utterance is spoken in the user's own cloned
voice, attributed to them, in medical/legal/financial contexts where it can cause
irreversible harm. A hallucination here is a safety incident, not a bug. A single
documented injury from a hallucinated utterance would end the company.

**What this means in code** (see [§8](#8-safety-architecture)): a user-facing
suggestion candidate can *only* be constructed from one or more PCG node IDs. It is
structurally impossible for a raw model completion string to become a candidate.
The type system and the `packages/safety-policy` package enforce this; a test
fails the build if that path ever opens.

**LLMs are permitted only for internal operations:** intent classification,
paraphasia resolution, semantic-similarity scoring, and translation of
already-approved items. Never for producing user-facing text.

> **⚠️ CURRENT MVP DEVIATES FROM THIS (deviation [D20](#11-known-deviations)).** By
> owner decision (2026-07-24), the running MVP **generates user-facing suggestions
> with the LLM**, using the PCG as *context* rather than a strict word-source, so it
> stays useful on a cold/sparse graph. The constrained-decoding machinery in
> `packages/safety-policy` is retained as the no-key / high-stakes fallback. This
> text records the original, safer design — which a real clinical deployment must
> restore. See D20 for the full rationale and the safety tradeoff.

### Rule 2 — Scope is fixed and small

Build **only** the MVP in `[PRD §31.1]` (enumerated in [§2](#2-mvp-scope)). The PRD
describes a five-year platform; most of it is explicitly out of scope
([§3](#3-out-of-scope)). Build the *data model* so the full vision remains
possible; implement only the MVP surface.

### Rule 3 — Stop and plan; test as you go

No application code until the plan is approved (session-one gate). Thereafter, a
phase is not done until its tests pass — testing is not batched to the end. Stubs
must be *obviously* stubs; never fabricate clinical scores, confidence values, or
provenance.

---

## 1. What HalfSaid is

HalfSaid is a Personal Communication Intelligence Platform for people with aphasia
and related communication disorders. Its core innovation is the **Personal
Communication Graph (PCG)** — a per-user, bi-temporal knowledge graph of the
people, places, objects, routines, episodes, and utterances in the user's life.
Suggestions are *retrieved and constrained-decoded from the PCG*, never generated
free-form, so every suggestion is grounded, attributable, and auditable `[PRD §13,
§22]`.

**Demo persona:** *Maya* — post-stroke Broca's aphasia, retired English teacher.
Broca's aphasia = effortful, telegraphic, non-fluent output with relatively intact
comprehension. This shapes the UX (short candidates, large touch targets, patience
with slow input) `[PRD §10.5]`.

---

## 2. MVP scope

Exactly these eight features `[PRD §31.1]`. Nothing else.

| # | Feature | MVP implementation |
|---|---|---|
| 1 | Web app | Next.js + TypeScript (strict) + Tailwind + shadcn/ui; deployable to Cloudflare Pages |
| 2 | Auth + DB | Supabase Auth + Postgres + pgvector extension |
| 3 | PCG retrieval | pgvector retrieval over a **pre-populated 200-node "Maya" PCG** |
| 4 | Streaming ASR | Groq Whisper large-v3, live transcript |
| 5 | Constrained suggestions | Gemini 2.0 Flash for *internal* ops only; **3 candidates**, each built from PCG item IDs |
| 6 | Three suggestion modes | autocomplete · phrase retrieval · full utterance |
| 7 | Conversation Canvas | up to **5 suggestion cards**; accept / edit / reject |
| 8 | Clinician dashboard | FCM trend (clearly labelled **mock**) + conversation log |

**Acceptance test — the 3-minute demo** `[PRD §31.1, README §9.4]`:
Maya opens the app with a pre-populated PCG → speaks *"I want to…"* → three grounded
candidates appear (*"call Sarah"*, *"go to the garden"*, *"read my book"*) → she
taps one → it is spoken (browser `SpeechSynthesis`) → the clinician dashboard shows
the FCM trend and the conversation-log entry that exchange produced. The three
candidates must **emerge from retrieval over the seeded PCG**, not be hardcoded.

The `<0.5` **refusal path** ("I don't have a confident suggestion" + alternatives)
is a **first-class feature**, not an error state `[PRD §22.3]`. It will fire during
the demo and that is correct behaviour.

---

## 3. Out of scope — do not build

Native iOS/Android apps · LiveKit SFU / self-hosted realtime audio · voice cloning,
OpenVoice, watermarking, the Voice Banking Vault · SMART on FHIR / Epic / Cerner ·
Therapy Mode and the Therapy Co-Pilot · the Replay Studio · vision pipeline,
Florence-2, gaze tracking · multilingual & code-switch engine · nightly Reflection
worker · Care Circle portal · Communication Will / PCG Inheritance · Cohort Insights
· on-device SLM fallbacks · Hetzner infrastructure · OpenTofu / IaC.

- **TTS for MVP:** browser `SpeechSynthesis`. Leave a clean seam for OpenVoice
  later; do not implement it `[PRD §31.1]`.
- If something out-of-scope seems genuinely required for the demo, **ask** — do not
  build it unilaterally.

---

## 4. The Personal Communication Graph (PCG) `[PRD §13]`

The PCG is the core subsystem: a per-user bi-temporal knowledge graph, stored on
Postgres + pgvector (Graphiti-on-Postgres model; **not** Neo4j — see
[§9](#9-license-bans)).

### 4.1 Node types (11) `[PRD §13.1]`

| Node type | Purpose | Key attributes | Cardinality / user |
|---|---|---|---|
| `User` | The HalfSaid user themselves | id, name, dob, languages, conditions, ability_profile | 1 |
| `Person` | Anyone the user communicates with | id, name, role, relationship, language_pref, consent_tier, first_seen | 50–500 |
| `Place` | Physical locations | id, name, type (home/clinic/cafe), lat/lon, typical_visit_time | 20–200 |
| `Object` | Physical objects in the user's world | id, name, type, owner_id | 100–1,000 |
| `Routine` | Recurring patterns | id, name, frequency, typical_time, participants | 10–100 |
| `Episode` | A discrete conversation/communication event | id, event_time, ingestion_time, location, modality, participants, duration, outcome | 10K–100K |
| `Utterance` | A single spoken/typed utterance | id, episode_id, speaker_id, content, language, confidence, privacy_tier, asr_score | 100K–1M |
| `Emotion` | Emotional state attached to episode/utterance | id, type, valence, arousal, source (prosody/facial/text) | ~50K |
| `Intent` | Communicative intent of an utterance | id, type (inform/request/refuse/etc), confidence | ~100K |
| `Topic` | Subject of communication | id, name, language, parent_topic_id, embedding | 1K–10K |
| `CulturalContext` | Cultural context for cross-cultural communication | id, name, culture, register, do_dont | ~50 |

Node-type-specific fields live in the `attributes` JSONB column; the columns in
[§4.3](#43-sql-schema) are common to all node types.

### 4.2 Edge types (15) `[PRD §13.2]`

| Edge | From → To | Meaning |
|---|---|---|
| `spoke_to` | Person → Person (via Episode) | A spoke to B in episode E |
| `mentioned` | Utterance → Person/Place/Object/Topic | Utterance references entity |
| `participates_in` | Person → Episode | Person was a participant |
| `occurs_in` | Episode → Place | Episode happened at location |
| `precedes` | Utterance → Utterance | Temporal ordering within an episode |
| `evokes` | Utterance → Emotion | Utterance carried emotional tone |
| `expresses` | Utterance → Intent | Utterance had this intent |
| `about` | Utterance → Topic | Utterance concerned this topic |
| `replaces` | Utterance → Utterance | Edited/corrected an earlier utterance |
| `refined_by` | Topic → Topic | Subtopic relationship |
| `generates` | Routine → Episode | Routine produced this episode |
| `has_culture` | Person → CulturalContext | Person's cultural context |
| `preferred_lang` | Person → Language | Preferred language with this person |
| `supersedes` | Node → Node | Bi-temporal correction; new node supersedes old |
| `known_at` | Node → Time | Bi-temporal: when HalfSaid learned this |

> **Note on `supersedes` / `known_at`:** these two express bi-temporal semantics
> that the MVP models primarily via the `superseded_by` / `ingestion_time` *columns*
> ([§4.4](#44-bi-temporal-semantics)) rather than as materialized graph edges. They
> remain in the edge-type enum so the full model is representable. Documented in
> [§11 Known Deviations](#11-known-deviations).

### 4.3 SQL schema `[PRD §13.3, README §10.3]`

The bi-temporal model is implemented as **two timestamp columns on every node and
edge**, plus a `superseded_by` self-reference. This is exact — do not collapse.

```sql
CREATE TABLE pcg_nodes (
    id             UUID PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES users(id),
    node_type      TEXT NOT NULL,                       -- Person, Place, Episode, ...
    attributes     JSONB NOT NULL,
    event_time     TIMESTAMPTZ NOT NULL,                -- when it happened in the world
    ingestion_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- when HalfSaid learned it
    superseded_by  UUID REFERENCES pcg_nodes(id),       -- correction target; original retained
    privacy_tier   SMALLINT NOT NULL DEFAULT 1,
    salience       FLOAT DEFAULT 0.5,
    embedding      VECTOR(1024)
);

CREATE TABLE pcg_edges (
    id             UUID PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES users(id),
    edge_type      TEXT NOT NULL,                       -- spoke_to, mentioned, ...
    from_id        UUID NOT NULL REFERENCES pcg_nodes(id),
    to_id          UUID NOT NULL REFERENCES pcg_nodes(id),
    attributes     JSONB,
    event_time     TIMESTAMPTZ NOT NULL,
    ingestion_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    superseded_by  UUID REFERENCES pcg_edges(id),
    weight         FLOAT DEFAULT 1.0
);
```

- `embedding VECTOR(1024)` — dimension is fixed at **1024** to match the Context
  Vector `[PRD §14]`. Index with an appropriate pgvector index (HNSW or IVFFlat;
  see [§11](#11-known-deviations) for the MVP embedding-source deviation).
- `privacy_tier SMALLINT` on every node; RLS enforces visibility ([§6](#6-privacy-tiers)).
- Migrations are the **only** source of truth for schema — no manual changes, ever
  `[PRD §24.4]`. Create them via `supabase migration new`.

### 4.4 Bi-temporal semantics `[PRD §13.3]`

Every fact carries two timestamps:

- **`event_time`** — when the event occurred in the real world.
- **`ingestion_time`** — when HalfSaid learned about it.

This enables:

- **Audit** — "What did HalfSaid know when it made this suggestion?" → query
  `ingestion_time`.
- **Correction** — when a fact is corrected, the original is **not overwritten**;
  a new row is inserted and the old row's `superseded_by` points to it (or the new
  row supersedes via a `supersedes` edge). **Both rows are retained.** Agents
  routinely collapse this into a single timestamp / overwrite — **do not.**
- **Reasoning under uncertainty** — a fact learned 2 h late can be weighted less
  confidently than one learned live.
- **Regulatory defence** — HIPAA audit ("when was this recorded") uses
  `ingestion_time`; GDPR erasure requires deletion of *all* versions, which
  bi-temporal retention makes complete.

### 4.5 Query patterns `[PRD §13.6]` (reference; MVP implements the retrieval one)

| Query | Purpose | Index | Cache |
|---|---|---|---|
| What did the user say to X recently? | Conversation context | GIN on `pcg_edges(from_id, to_id, event_time)` | Per-user LRU 5 min |
| Who is the user likely to talk to next? | Predictive context | Aggregate view: top-50 by `spoke_to` freq × recency | Nightly |
| What utterances were accepted about topic T? | **Suggestion retrieval** | pgvector similarity + `topic_id` filter | Per-user LRU 60s |
| What is the user's vocabulary for person P? | Relationship vocabulary | Aggregate view: utterances by participant | Nightly |
| What routines does the user have? | Routine intelligence | Routine table + occurrence count | Weekly |

---

## 5. Retrieval & ranking `[PRD §17]`

### 5.1 Six-step retrieval flow `[PRD §17.1]`

1. **Query construction** — from the fused Context Vector, build 3 parallel queries:
   (a) semantic (pgvector similarity), (b) subgraph (Graphiti/graph pattern match),
   (c) keyword (BM25 on utterance text).
2. **Hybrid retrieval** — each query returns top-50; merge + dedupe → ~80–120
   unique candidates.
3. **Cross-encoder re-ranking** — score each candidate against the Context Vector;
   keep top-20. *(MVP simplifies the cross-encoder — see
   [§11](#11-known-deviations).)*
4. **Policy filter** — the Safety Agent removes candidates that violate policy
   (consent-tier visibility, high-stakes constraints). Typical post-filter: 12–18.
5. **Confidence scoring** — each candidate gets a confidence score
   ([§7](#7-confidence-scoring--gates)); `<0.5` dropped, `0.5–0.8` marked *sandbox*,
   `≥0.8` marked *ship*.
6. **Final ranking** — the Adaptive Ranker (online logistic regression) orders
   survivors by predicted acceptance; **top-5 presented**.

### 5.2 Adaptive ranker `[PRD §17.2]`

Online logistic regression, per-user weights. Feature categories, initial weights,
and learning rates:

| Feature category | Examples | Initial weight | Learning rate |
|---|---|---|---|
| Relevance | cosine sim, BM25, cross-encoder score | 0.35 | 0.01 |
| Personal voice match | vocab overlap w/ Communication DNA, syntax match | 0.20 | 0.005 |
| **Safety** | **PCG tier (3=high), source (user > family > LLM)** | **0.15** | **0 (hard constraint)** |
| Recency | time since last use, time since PCG addition | 0.15 | 0.008 |
| Variety | dissimilarity from recently-presented suggestions | 0.10 | 0.005 |
| Context match | partner / location / routine match | 0.05 | 0.003 |

> **The Safety feature has learning rate 0.** It is a hard constraint, never a
> learned weight. Encode this so it cannot drift.

### 5.3 Cold start `[PRD §17.3]`

New user = no PCG, no ranker weights. Phases: Day 0 pre-populate PCG + default
weights (first suggestion < 3 min); Days 1–7 confidence threshold raised to 0.7
(conservative, "still learning"); Days 8–30 relax to default; Day 30+ warm.
For the **MVP demo the PCG is pre-seeded**, so we operate as if warm but keep the
default-weights path.

### 5.4 Anti-mirroring `[PRD §17.4]`

The ranker must not learn to *mirror* the user's impairment (only ever suggesting
short telegraphic utterances because that's what the user accepts). Mitigation: a
small (5%) capability-expansion reward boost for accepted suggestions slightly above
current production level, decaying as they're accepted. MVP-optional but the seam
should exist.

---

## 6. Privacy tiers `[PRD §13.4]`

| Tier | Name | Visible to | Examples | Storage |
|---|---|---|---|---|
| 0 | Ephemeral | HalfSaid internal only (no user visibility) | Raw audio buffer, transient ASR hypotheses, intermediate embeddings | In-memory; discarded after 24h |
| 1 | User-only | User only | Private thoughts, journal entries, sensitive emotions | Encrypted at rest; never shared without explicit per-item consent |
| 2 | Family+ | User + designated Care Circle | Daily episodes, relationship patterns, routines | Encrypted; access logged; revocable per recipient |
| 3 | Clinician+ | User + clinicians (SLP, neurologist) + opt-in research | Therapy data, FCM ratings, outcome measures | Encrypted; access logged; SMART-on-FHIR scoped |

**Enforcement (`[PRD §13.4]`, Principle 7 "Privacy as Architecture"):**

- Tier visibility is enforced by **Postgres Row Level Security**, not application
  code. **There is no admin role that can read Tier 1 data.**
- Write **RLS tests that prove** a non-owner (including any elevated role) cannot
  read Tier 1 rows. The API layer cannot bypass tier enforcement.
- The PRD's full design derives per-row encryption keys from user/recipient/clinician
  secrets. MVP models tier enforcement via RLS; per-row encryption-key derivation is
  a documented deviation ([§11](#11-known-deviations)).

---

## 7. Confidence scoring & gates `[PRD §22.2–22.3]`

### 7.1 Scoring pipeline `[PRD §22.2]`

Each suggestion gets a calibrated 0–1 confidence from five inputs:

1. **Retrieval score** (0–1) — cosine similarity + BM25 of the top PCG item.
2. **Generation log-prob** (0–1) — constrained-decoding log-prob (high for
   constrained items).
3. **PCG source tier** (0.5–1.0) — Tier 3 (clinician) = 1.0; Tier 2 (family) = 0.85;
   Tier 1 (user) = 0.7; cold-start = 0.5.
4. **Context match** (0–1) — cross-encoder score vs current Context Vector.
5. **Historical accept rate** (0–1) — user's accept rate for similar suggestions.

Combined via a weighted geometric mean (weights learned per user), calibrated via
Platt scaling; recalibrate if ECE > 0.05. *(MVP simplifies calibration — see
[§11](#11-known-deviations).)*

### 7.2 Three threshold gates `[PRD §22.3]`

| Confidence | Action | UI treatment | Audit log |
|---|---|---|---|
| **≥ 0.8** | **Ship** | Standard suggestion card; TTS playback after 1.5s preview | Full provenance logged |
| **0.5 – 0.8** | **Sandbox** | Card marked *"HalfSaid is unsure — review carefully"*; extended **4s** preview; TTS only on explicit tap | Full provenance + `sandbox` flag |
| **< 0.5** | **Refuse** | **No suggestion surfaced.** System says *"I don't have a confident suggestion"* and offers alternatives (type, switch mode, ask SLP) | Refusal event logged |

The refusal path is a **first-class feature**. Implement it properly; it will (and
should) fire in the demo.

### 7.3 High-stakes hard block `[PRD §22.4]` — stub for MVP

In high-stakes contexts (medical / legal / financial / emergency / end-of-life),
free retrieval is **disabled** and only Tier 3 (clinician-approved) Sandbox items
are surfaced. Detection uses location + partner identity + topic, and is
conservative (ambiguous → high-stakes).

**MVP:** do **not** implement context detection, **but** the interception seam must
exist and be **tested with a forced flag** (i.e. when `highStakes=true` is forced,
retrieval is restricted / suggestions blocked to Tier-3-only). This proves the seam
before the detector exists.

---

## 8. Safety architecture

The Hard Rule ([§0 Rule 1](#rule-1--the-hard-rule-verbatim-prd-221)) as executable
code lives in **`packages/safety-policy`**.

- **Structural guarantee:** the generation interface constructs a suggestion
  candidate **only** from PCG item IDs. A raw model completion string has *no path*
  to becoming a user-facing candidate. Enforce via types + runtime checks.
- **Test that fails if the path opens:** a unit test in `packages/safety-policy`
  (and `tests/safety/`) asserts that attempting to build a candidate from a
  free-form string is rejected, and that every emitted candidate carries ≥1 PCG
  source item ID.
- **Explanation = provenance only** `[PRD §22.6]`. Cite the actual PCG node/edge IDs
  a suggestion derived from ("I suggested this because you said X to Y on date Z").
  **Never** generate a plausible-sounding reason. If a suggestion cannot be grounded
  in PCG items, the Safety Agent rejects it.
- **Hallucination SLO** `[PRD §22.8]`: `<0.1%` of suggestions hallucinated (content
  not derivable from PCG items). Automated check: every suggestion must have ≥1 PCG
  source item, else it is a hallucination. This is a **hard SLO (0 error budget)**.
- **Audit log** `[PRD §22.7]`: every suggestion logged with context hash, retrieval
  hits (PCG IDs), generation trace, ranking trace, safety trace, confidence, final
  text, and user action. (MVP logs the demo-relevant subset; schema leaves room for
  the rest.)

---

## 9. License bans (hard) `[PRD §11.2]`

These are **excluded from the dependency tree entirely**; CI must **fail** if any
appears. A custom license-audit script enforces this `[PRD §24.3]`.

| Banned tech | License | Reason | Use instead |
|---|---|---|---|
| Neo4j Community | GPLv3 | Viral copyleft as a service | Graphiti on Postgres (Apache 2.0) |
| Plausible | AGPL-3.0 | Network copyleft | PostHog (MIT) |
| XTTS v2 (Coqui) | CPML | Non-commercial | OpenVoice v2 (MIT) — post-MVP |
| NLLB-200 (Meta) | CC-BY-NC 4.0 | Non-commercial | LLM-based translation |
| Seamless M4T v2 (Meta) | CC-BY-NC 4.0 | Non-commercial | LLM-based translation |
| Terraform ≥ 1.6 | BSL 1.1 | Competitive-use restricted | OpenTofu (MPL 2.0) |

**Piper TTS is GPL-3.0** and may **only ever be invoked as a subprocess, never
linked** `[PRD §11.2]`. Not relevant to the MVP (we use browser `SpeechSynthesis`),
but the rule is encoded now so it is never violated later.

Also note the settled architectural choices (do not re-litigate) `[PRD §12.3]`:
Postgres + pgvector + Graphiti (not Neo4j) · Supabase (not Firebase) · Cloudflare
Pages (not Vercel — Vercel Hobby prohibits commercial use) · Groq as primary LLM ·
constrained decoding over free-form generation · RAG over fine-tuning.

---

## 10. SLOs `[PRD §25.1]`

| SLO | Target | Measurement | Error budget |
|---|---|---|---|
| Suggestion latency (P50) | < 1.0s | End-of-speech → audible suggestion | 5% |
| Suggestion latency (P95) | < 1.5s | same | 1% |
| Suggestion latency (P99) | < 2.5s | same | 0.1% |
| Availability | 99.9% | Successful request rate | 43 min/month |
| **Hallucination rate** | **< 0.1%** | Weekly audit | **0% (hard SLO)** |
| Voice cloning quality (MOS) | > 4.0/5 | Monthly survey | N/A (target) — post-MVP |
| ASR WER (per user) | < 30% | Per-user weekly | 10% |
| Onboarding time | < 3 min | Install → first suggestion | 5% |

Latency budget per stage `[PRD §16.5]` (end-of-speech → audible, target 1.5s):
VAD→ASR 50ms · ASR streaming 200ms/chunk · final ASR 300ms · intent+paraphasia+
correction 300ms · PCG retrieval 100ms · constrained generation 200ms · rank+safety+
confidence 100ms · TTS 300ms.

Agent critical path `[PRD §18.3]`: Intent∥Retrieval (~200ms) → Generation (200ms) →
Ranking (50ms) → Safety∥Confidence (50ms) → Explanation (150ms) ≈ 650ms compute,
within the 1.5s budget.

---

## 11. Known deviations (MVP simplifications vs PRD)

Every MVP simplification against the PRD is recorded here with chapter reference and
reason. Add to this list as deviations are made.

| # | Deviation | PRD ref | Reason |
|---|---|---|---|
| D1 | Cross-encoder re-rank (step 3) replaced with a cheaper scorer (e.g. cosine + BM25 blend) for MVP | §17.1 | No fine-tuned cross-encoder in 48h; the seam stays so it can be swapped in |
| D2 | Confidence calibration (Platt/isotonic, weekly ECE recalibration) approximated with a fixed weighted geometric mean; each input is floored (0.4) so one weak signal can't zero the score; generation log-prob is a fixed proxy (constrained items are high) | §22.2 | No accept/reject history and no LLM decoder at demo time |
| D3 | Privacy-tier enforcement via RLS only; per-row encryption-key derivation not implemented | §13.4 | RLS proves the visibility guarantee (incl. "no admin reads Tier 1") without the key-management build-out |
| D4 | ~~High-stakes context **detection** not implemented; interception seam + forced-flag test only~~ **Resolved (gap-closure pass, 2026-07-25):** `detectHighStakes()` scans the utterance text for medical/legal/financial/consent topics; a hit forces the constrained path (no free generation), restricts to Tier 3, and the response carries `highStakes` + category for the UI shield. Forced flag retained | §22.4 | A wrong word about medication or a signature is exactly the hallucination class the Hard Rule targets; text-based detection was cheap and testable. Location/partner detection still post-MVP |
| D5 | `supersedes` / `known_at` modeled via `superseded_by` / `ingestion_time` columns rather than materialized edges | §13.2–13.3 | Column form is sufficient for MVP correction/audit; edge enum retained for full model |
| D6 | TTS is browser `SpeechSynthesis`; no OpenVoice / voice cloning / watermark | §31.1 | Explicit MVP decision; clean seam left |
| D7 | ~~Embeddings: source/model for the 1024-d vectors is TBD (see open question O2)~~ **Resolved (gap-closure pass):** Google **`gemini-embedding-001`** truncated to 1024-d via `outputDimensionality` and L2-renormalized (`GeminiEmbedder`); selected whenever `GEMINI_API_KEY` is set. Seed backfill + query-time + **ingest-time** embedding all use it; the live Supabase graph is fully re-embedded (`apply-supabase.mjs --re-embed`) | §14 | Free tier, 1024-d capable, verified live: "phone my daughter" → "Call my daughter." at 0.983 cosine with zero token overlap |
| D8 | ASR/LLM available in **fixture/mock mode**; no live keys required for dev/CI | working agreements | CI must run green without secrets |
| D9 | Auth via Supabase **email magic-link**, not GitHub OAuth | §31.1 | Avoids external OAuth app config for the demo (O1) |
| D10 | Embeddings from a **hosted free embedder**; seed vectors **committed as fixtures**, query tests use cached/mocked embeddings | §14 | Keeps CI green without secrets while getting real semantic quality for the curated seed (O2) |
| D11 | RLS is **owner-only** for MVP: an authenticated user reads only their own PCG (all tiers). Cross-user Tier 2 (family) / Tier 3 (clinician) sharing needs a grants/relationship model, deferred post-MVP | §13.4 | Single-user Maya demo; `privacy_tier` is stored and the RLS seam is ready for cross-user policies |
| D12 | Seed embeddings are **NULL at seed time**, backfilled by the embedder in Phase 3 | §14 | The 200-node seed loads and is graph-complete without an embedding key; retrieval backfills (relates to D10) |
| D13 | Data-layer tests (schema/bi-temporal/RLS/seed) run the real migrations on **PGlite** (Postgres compiled to WASM) instead of a Dockered Supabase stack; migrations stay Supabase-native | §24.4 | Docker-free, secret-free CI. Requires Jest with `NODE_OPTIONS=--experimental-vm-modules` (wired into `npm test`) |
| D14 | Dev/CI embeddings use a **deterministic bag-of-words `MockEmbedder`** (1024-d); the hosted embedder (D10) is a placeholder not exercised without a key | §14 | No embedding key in CI; BoW gives enough token-overlap signal over the curated seed |
| D15 | A **4th retrieval source — a predictive salience/recency prior** (PRD §13.6) — is added alongside semantic/subgraph/keyword so a generic opener ("I want to…") surfaces habitual phrases; near-variants are de-duplicated | §17.1 | Pure semantic/keyword can't connect a bare opener to "call Sarah"; the prior is how the demo three emerge without hardcoding |
| D16 | `/v1/*` handlers are framework-agnostic (`Request`→`Response`) with **auth + DB executor injected**; the Next.js routes wire them. In **mock mode** the DB is a single in-memory **PGlite** (migrations+seed+embeddings) and auth is a header/demo-user; the **real per-request Postgres executor is stubbed** (throws unless mock mode) | §12, §24.1 | Whole API runs offline without Supabase for the demo/CI; real Postgres + JWT wiring is a deploy concern (Phase 7). Mock DB shares one session, so it is single-user only |
| D17 | ASR is **record-then-transcribe** (near-real-time) via a `/api/v1/asr` proxy to Groq Whisper large-v3, not token-by-token streaming. **Softened (gap-closure pass):** while recording, the browser Web Speech API streams a **live interim transcript** (display only; Whisper stays the final text), and an AnalyserNode **VAD auto-stops** after ~1.8s of post-speech silence (20s hard cap) — no second tap needed | §16 | MediaRecorder + a single Groq transcription call is enough for the demo; the streaming/chunked pipeline is post-MVP. The interim display removes the 2–4s dead zone; auto-stop removes a motor-control barrier |
| D18 | **Real Supabase** is now wired: schema + seed applied via `scripts/apply-supabase.mjs` over the **IPv4 session pooler** (direct `db.<ref>` host is IPv6-only); the real per-request RLS-scoped `pg` executor replaces the D16 stub. The demo still authenticates as Maya (mock auth) over the real DB; full JWT sign-in is post-MVP | §12, §24.1 | Real persistent Postgres for the demo; the mock PGlite DB remains the secret-free fallback for dev/CI |
| D19 | **Deploy target is a Node host, not Cloudflare Pages/Workers** for now. The API is Node-runtime (`pg` over TCP, `node:fs`, PGlite/WASM), which `@cloudflare/next-on-pages` (Edge-only) can't build. A real Cloudflare port needs `@opennextjs/cloudflare` + a Workers-safe Postgres path — tracked in [docs/DEPLOY.md](DEPLOY.md) | §11.1, §24.1 | The MVP is verified end-to-end locally + in Playwright; the Cloudflare adaptation is post-MVP work, not a blocker for the demo |
| **D20** | **The Hard Rule is relaxed to RAG-grounded generation (owner decision).** User-facing suggestions are now **written by the LLM** (Groq Llama 3.3 70B) using retrieved PCG items as *context/information*, not constrained-decoded verbatim from PCG items. Grounding is **optional** (cold-start safe); the PCG grows via ingestion (`/v1/pcg/ingest` LLM-extracts entities into new nodes+edges). The constrained-decoding path (`buildCandidate`) remains as the **no-key and high-stakes fallback**, and its tests still pass. | §0 Rule 1, §22.1, §12.3 #4 | The constrained-only path returned the same salient items for every input (unusable) and crumbled on a cold/sparse PCG. **⚠️ Safety:** this reintroduces exactly the free-form hallucination risk the PRD's Hard Rule exists to prevent — words the aphasia user can't verify, in their voice. Accepted for the synthetic-persona demo; **a real clinical deployment must restore constrained decoding + clinical review** (see §0). |

**Phase-2 enhancement beyond the PRD (not a deviation):** an **append-only trigger**
on `pcg_nodes`/`pcg_edges` makes the bi-temporal "corrections supersede, never
overwrite" rule (SPEC §4.4) a hard DB invariant — content columns are immutable once
written; only `superseded_by` / `salience` / `weight` may change, and `embedding` is
write-once (NULL → value) to permit the Phase-3 backfill.

---

## 12. External API surface (MVP subset) `[PRD README §10.7]`

MVP implements the first three; the rest are post-MVP and listed for context.

| Endpoint | Method | Auth | Purpose | MVP? |
|---|---|---|---|---|
| `/v1/suggestions` | POST | Supabase JWT | Context in → ranked candidates + confidence + provenance out | ✅ done |
| `/v1/pcg/nodes` | GET/POST/PATCH/DELETE | Supabase JWT + RLS | CRUD; PATCH = append-only correction (supersede); DELETE revokes | ✅ done |
| `/v1/pcg/timeline` | GET | Supabase JWT | Memory Timeline, filterable (person/topic/emotion/language) + free-text `q` search + `limit`/`offset` paging with `total` | ✅ done |
| `/v1/pcg/ingest` | POST | Supabase JWT | Persist an utterance (embedded at insert, 2-min dedup, `spoken`/`transcript` source) + LLM entity extraction into new nodes/edges + `expresses`→Intent (D20) | ✅ done |
| `/v1/pcg/chat` | POST | Supabase JWT | Graph-building companion (chat only, never spoken): each message runs the full ingest pipeline, then an LLM reply acknowledges what was linked and asks a follow-up. Deterministic ack without a key | ✅ done |
| `/v1/pcg/graph` | GET | Supabase JWT | Mini-map slice: hub-ranked nodes + closed edge set + whole-graph totals (growth counter) | ✅ done |
| `/v1/federated/model`, `/v1/federated/aggregate` | GET/POST | Supabase JWT | Federated learning global model + masked-delta aggregation (see §18) | ✅ done |
| `/v1/episodes/{id}/replay` | GET | Clinician OAuth | Replay Studio data | ✗ post-MVP |
| `/v1/therapy/session` | POST | Clinician OAuth | Therapy Mode session | ✗ post-MVP |
| `/v1/voice/synthesize` | POST | JWT + consent | Cloned-voice TTS + watermark | ✗ post-MVP |
| `/v1/voice/verify` | POST | Public, rate-limited | Watermark verification | ✗ post-MVP |
| `/fhir/r4/*` | GET/POST | SMART-on-FHIR OAuth2 | FHIR resources | ✗ post-MVP |

**Every `/v1/suggestions` response carries confidence and provenance.** Typed
contracts are shared between client and server via `packages/shared-types`.

**Implementation** (`packages/api`, Next.js routes under `apps/web/app/api/v1`):
handlers are framework-agnostic `(Request, ApiDeps) → Response`, with the
authenticated user and an **RLS-scoped SQL executor injected**. The user comes from
the Supabase JWT, never the body; every query runs as that authenticated user so RLS
enforces owner-only access. In **mock mode** the API runs against an in-memory PGlite
seeded with Maya — no Supabase needed (deviation D16). Verified end-to-end under
`next dev`: `/v1/suggestions` returns the three demo candidates with confidence,
provenance, and a provenance-derived explanation.

---

## 13. UX & accessibility (MVP-relevant) `[PRD §10]`

- **Conversation Canvas (Screen 1)** `[PRD §10.3]`: top = conversation context;
  middle = 1–5 suggestion cards, each showing the candidate, a **source tag**
  (`yours` / `family-validated` / `therapist-approved`), a **confidence bar**, and
  **tap-to-accept / long-press-to-edit**; bottom = input bar with **mic, type,
  emergency** buttons.
- **Accessibility is a gate, not polish** `[PRD §10.1]`: WCAG 2.2 **AA** floor on
  all surfaces; **AAA** on the suggestion-acceptance path. Min **44×44pt** touch
  targets. Full keyboard operability. Correct focus management when suggestions
  update (**do not steal focus mid-interaction**). Screen-reader-correct **live
  regions** for the streaming transcript. **`axe-core` in CI with zero violations —
  a violation fails the build.**
- **The accept/edit/reject gesture is the most important UX decision** `[PRD §10.7]`:
  trivially easy, unambiguous (no accidental accepts), reversible (undo within 5s),
  emotionally neutral (no "you rejected the AI" guilt).
- **Cognitive load budget** `[PRD §10.4]`: ≤5 suggestions at once; candidate length
  ≤8 words for moderate-severe aphasia (Maya); audio cues off by default.

**Implemented** (`apps/web/components/canvas`): `SuggestionCard` (candidate + source
tag + `role=meter` confidence bar + provenance explanation, with Accept / Edit /
Dismiss as real ≥44px keyboard-operable buttons), `InputBar` (mic / labelled text /
emergency), and `ConversationCanvas` (aria-live transcript + a `role=status` that
announces new suggestions without stealing focus; focus returns to the input after
each action). Mic → Groq Whisper (`useAsr` → `/api/v1/asr`); accepted cards are
spoken via browser `SpeechSynthesis` (`tts.ts`). The refusal path is a first-class
card. Tested with **jest-axe (zero violations)**, wired into CI as `test:a11y`.

---

## 14. Clinician dashboard (MVP) `[PRD §27, §31.1]`

- **FCM trend chart** — Functional Communication Measure over time. **The FCM data
  is mock and must be visibly labelled as such in the UI.** Do not render synthetic
  clinical scores in a way that could be mistaken for real measurement.
- **Conversation log** — the log entries produced by demo exchanges (each accept
  writes one).

**Implemented** (`apps/web/components/clinician`, `app/clinician`): `FcmTrendChart`
(inline-SVG FCM trend, visibly **MOCK DATA**, `role=img` summary + hidden data table)
and `ConversationLog` (recent utterances from `/v1/pcg/timeline`, tagged by source
tier). Each accepted phrase spoken on the Canvas is persisted as an Utterance
(`/v1/pcg/nodes`) and appears here. Verified end-to-end in a browser against **real
Supabase**: accepting "call Sarah" on the Canvas surfaced it in the log. Tested with
jest-axe (zero violations).

---

## 15. Tech stack (MVP) `[PRD §11.1]`

| Layer | Choice | License | Notes |
|---|---|---|---|
| Web assets | Cloudflare Pages | proprietary (free) | Deploy target |
| DB + vectors | Supabase Postgres + pgvector | Apache 2.0 | 500MB free |
| Auth | Supabase Auth | Apache 2.0 | GitHub OAuth for demo |
| Graph (temporal KG) | Graphiti on Postgres | Apache 2.0 | **not** Neo4j |
| LLM (internal ops only) | Groq Llama 3.3 70B (primary), Gemini 2.0 Flash | Llama Community / Gemini ToS | never user-facing text |
| ASR | Groq Whisper large-v3 | MIT weights | streaming |
| TTS (MVP) | browser `SpeechSynthesis` | n/a | OpenVoice seam left |
| CI/CD | GitHub Actions | free | see §16 |

**Fixture/mock mode is mandatory** so every layer is developable and testable
without Groq/Gemini credentials, and CI runs green without secrets.

---

## 16. CI pipeline `[PRD §24.3]`

GitHub Actions on every PR (`.github/workflows/ci.yml`), all runnable **without
secrets** (mock mode). Implemented ✅ / planned ✗:

1. ✅ **Build** — runs first so `next build` generates the types the typecheck needs.
2. ✅ **Typecheck** — `tsc --noEmit` across all workspaces.
3. ✅ **Lint** — Prettier + ESLint.
4. ✅ **Unit + integration tests** — Jest, incl. the PGlite RLS/bi-temporal/seed suites
   and API handler tests. (80% coverage enforcement is still ✗, added as suites grow.)
5. ✅ **Accessibility** — `test:a11y` (jest-axe), **zero violations required**.
6. ✅ **License audit** — custom script, fails on GPLv3 / AGPL / CPML / CC-BY-NC.
7. ✅ **E2E** — Playwright on the 3-minute demo path (`next start`, mock mode).
8. ✅ **Security scan** — Semgrep + Trivy (a parallel job; Snyk optional if
   `SNYK_TOKEN` is set).
9. ✗ **Deploy** — Cloudflare Pages preview is deferred; the app targets a Node host
   (deviation D19, [docs/DEPLOY.md](DEPLOY.md)).

---

## 17. Open questions

Tracked live; see the implementation plan and [CLAUDE.md](../CLAUDE.md).
**O1, O2, O4 resolved 2026-07-24** (session one); recorded below and in
[§11 Known Deviations](#11-known-deviations).

- **O1 — RESOLVED → email magic-link.** Auth for the demo uses Supabase email
  magic-link / OTP rather than GitHub OAuth `[PRD §31.1]`, to avoid external OAuth
  app config. Deviation **D9**.
- **O2 — RESOLVED → hosted free embedding API.** 1024-d vectors come from a hosted
  free-tier embedder (normalized to 1024-d to match the Context Vector `[PRD §14]`).
  **CI/no-secrets implication (D10):** seed embeddings are computed once at seed time
  and **committed as fixtures**, and query-path tests use cached/mocked embeddings, so
  CI stays green without secrets. Live embedding calls happen only when explicitly
  seeding or when a key is present.
- **O3 — RESOLVED → npm workspaces.** MVP monorepo uses npm workspaces over the
  README `[§8]` subset (`apps/web`, `packages/*`, `supabase/`); pnpm/Turborepo not
  needed at MVP scale.
- **O4 — RESOLVED → Next.js route handlers.** `/v1/*` run as Next.js route handlers
  (single Cloudflare Pages deployable); `packages/safety-policy` runs in-process with
  shared TS types. Supabase Edge Functions deferred.

---

## 18. Federated privacy-preserving PCG learning `[feature]`

**Goal.** Let clinics collaboratively improve the shared **communication model** (the
adaptive ranker, §5.2) — so a phrase pattern one clinic's patients respond to helps
everyone — **without any patient's raw communication data or PCG ever leaving the
clinic.** Implemented in `packages/federated` + `/v1/federated`.

### 18.1 What is federated

Only the ranker **weight vector** (6 numbers: relevance, personalVoice, safety,
recency, variety, contextMatch) is shared. Utterances, features, episodes, edges —
none of it is transmitted. Each clinic trains locally on its own accept/reject
feedback and emits a single masked, noised weight **delta**.

### 18.2 The round (per clinic, then aggregate)

```
on-clinic (never leaves):   local logistic step on this clinic's feedback  →  Δw
  ↓  clip                    Δw scaled to ‖Δw‖₂ ≤ C          (bounds sensitivity)
  ↓  differential privacy    Δw += N(0, σ²)  where σ = C·√(2 ln(1.25/δ)) / ε
  ↓  secure-agg mask         Δw += Σ_pairs ±PRG(seed(a,b))   (pairwise, cancel in sum)
  ── transmit masked Δw only ─────────────────────────────────────────────────────►
aggregator:                  mean(masked Δw)  ==  mean(true Δw)   (masks cancel)
  ↓  apply                    w ← w + mean(Δw),  Safety component pinned (LR 0)
```

### 18.3 Guarantees (each has a test in `packages/federated`)

- **No raw data leaves.** The wire type `ClinicUpdate` is structurally `{ clinicId,
  maskedDelta, sampleCount }` — no features/utterances/PCG. There is **no API that
  accepts raw feedback**; `/v1/federated/aggregate` takes only masked deltas.
- **Secure aggregation.** Pairwise masks sum to zero, so the aggregator recovers the
  **mean** of the true updates and **never sees any individual clinic's update**
  (`mean(masked) === mean(raw)`, proven to 1e-9).
- **Differential privacy.** Gradient clipping (sensitivity C) + the Gaussian
  mechanism give each round **(ε, δ)-DP** per clinic; a `PrivacyLedger` accounts the
  budget across rounds (basic composition).
- **Safety stays pinned.** The Safety feature's learning rate is 0 — it cannot drift
  through federation any more than through the single-user ranker (§5.2).
- **It works.** Three clinics with disjoint synthetic feedback cut held-out logistic
  loss over 20 rounds while sharing only masked deltas.

### 18.4 Threat model

- **Honest-but-curious aggregator:** sees only masked deltas (secure agg) — learns
  nothing about an individual clinic, and each delta is DP-noised regardless.
- **Curious clinic:** sees only the global aggregate model, never another clinic's
  data or update.
- **Out of scope for MVP:** dropout-robust masking (Bonawitz double-masking),
  malicious-aggregator verification, advanced (RDP) composition — noted for later.

### 18.5 API + storage

- `GET /v1/federated/model` → the current aggregate weights + round.
- `POST /v1/federated/aggregate` → masked `updates[]` + `dp{ε,δ}` → new model
  (Safety pinned), round advanced, budget logged.
- Migration `0003_federated.sql`: `federated_model` (singleton aggregate weights) and
  `federated_round_log` (round, clinic count, ε/δ spent). **Aggregate only — no
  patient data.** RLS on; readable by clinicians, written by the aggregator.

Verified end-to-end against real Supabase: three clinics' masked deltas advanced the
global model (relevance 0.35 → 0.55) with Safety pinned at 0.15 and the round logged.

---

## 19. Gap-closure pass (2026-07-25) `[Gap Analysis & Improvement Review]`

An external gap analysis compared the codebase against PRD v1.0 and proposed 15
demo-impact enhancements across three tiers. All were implemented (or deliberately
resolved) in this pass:

| # | Enhancement | Status | Where |
|---|---|---|---|
| 1 | Real embeddings | ✅ `gemini-embedding-001` @1024-d, seed backfill + query + ingest-time; live graph re-embedded (D7) | `packages/retrieval/embeddings.ts`, `scripts/apply-supabase.mjs --re-embed` |
| 2 | Live streaming transcript | ✅ Web Speech interim display while recording (Whisper stays the final text) (D17) | `lib/client/useAsr.ts` |
| 3 | Undo on accept | ✅ 5s undo toast; speech cancels; PCG persist deferred until the window closes | `components/canvas/UndoToast.tsx`, `ConversationCanvas.tsx` |
| 4 | Guided demo walkthrough | ✅ 4-step first-visit tour (accessible dialog, localStorage, replayable via ?) | `components/canvas/DemoWalkthrough.tsx` |
| 5 | Suggestion card animations | ✅ framer-motion spring + per-card stagger | `SuggestionCard.tsx` |
| 6 | PCG visualization mini-map | ✅ zero-dependency force-directed canvas (hub-ranked, typed colors, hover, a11y summary) on Canvas + clinician dashboard | `components/pcg/PcgMiniMap.tsx`, `/v1/pcg/graph` |
| 7 | Enhanced refusal UI | ✅ alternatives + **Teach a new phrase** → `/v1/pcg/ingest` → retry | `components/canvas/TeachPhrase.tsx` |
| 8 | Session statistics | ✅ LIVE-labelled activity card (total/7-day/active days/top phrases) computed from the timeline, beside the MOCK FCM chart | `components/clinician/SessionStats.tsx` |
| 9 | VAD auto-stop | ✅ AnalyserNode RMS silence detection (~1.8s), 20s hard cap (D17) | `lib/client/useAsr.ts` |
| 10 | Multi-persona switch | ✅ David (ALS, 70-node seed, own RLS scope) + segmented switcher; E2E proves his suggestions differ | `supabase/seed-david.sql`, `components/brand/PersonaSwitcher.tsx` |
| 11 | PCG growth counter | ✅ live nodes/edges chip, pulses when the graph grows after each utterance | `components/pcg/PcgGrowthChip.tsx` |
| 12 | Landing page metrics | ✅ compact stat strip (2M+ / 180k / 1 graph per person) inside the one-viewport hero | `components/landing/StatStrip.tsx` |
| 13 | Dark mode | ◐ **Resolved by design:** the redesign is a deliberate dark-only companion aesthetic (`color-scheme: dark`); a light theme over the glass/glow system is post-MVP. Reduced-motion is honoured globally; the print stylesheet is the light rendering | `globals.css` |
| 14 | Export conversation PDF | ✅ print-optimized `/clinician/report` (metadata, stats, utterance table, synthetic-data watermark) via browser print-to-PDF — zero deps | `app/clinician/report/page.tsx` |
| 15 | Keyboard shortcuts | ✅ 1–5 accept, M / Ctrl+M mic, Esc close; long-press a card to edit; never hijacks typing | `ConversationCanvas.tsx` |

Also closed from the gap report's §2.2 list: high-stakes **detection** (D4 resolved),
conversation-log **search + pagination** (`q`/`offset`/`total`), global **error
boundaries** (`app/error.tsx`, `app/global-error.tsx`), and **ingest-time
embeddings** so new utterances are semantically retrievable immediately.

### 19.1 Follow-up fixes (same day, post-review)

- **Hybrid suggestions (D20 refined).** LLM-only output ignored the graph's real
  answers ("Call my daughter" never surfaced "call Sarah"). `suggest()` now BLENDS:
  the ranked constrained candidates are first-class cards; when the best PCG match
  is strong (semantic ≥ 0.6 or keyword ≥ 0.5) the user's own phrases lead and the
  LLM fills the rest, de-duplicated on retrieval's normalization. Verified live:
  "Call my daughter" → `[PCG] call Sarah` above `[LLM]` cards.
- **The graph grows from every interaction.** Typed/spoken *input* is ingested too
  (`source: 'transcript'`), not just accepted suggestions; ingest also links the
  extracted intent (`expresses` edge), de-duplicates repeats within 2 minutes
  (API-ingested rows only — never seed rows), and tags rows tier 1 (`yours`).
- **Fresh nodes are visible.** `/v1/pcg/graph` blends the most recent nodes into
  the hub-ranked slice so a just-taught fact appears on the mini-map immediately.
- **Teach HalfSaid chat (`/ingest`).** A chat-only companion page: every message
  runs the full ingest pipeline (nodes + edges + embeddings), the reply confirms
  what was saved (entity chips in the UI) and asks a follow-up; the growth chip and
  mini-map update live. Verified live: a taught fact became the top PCG suggestion
  30 seconds later.
- **Bug fixes:** dismissing one generated card no longer hides all cards (dismissal
  is per-card, not per-provenance); navigating away during the undo window commits
  the accepted phrase (keepalive ingest) instead of silently dropping it.

---

*End of SPEC.md. Keep this file accurate; update the Known Deviations table and Open
Questions as the build proceeds.*
