-- HalfSaid — David PCG seed (second demo persona, PRD vignette B).
-- ALL DATA IS SYNTHETIC (SPEC §14). Not a real person; no real clinical data.
-- David: 58, software engineer with ALS (dysarthria — precise mind, failing speech).
-- A deliberately DIFFERENT graph from Maya's: tech, fishing, woodworking, his wife
-- Anna — so persona switching visibly changes what the system suggests.
-- Embeddings are NULL here; the backfill step embeds them (SPEC D7/D10).

begin;

insert into public.users (id, name, dob, languages, conditions, ability_profile) values
  ('00000000-0000-4000-8000-000000000101', 'David', '1968-09-23', '{en}', '{"ALS (dysarthria)"}', '{"reading":"intact","speech":"deteriorating","typing":"slow"}'::jsonb)
  on conflict (id) do nothing;

insert into public.pcg_nodes (id, user_id, node_type, attributes, event_time, privacy_tier, salience) values
  -- self
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101', 'User', '{"name":"David","role":"self","condition":"ALS"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '3650 days'), 1, 0.5),
  -- people
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000101', 'Person', '{"name":"Anna","relationship":"wife","language_pref":"en"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000101', 'Person', '{"name":"Lily","relationship":"daughter","language_pref":"en"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000101', 'Person', '{"name":"Ray","relationship":"brother","language_pref":"en"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000101', 'Person', '{"name":"Dr. Osei","relationship":"neurologist","language_pref":"en"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 3, 0.5),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000101', 'Person', '{"name":"Sam","relationship":"speech-language pathologist","language_pref":"en"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 3, 0.5),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000101', 'Person', '{"name":"Marcus","relationship":"old colleague","language_pref":"en"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  -- places
  ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000101', 'Place', '{"name":"home","type":"home"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-00000000010a', '00000000-0000-4000-8000-000000000101', 'Place', '{"name":"the workshop","type":"home"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-00000000010b', '00000000-0000-4000-8000-000000000101', 'Place', '{"name":"the lake","type":"outdoors"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-00000000010c', '00000000-0000-4000-8000-000000000101', 'Place', '{"name":"the clinic","type":"clinic"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-00000000010d', '00000000-0000-4000-8000-000000000101', 'Place', '{"name":"the deck","type":"home"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  -- objects
  ('00000000-0000-4000-8000-00000000010e', '00000000-0000-4000-8000-000000000101', 'Object', '{"name":"my laptop","type":"device"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 1, 0.5),
  ('00000000-0000-4000-8000-00000000010f', '00000000-0000-4000-8000-000000000101', 'Object', '{"name":"the tablet","type":"device"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 1, 0.5),
  ('00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000000101', 'Object', '{"name":"my wheelchair","type":"mobility"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 3, 0.5),
  ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000101', 'Object', '{"name":"fishing rod","type":"hobby"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 1, 0.5),
  ('00000000-0000-4000-8000-000000000112', '00000000-0000-4000-8000-000000000101', 'Object', '{"name":"coffee mug","type":"kitchenware"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 1, 0.5),
  ('00000000-0000-4000-8000-000000000113', '00000000-0000-4000-8000-000000000101', 'Object', '{"name":"my medication","type":"health"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 3, 0.5),
  ('00000000-0000-4000-8000-000000000114', '00000000-0000-4000-8000-000000000101', 'Object', '{"name":"chess set","type":"hobby"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 1, 0.5),
  ('00000000-0000-4000-8000-000000000115', '00000000-0000-4000-8000-000000000101', 'Object', '{"name":"the breathing mask","type":"health"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 3, 0.5),
  -- routines
  ('00000000-0000-4000-8000-000000000116', '00000000-0000-4000-8000-000000000101', 'Routine', '{"name":"morning email","frequency":"daily","typical_time":"08:30"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-000000000117', '00000000-0000-4000-8000-000000000101', 'Routine', '{"name":"physio stretches","frequency":"daily","typical_time":"10:00"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-000000000118', '00000000-0000-4000-8000-000000000101', 'Routine', '{"name":"chess with Ray","frequency":"weekly","typical_time":"19:00"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-000000000119', '00000000-0000-4000-8000-000000000101', 'Routine', '{"name":"evening on the deck","frequency":"daily","typical_time":"18:00"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-00000000011a', '00000000-0000-4000-8000-000000000101', 'Routine', '{"name":"clinic check-in","frequency":"weekly","typical_time":"11:00"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  -- topics
  ('00000000-0000-4000-8000-00000000011b', '00000000-0000-4000-8000-000000000101', 'Topic', '{"name":"technology"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-00000000011c', '00000000-0000-4000-8000-000000000101', 'Topic', '{"name":"fishing"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-00000000011d', '00000000-0000-4000-8000-000000000101', 'Topic', '{"name":"woodworking"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-00000000011e', '00000000-0000-4000-8000-000000000101', 'Topic', '{"name":"family"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-00000000011f', '00000000-0000-4000-8000-000000000101', 'Topic', '{"name":"health"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  ('00000000-0000-4000-8000-000000000120', '00000000-0000-4000-8000-000000000101', 'Topic', '{"name":"chess"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 2, 0.5),
  -- intents
  ('00000000-0000-4000-8000-000000000121', '00000000-0000-4000-8000-000000000101', 'Intent', '{"type":"request"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 1, 0.5),
  ('00000000-0000-4000-8000-000000000122', '00000000-0000-4000-8000-000000000101', 'Intent', '{"type":"inform"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 1, 0.5),
  ('00000000-0000-4000-8000-000000000123', '00000000-0000-4000-8000-000000000101', 'Intent', '{"type":"question"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 1, 0.5),
  -- emotions
  ('00000000-0000-4000-8000-000000000124', '00000000-0000-4000-8000-000000000101', 'Emotion', '{"type":"calm","valence":0.5,"arousal":0.2,"source":"text"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 1, 0.5),
  ('00000000-0000-4000-8000-000000000125', '00000000-0000-4000-8000-000000000101', 'Emotion', '{"type":"determination","valence":0.6,"arousal":0.6,"source":"text"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 1, 0.5),
  ('00000000-0000-4000-8000-000000000126', '00000000-0000-4000-8000-000000000101', 'Emotion', '{"type":"love","valence":0.9,"arousal":0.4,"source":"text"}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'), 1, 0.5),
  -- utterances (David's precise, tech-flavored voice — habitual first, then variants)
  ('00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"call Anna","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '27 days'), 2, 0.97),
  ('00000000-0000-4000-8000-000000000131', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"check my email","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '26 days'), 1, 0.97),
  ('00000000-0000-4000-8000-000000000132', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"go out to the deck","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '25 days'), 1, 0.97),
  ('00000000-0000-4000-8000-000000000133', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"I need my tablet","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '24 days'), 1, 0.85),
  ('00000000-0000-4000-8000-000000000134', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"set up the chess board","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '23 days'), 1, 0.85),
  ('00000000-0000-4000-8000-000000000135', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"ask Ray about the game","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '22 days'), 2, 0.85),
  ('00000000-0000-4000-8000-000000000136', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"I want coffee","mode":"phrase","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '21 days'), 1, 0.65),
  ('00000000-0000-4000-8000-000000000137', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"adjust my chair, please","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '20 days'), 3, 0.85),
  ('00000000-0000-4000-8000-000000000138', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"show me photos of the lake","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '19 days'), 1, 0.85),
  ('00000000-0000-4000-8000-000000000139', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"tell Lily I am proud of her","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '18 days'), 2, 0.9),
  ('00000000-0000-4000-8000-00000000013a', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"I need a break","mode":"phrase","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '17 days'), 1, 0.65),
  ('00000000-0000-4000-8000-00000000013b', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"time for my medication","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '16 days'), 3, 0.9),
  ('00000000-0000-4000-8000-00000000013c', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"open the blinds","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '15 days'), 1, 0.85),
  ('00000000-0000-4000-8000-00000000013d', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"let''s watch the game tonight","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '14 days'), 1, 0.85),
  ('00000000-0000-4000-8000-00000000013e', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"thank you, love","mode":"phrase","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '13 days'), 2, 0.9),
  ('00000000-0000-4000-8000-00000000013f', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"drive out to the lake this weekend","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '12 days'), 1, 0.85),
  ('00000000-0000-4000-8000-000000000140', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"how is the project going","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '11 days'), 1, 0.85),
  ('00000000-0000-4000-8000-000000000141', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"I am tired now","mode":"phrase","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '10 days'), 1, 0.65),
  ('00000000-0000-4000-8000-000000000142', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"read me the news headlines","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '9 days'), 1, 0.85),
  ('00000000-0000-4000-8000-000000000143', '00000000-0000-4000-8000-000000000101', 'Utterance', '{"content":"bring my breathing mask","mode":"full_utterance","speaker":"David","language":"en","asr_score":null}'::jsonb, ('2026-06-01T09:00:00Z'::timestamptz - interval '8 days'), 3, 0.9);

insert into public.pcg_edges (user_id, edge_type, from_id, to_id, attributes, event_time) values
  -- call Anna → request, family, Anna, love
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000121', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'about', '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-00000000011e', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000103', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'evokes', '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000126', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- check my email → request, technology, laptop, morning email routine
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-000000000131', '00000000-0000-4000-8000-000000000121', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'about', '00000000-0000-4000-8000-000000000131', '00000000-0000-4000-8000-00000000011b', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-000000000131', '00000000-0000-4000-8000-00000000010e', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'participates_in', '00000000-0000-4000-8000-000000000131', '00000000-0000-4000-8000-000000000116', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- go out to the deck → request, deck place, evening routine, calm
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-000000000132', '00000000-0000-4000-8000-000000000121', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-000000000132', '00000000-0000-4000-8000-00000000010d', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'participates_in', '00000000-0000-4000-8000-000000000132', '00000000-0000-4000-8000-000000000119', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'evokes', '00000000-0000-4000-8000-000000000132', '00000000-0000-4000-8000-000000000124', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- I need my tablet → request, technology, tablet
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-000000000133', '00000000-0000-4000-8000-000000000121', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'about', '00000000-0000-4000-8000-000000000133', '00000000-0000-4000-8000-00000000011b', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-000000000133', '00000000-0000-4000-8000-00000000010f', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- chess board → request, chess, chess set, chess-with-Ray routine
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-000000000134', '00000000-0000-4000-8000-000000000121', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'about', '00000000-0000-4000-8000-000000000134', '00000000-0000-4000-8000-000000000120', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-000000000134', '00000000-0000-4000-8000-000000000114', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'participates_in', '00000000-0000-4000-8000-000000000134', '00000000-0000-4000-8000-000000000118', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- ask Ray about the game → question, chess, Ray
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-000000000135', '00000000-0000-4000-8000-000000000123', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'about', '00000000-0000-4000-8000-000000000135', '00000000-0000-4000-8000-000000000120', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-000000000135', '00000000-0000-4000-8000-000000000105', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- I want coffee → request, coffee mug
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-000000000136', '00000000-0000-4000-8000-000000000121', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-000000000136', '00000000-0000-4000-8000-000000000112', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- adjust my chair → request, health, wheelchair
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-000000000137', '00000000-0000-4000-8000-000000000121', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'about', '00000000-0000-4000-8000-000000000137', '00000000-0000-4000-8000-00000000011f', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-000000000137', '00000000-0000-4000-8000-000000000110', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- photos of the lake → request, fishing, the lake
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-000000000138', '00000000-0000-4000-8000-000000000121', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'about', '00000000-0000-4000-8000-000000000138', '00000000-0000-4000-8000-00000000011c', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-000000000138', '00000000-0000-4000-8000-00000000010b', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- tell Lily I am proud → inform, family, Lily, love
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-000000000139', '00000000-0000-4000-8000-000000000122', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'about', '00000000-0000-4000-8000-000000000139', '00000000-0000-4000-8000-00000000011e', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-000000000139', '00000000-0000-4000-8000-000000000104', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'evokes', '00000000-0000-4000-8000-000000000139', '00000000-0000-4000-8000-000000000126', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- medication → request, health, medication object
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-00000000013b', '00000000-0000-4000-8000-000000000121', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'about', '00000000-0000-4000-8000-00000000013b', '00000000-0000-4000-8000-00000000011f', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-00000000013b', '00000000-0000-4000-8000-000000000113', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- lake trip → request, fishing, the lake, Anna, determination
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-00000000013f', '00000000-0000-4000-8000-000000000121', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'about', '00000000-0000-4000-8000-00000000013f', '00000000-0000-4000-8000-00000000011c', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-00000000013f', '00000000-0000-4000-8000-00000000010b', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'evokes', '00000000-0000-4000-8000-00000000013f', '00000000-0000-4000-8000-000000000125', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- project question → question, technology, Marcus
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-000000000140', '00000000-0000-4000-8000-000000000123', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'about', '00000000-0000-4000-8000-000000000140', '00000000-0000-4000-8000-00000000011b', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-000000000140', '00000000-0000-4000-8000-000000000108', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  -- breathing mask → request, health, mask
  ('00000000-0000-4000-8000-000000000101', 'expresses', '00000000-0000-4000-8000-000000000143', '00000000-0000-4000-8000-000000000121', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'about', '00000000-0000-4000-8000-000000000143', '00000000-0000-4000-8000-00000000011f', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days')),
  ('00000000-0000-4000-8000-000000000101', 'mentioned', '00000000-0000-4000-8000-000000000143', '00000000-0000-4000-8000-000000000115', null, ('2026-06-01T09:00:00Z'::timestamptz - interval '30 days'));

commit;
