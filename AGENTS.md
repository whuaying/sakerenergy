# Saker Energy repository guide

## Repository boundaries

- `docs/01-*` through `docs/12-*` and `data/fault_catalog.csv` are the original industrial product plan and acceptance baseline. They are not proof of an implemented backend or measured results.
- `web/`, `scripts/`, `tests/`, `package.json` and `render.yaml` implement the public marketing website and browser-local simulations.
- Never imply real telemetry, deployed customers, completed hardware integrations, achieved ROI or safety certification without new verified evidence.
- No website function may send equipment control commands. Pilot forms and simulations remain browser-local unless a future user request explicitly adds a backend and its data-handling contract.

## Website development

Read `docs/website/README.md`, `docs/website/DEVELOPMENT.md`, and `docs/website/CONTENT-AND-SCOPE.md` before changing the site.

Use Node.js 22 or later (Render uses Node.js 24):

```sh
npm run dev
npm run check
npm test
```

There are no npm runtime or build dependencies. `check` compiles eight static pages, fingerprints assets and checks syntax, local references, anchors, ARIA targets and the public output boundary. `test` verifies meaningful ROI and workflow invariants.

- Edit page content in `web/pages/`, the shared shell in `web/layout.html`, and visual styles in `web/assets/site.css`.
- `web/assets/models.js` holds explicitly synthetic fixtures and pure business models; `site.js` connects them to the UI.
- `station-scene.js` contains original 3D geometry projected onto Canvas 2D, not an imported WebGL or CAD model.
- Never deploy the repository root. Only publish `dist/`; internal product docs, test scripts and the fault catalog must remain outside it.
- Keep mobile layouts, keyboard access, reduced motion and non-uploading forms intact.

## Publishing

### Git synchronization

- The user requests that completed project updates be synchronized to GitHub automatically. After meaningful checks pass, commit the intended project changes, push to the configured remote, and verify that the remote branch matches the local commit. Report failures or remaining uncommitted work accurately.
- Keep credentials, private run records, local environments and account webpage captures out of commits. Preserve concurrent work; do not force-push or overwrite it.

Render service name: `saker-energy`; source: this repository's `main` branch; build: `npm run check && npm test`; output: `dist`.

The GitHub repository remains private. A public site exposes only the curated `dist/` output. A `render.yaml` file does not automatically create a Blueprint for an existing directly managed service; verify actual Render settings before changing infrastructure.

Before publishing, validate affected interactions and both desktop and mobile layouts. Record actual evidence and limits in `docs/website/RELEASE.md`. Do not mark unexecuted checks as passed. Preserve unrelated product documents and concurrent work. For rollback, revert the website commit or use a verified prior Render deployment; do not force-push `main`.
