# docs/

Project documentation for HalfSaid.

## Committed docs

- **[SPEC.md](SPEC.md)** — the authoritative, self-contained engineering
  specification for the MVP. Written so the repo can be understood and rebuilt
  **without** the PRD. Start here.

## The PRD is intentionally *not* committed

The product requirements document is confidential and is **excluded from git**:

| File | Status | Purpose |
|---|---|---|
| `docs/PRD_v1.0.pdf` | **gitignored** | Authoritative source; figures & diagrams live here |
| `docs/PRD_v1.0.md` | **gitignored** | `pdftotext` conversion — grep this, it's faster than the PDF |

Both are matched by `.gitignore` (`docs/*.pdf`, `docs/PRD_v1.0.md`). **Do not commit
them.** Because they are untracked, everything needed to build the MVP has been
distilled into [SPEC.md](SPEC.md); if SPEC.md and the PRD ever disagree, the PRD
wins and SPEC.md must be corrected.

### How to obtain the PRD

The PRD is shared out-of-band (not through this repo). If you are working on HalfSaid
and need it, request `PRD_v1.0.pdf` from the project owner and place it at
`docs/PRD_v1.0.pdf`.

To regenerate the grep-able text version (requires `poppler-utils`):

```bash
pdftotext -layout docs/PRD_v1.0.pdf docs/PRD_v1.0.md
```

`docs/PRD_v1.0.md` stays gitignored after regeneration. When citing the PRD in code
or docs, reference chapters as `[PRD §N]` so anyone with the PDF can trace it back.

## Not yet present

The intended full-vision layout (README §8) lists `docs/architecture/`,
`docs/runbooks/`, and `docs/trust-center/`. These are created as the corresponding
subsystems are built; they do not exist yet at MVP session one.
