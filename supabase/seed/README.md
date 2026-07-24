# supabase/seed

The **Maya PCG seed** (Phase 2) lives here: a synthetic 200-node Personal
Communication Graph for the demo persona — Maya, post-stroke Broca's aphasia, retired
English teacher — with family (Marcus, Sarah), places, routines, topics, and past
utterances rich enough that the three demo candidates (*"call Sarah"*, *"go to the
garden"*, *"read my book"*) **emerge from retrieval**, not from hardcoding
(SPEC §2, §4).

> **This data is entirely synthetic** and must be labelled as such in the file
> header of every seed file. It is not a real person and contains no real clinical
> data (SPEC §14).

Applied via `supabase db reset` (runs migrations, then seed). Not present yet — added
in Phase 2.
