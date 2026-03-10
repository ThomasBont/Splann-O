# Splanno Roadmap

> Refactor phases (0–3) zijn volledig afgerond. De gedetailleerde migratienotities zijn gearchiveerd in `docs/refactor-roadmap.md`.

## Afgeronde refactor-fasen

| Phase | Status | Beschrijving |
|-------|--------|--------------|
| **Phase 0** | ✅ Gedaan | Indexes, constraints, timestamps |
| **Phase 1** | ✅ Gedaan | User ID type consistency (text → integer FK) |
| **Phase 2** | ✅ Gedaan | Split logic extractie + componenten |
| **Phase 3** | ✅ Gedaan | Authz layer, audit logging, plan/tier model |

## Handige commando's

```bash
npm run dev          # Start dev server op http://localhost:5001
npm run db:migrate   # Voer openstaande migraties uit
npm run check        # TypeScript typecheck
npm run split:verify # Verifieer split/settlement logica
```
