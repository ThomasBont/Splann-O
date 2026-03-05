# Node Version Hygiene

## Recommended local version (nvm)

```bash
nvm install 20
nvm use 20
node -v
```

Expected major version: `20` (Node 22 is also supported by engines).

## Package engines

`package.json` declares:

```json
"engines": {
  "node": ">=20 <23"
}
```

This allows both Node 20 LTS and Node 22 while avoiding unsupported majors.

## Render / CI

Render and many CI systems can respect `engines.node` from `package.json`.
If your platform requires explicit pinning, set Node version to a compatible 20.x or 22.x runtime.

## Smoke test

Run:

```bash
npm run smoke
```

It validates:
- Node version is in supported range (`>=20 <23`)
- critical server modules import correctly without starting the HTTP server
- Passport setup entrypoint can be executed without module-format issues
