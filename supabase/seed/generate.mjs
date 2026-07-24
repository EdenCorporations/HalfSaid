#!/usr/bin/env node
/**
 * Maya PCG seed generator (SPEC §2, §4, PRD §31.1).
 *
 * Deterministically emits supabase/seed.sql: a synthetic 200-node Personal
 * Communication Graph for the demo persona — Maya, post-stroke Broca's aphasia,
 * retired English teacher — with family, places, objects, routines, topics,
 * episodes, and past utterances. The graph is built so the three demo candidates
 * ("call Sarah", "go to the garden", "read my book") EMERGE from retrieval over
 * seeded utterances rather than being hardcoded (Phase 3 wires retrieval).
 *
 *   node    Sarah  -> tier 2 (family-validated)
 *   node    garden -> tier 1 (yours)
 *   node    book   -> tier 3 (therapist-approved)
 * so the demo shows all three source tags.
 *
 * ALL DATA IS SYNTHETIC. Not a real person; no real clinical data (SPEC §14).
 *
 * Run: `node supabase/seed/generate.mjs` (writes supabase/seed.sql). Deterministic
 * — no Date.now()/random — so the committed SQL does not churn. Embeddings are left
 * NULL and are backfilled by the embedder in Phase 3 (SPEC deviation D7/D10).
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed.sql');

// Deterministic uuid from an integer counter (valid v4 layout).
const uid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const MAYA = uid(1);
let counter = 1;
const nextId = () => uid(++counter);

// Fixed base date (no Date.now, so output is stable). event_time = base - offset days.
const BASE = '2026-06-01T09:00:00Z';
const eventTime = (daysAgo) => `('${BASE}'::timestamptz - interval '${daysAgo} days')`;

const nodes = []; // { id, type, attrs, tier, daysAgo }
const edges = []; // { type, from, to, attrs? }
const slug = {}; // slug -> id

function addNode(key, type, attrs, tier = 1, daysAgo = 30) {
  const id = nextId();
  if (key) slug[key] = id;
  nodes.push({ id, type, attrs, tier, daysAgo });
  return id;
}
function addEdge(type, from, to, attrs = null, daysAgo = 30) {
  if (!from || !to) throw new Error(`edge ${type} missing endpoint`);
  edges.push({ type, from, to, attrs, daysAgo });
}

// --- User node (the account row is inserted separately below) ----------------
addNode('maya', 'User', { name: 'Maya', role: 'self', condition: "Broca's aphasia" }, 1, 3650);

// --- People (9) --------------------------------------------------------------
const people = [
  ['sarah', 'Sarah', 'daughter', 2],
  ['marcus', 'Marcus', 'son', 2],
  ['priya', 'Priya', 'speech-language pathologist', 3],
  ['drchen', 'Dr. Chen', 'neurologist', 3],
  ['elena', 'Elena', 'neighbor', 2],
  ['james', 'James', 'late husband', 1],
  ['grace', 'Grace', 'friend', 2],
  ['tom', 'Tom', 'grandson', 2],
  ['nora', 'Nora', 'former student', 2],
];
for (const [key, name, relationship, tier] of people) {
  addNode(key, 'Person', { name, relationship, language_pref: 'en' }, tier);
}

// --- Places (12) -------------------------------------------------------------
const places = [
  ['home', 'home', 'home'],
  ['garden', 'the garden', 'home'],
  ['kitchen', 'the kitchen', 'home'],
  ['livingroom', 'the living room', 'home'],
  ['bedroom', 'the bedroom', 'home'],
  ['clinic', 'the clinic', 'clinic'],
  ['cafe', 'the cafe', 'cafe'],
  ['library', 'the library', 'public'],
  ['park', 'the park', 'public'],
  ['church', 'the church', 'public'],
  ['market', 'the market', 'shop'],
  ['porch', 'the porch', 'home'],
];
for (const [key, name, type] of places) addNode(key, 'Place', { name, type }, 2);

// --- Objects (20) ------------------------------------------------------------
const objects = [
  ['book', 'my book', 'book', 3],
  ['teacup', 'teacup', 'kitchenware', 1],
  ['phone', 'phone', 'device', 1],
  ['glasses', 'glasses', 'personal', 1],
  ['blanket', 'blanket', 'comfort', 1],
  ['photoalbum', 'photo album', 'keepsake', 2],
  ['gardentools', 'garden tools', 'tool', 1],
  ['roses', 'the roses', 'plant', 1],
  ['tomatoes', 'the tomatoes', 'plant', 1],
  ['kettle', 'the kettle', 'kitchenware', 1],
  ['notebook', 'notebook', 'stationery', 1],
  ['pen', 'pen', 'stationery', 1],
  ['radio', 'the radio', 'device', 1],
  ['cardigan', 'cardigan', 'clothing', 1],
  ['slippers', 'slippers', 'clothing', 1],
  ['calendar', 'the calendar', 'organizer', 1],
  ['medication', 'my medication', 'health', 3],
  ['walker', 'the walker', 'mobility', 3],
  ['letters', 'the letters', 'keepsake', 1],
  ['poetry', 'poetry collection', 'book', 3],
];
for (const [key, name, type, tier] of objects) addNode(key, 'Object', { name, type }, tier);

// --- Routines (10) -----------------------------------------------------------
const routines = [
  ['morningcoffee', 'morning coffee', 'daily', '08:00'],
  ['gardentime', 'garden time', 'daily', '10:00'],
  ['afternoonreading', 'afternoon reading', 'daily', '14:00'],
  ['eveningcall', 'evening call to family', 'daily', '18:00'],
  ['therapy', 'speech therapy', 'weekly', '11:00'],
  ['churchsunday', 'sunday church', 'weekly', '09:30'],
  ['marketday', 'market day', 'weekly', '10:00'],
  ['teatime', 'afternoon tea', 'daily', '16:00'],
  ['walk', 'evening walk', 'daily', '17:00'],
  ['medsroutine', 'morning medication', 'daily', '08:30'],
];
for (const [key, name, frequency, time] of routines)
  addNode(key, 'Routine', { name, frequency, typical_time: time }, 2);

// --- Topics (8) --------------------------------------------------------------
const topics = [
  ['family', 'family'],
  ['gardening', 'gardening'],
  ['books', 'books and reading'],
  ['health', 'health'],
  ['food', 'food and cooking'],
  ['memories', 'memories'],
  ['weather', 'weather'],
  ['teaching', 'teaching and students'],
];
for (const [key, name] of topics) addNode(key, 'Topic', { name }, 2);

// --- Cultural context (1) ----------------------------------------------------
addNode('culture', 'CulturalContext', { name: 'English tea culture', register: 'warm-formal' }, 2);

// --- Emotions (12) -----------------------------------------------------------
const emotions = [
  ['joy', 'joy', 0.8, 0.5],
  ['calm', 'calm', 0.5, 0.2],
  ['frustration', 'frustration', -0.6, 0.7],
  ['love', 'love', 0.9, 0.4],
  ['pride', 'pride', 0.7, 0.5],
  ['sadness', 'sadness', -0.5, 0.3],
  ['hope', 'hope', 0.6, 0.4],
  ['tired', 'fatigue', -0.3, 0.2],
  ['gratitude', 'gratitude', 0.8, 0.3],
  ['worry', 'worry', -0.4, 0.6],
  ['contentment', 'contentment', 0.6, 0.2],
  ['nostalgia', 'nostalgia', 0.3, 0.3],
];
for (const [key, type, valence, arousal] of emotions)
  addNode(key, 'Emotion', { type, valence, arousal, source: 'text' }, 1);

// --- Intents (12) ------------------------------------------------------------
const intents = [
  ['request', 'request'],
  ['inform', 'inform'],
  ['greet', 'greet'],
  ['refuse', 'refuse'],
  ['thank', 'thank'],
  ['ask', 'question'],
  ['agree', 'agree'],
  ['express_feeling', 'express-feeling'],
  ['remember', 'reminisce'],
  ['suggest', 'suggest'],
  ['confirm', 'confirm'],
  ['farewell', 'farewell'],
];
for (const [key, type] of intents) addNode(key, 'Intent', { type }, 1);

// --- Episodes (25) -----------------------------------------------------------
const episodeKeys = [];
for (let i = 0; i < 25; i++) {
  const key = `ep${i}`;
  episodeKeys.push(key);
  addNode(
    key,
    'Episode',
    { summary: `conversation ${i + 1}`, modality: i % 3 === 0 ? 'typed' : 'spoken', outcome: 'ok' },
    2,
    28 - i,
  );
}

// --- Utterances (90) ---------------------------------------------------------
// Each entry: [content, tier, intentKey, topicKey, mentionKey?, emotionKey?, mode]
// tier -> source tag: 1=yours, 2=family-validated, 3=therapist-approved.
const baseUtterances = [
  // The three demo candidates (distinct tiers to show all three source tags):
  ['call Sarah', 2, 'request', 'family', 'sarah', 'love', 'full_utterance'],
  ['go to the garden', 1, 'request', 'gardening', 'garden', 'calm', 'full_utterance'],
  ['read my book', 3, 'request', 'books', 'book', 'contentment', 'full_utterance'],
  // "I want to ..." starters so the demo query connects:
  ['I want to call Sarah', 2, 'request', 'family', 'sarah', 'love', 'full_utterance'],
  ['I want to go to the garden', 1, 'request', 'gardening', 'garden', 'calm', 'full_utterance'],
  ['I want to read my book', 3, 'request', 'books', 'book', 'contentment', 'full_utterance'],
  ['I want tea', 1, 'request', 'food', 'teacup', 'calm', 'phrase'],
  ['I want to rest', 1, 'request', 'health', 'blanket', 'tired', 'phrase'],
  // Family:
  ['call Marcus', 2, 'request', 'family', 'marcus', 'love', 'full_utterance'],
  ['hello Marcus', 2, 'greet', 'family', 'marcus', 'joy', 'phrase'],
  ['hello Sarah', 2, 'greet', 'family', 'sarah', 'joy', 'phrase'],
  ['I love you', 1, 'express_feeling', 'family', 'sarah', 'love', 'phrase'],
  ['tell Tom hello', 2, 'request', 'family', 'tom', 'joy', 'full_utterance'],
  ['miss James', 1, 'express_feeling', 'memories', 'james', 'nostalgia', 'phrase'],
  ['thank you Priya', 3, 'thank', 'health', 'priya', 'gratitude', 'phrase'],
  // Garden:
  ['water the roses', 1, 'request', 'gardening', 'roses', 'calm', 'full_utterance'],
  ['pick the tomatoes', 1, 'request', 'gardening', 'tomatoes', 'joy', 'full_utterance'],
  ['sit on the porch', 1, 'request', 'gardening', 'porch', 'calm', 'full_utterance'],
  ['the garden is beautiful', 1, 'inform', 'gardening', 'garden', 'joy', 'full_utterance'],
  // Books / teaching:
  ['read poetry', 3, 'request', 'books', 'poetry', 'contentment', 'phrase'],
  ['find my glasses', 1, 'request', 'books', 'glasses', 'frustration', 'full_utterance'],
  ['I was a teacher', 1, 'inform', 'teaching', 'nora', 'pride', 'full_utterance'],
  ['write a letter', 1, 'request', 'books', 'letters', 'calm', 'phrase'],
  // Food / routine:
  ['make coffee', 1, 'request', 'food', 'kettle', 'calm', 'phrase'],
  ['tea please', 1, 'request', 'food', 'teacup', 'calm', 'phrase'],
  ['I am hungry', 1, 'inform', 'food', null, 'tired', 'phrase'],
  // Health:
  ['take my medication', 3, 'request', 'health', 'medication', 'calm', 'full_utterance'],
  ['I feel tired', 1, 'express_feeling', 'health', null, 'tired', 'phrase'],
  ['my head hurts', 3, 'inform', 'health', null, 'worry', 'phrase'],
  ['I am okay', 1, 'inform', 'health', null, 'calm', 'phrase'],
  // Places / outings:
  ['go to the park', 1, 'request', 'gardening', 'park', 'joy', 'full_utterance'],
  ['go to the cafe', 2, 'request', 'food', 'cafe', 'joy', 'full_utterance'],
  ['go to church', 2, 'request', 'memories', 'church', 'hope', 'full_utterance'],
  ['go to the market', 2, 'request', 'food', 'market', 'calm', 'full_utterance'],
  ['walk in the park', 1, 'suggest', 'health', 'park', 'calm', 'full_utterance'],
  // Feelings / social:
  ['good morning', 1, 'greet', 'weather', null, 'joy', 'phrase'],
  ['good night', 1, 'farewell', 'family', null, 'calm', 'phrase'],
  ['thank you', 1, 'thank', 'family', null, 'gratitude', 'phrase'],
  ['yes please', 1, 'agree', 'family', null, 'calm', 'phrase'],
  ['no thank you', 1, 'refuse', 'family', null, 'calm', 'phrase'],
  ['I am happy', 1, 'express_feeling', 'family', null, 'joy', 'phrase'],
];

// Pad to 90 with meaningful, deterministic combinations.
const activities = [
  ['open the window', 'weather', 'porch', 'calm'],
  ['close the door', 'home', 'home', 'calm'],
  ['turn on the radio', 'memories', 'radio', 'joy'],
  ['play some music', 'memories', 'radio', 'nostalgia'],
  ['look at the photos', 'memories', 'photoalbum', 'nostalgia'],
  ['bring my cardigan', 'health', 'cardigan', 'calm'],
  ['bring the blanket', 'health', 'blanket', 'tired'],
  ['find my slippers', 'home', 'slippers', 'calm'],
  ['check the calendar', 'family', 'calendar', 'calm'],
  ['read the letters', 'memories', 'letters', 'nostalgia'],
  ['call the doctor', 'health', 'drchen', 'worry'],
  ['visit Grace', 'family', 'grace', 'joy'],
  ['see Elena', 'family', 'elena', 'joy'],
  ['plant flowers', 'gardening', 'roses', 'hope'],
  ['make the bed', 'home', 'bedroom', 'calm'],
];
const padded = [...baseUtterances];
let ai = 0;
while (padded.length < 90) {
  const [content, topic, mention, emotion] = activities[ai % activities.length];
  // Vary phrasing deterministically so entries are not exact duplicates.
  const variant =
    padded.length % 2 === 0 ? content : `I want to ${content.replace(/^(the|my) /, '')}`;
  padded.push([variant, 1, 'request', topic, mention, emotion, 'phrase']);
  ai++;
}

padded.forEach((u, i) => {
  const [content, tier, intentK, topicK, mentionK, emotionK, mode] = u;
  const ep = episodeKeys[i % episodeKeys.length];
  const key = `utt${i}`;
  addNode(
    key,
    'Utterance',
    { content, mode, speaker: 'Maya', language: 'en', asr_score: null },
    tier,
    27 - (i % 25),
  );
  // Wire provenance edges so retrieval + subgraph traversal have signal.
  addEdge('expresses', slug[key], slug[intentK]);
  if (topicK) addEdge('about', slug[key], slug[topicK]);
  if (mentionK && slug[mentionK]) addEdge('mentioned', slug[key], slug[mentionK]);
  if (emotionK) addEdge('evokes', slug[key], slug[emotionK]);
  // Attach the utterance to an episode's place + participants.
  addEdge('precedes', slug[key], slug[episodeKeys[(i + 1) % episodeKeys.length]]);
});

// Episode structure: each episode occurs at a place; family participates; routines
// generate episodes.
const placeKeys = places.map((p) => p[0]);
episodeKeys.forEach((ep, i) => {
  addEdge('occurs_in', slug[ep], slug[placeKeys[i % placeKeys.length]]);
  addEdge('participates_in', slug[people[i % people.length][0]], slug[ep]);
  addEdge('generates', slug[routines[i % routines.length][0]], slug[ep]);
});

// A few relationship edges: Maya spoke_to family; people prefer a language.
addEdge('spoke_to', slug['maya'], slug['sarah']);
addEdge('spoke_to', slug['maya'], slug['marcus']);
addEdge('spoke_to', slug['maya'], slug['priya']);
addEdge('has_culture', slug['maya'], slug['culture']);

// Topic hierarchy.
addEdge('refined_by', slug['books'], slug['teaching']);
addEdge('refined_by', slug['family'], slug['memories']);

// ---------------------------------------------------------------------------
// Emit SQL.
// ---------------------------------------------------------------------------
const s = (v) => `'${String(v).replace(/'/g, "''")}'`;
const jb = (obj) => `${s(JSON.stringify(obj))}::jsonb`;

const lines = [];
lines.push(
  '-- HalfSaid — Maya PCG seed. GENERATED FILE — edit supabase/seed/generate.mjs, not this.',
  '-- ALL DATA IS SYNTHETIC (SPEC §14). Not a real person; no real clinical data.',
  "-- 200 nodes for the demo persona (post-stroke Broca's aphasia, retired English teacher).",
  '-- Embeddings are NULL here; the Phase 3 embedder backfills them (SPEC D7/D10).',
  '',
  'begin;',
  '',
  `insert into public.users (id, name, dob, languages, conditions, ability_profile) values`,
  `  (${s(MAYA)}, 'Maya', '1948-04-12', '{en}', '{"Broca''s aphasia"}', '{"reading":"intact","speech":"non-fluent"}'::jsonb)`,
  '  on conflict (id) do nothing;',
  '',
  'insert into public.pcg_nodes (id, user_id, node_type, attributes, event_time, privacy_tier) values',
);
lines.push(
  nodes
    .map(
      (n) =>
        `  (${s(n.id)}, ${s(MAYA)}, ${s(n.type)}, ${jb(n.attrs)}, ${eventTime(n.daysAgo)}, ${n.tier})`,
    )
    .join(',\n') + ';',
);
lines.push(
  '',
  'insert into public.pcg_edges (user_id, edge_type, from_id, to_id, attributes, event_time) values',
);
lines.push(
  edges
    .map(
      (e) =>
        `  (${s(MAYA)}, ${s(e.type)}, ${s(e.from)}, ${s(e.to)}, ${e.attrs ? jb(e.attrs) : 'null'}, ${eventTime(e.daysAgo)})`,
    )
    .join(',\n') + ';',
);
lines.push('', 'commit;', '');

writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(`seed: wrote ${nodes.length} nodes + ${edges.length} edges to ${OUT} (user ${MAYA}).`);
