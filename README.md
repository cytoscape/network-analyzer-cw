# Network Analyzer App — Cytoscape Web

As a Cytoscape Web plugin, Network Analyzer performs analysis of biological networks
and calculates network topology parameters including the diameter of a network, the average number of neighbors,
and the number of connected pairs of nodes. It also computes the distributions of more complex network parameters
such as node degrees, average clustering coefficients, topological coefficients, and shortest path lengths.
It displays the results in diagrams, which can be saved as images or text files.

| Field | Value |
|---|---|
| Federation name | `networkAnalyzer` (from `cyweb.id` in `package.json`) |
| Dev server port | `5556` (from `cyweb.port` in `package.json`) |
| Dev entry point | `http://localhost:5556/remoteEntry.js` |

The build is **Vite + [`@cytoscape-web/app-runtime`](https://www.npmjs.com/package/@cytoscape-web/app-runtime)**
(`defineCyWebApp` in [vite.config.ts](vite.config.ts)). The app's identity — id,
display name, dev port — lives in the `cyweb` block in `package.json` and is
read everywhere else from there (the federation container, the `CyApp` config
via `virtual:cyweb-app-meta`, and the dev install manifest).

---

## Quick start

Node 24 is enforced, not just recommended: `.nvmrc` pins it for `nvm use`,
`.npmrc` sets `engine-strict` so `npm install` refuses an older Node, and
`vite.config.ts` fails any build or dev run below 24.

```bash
# 1. Install dependencies (Node >= 24)
npm install

# 2. Start the dev server
npm run dev
```

The dev server prints the link that installs the app into a running local host
— **nothing in the host repository is edited**:

```
  Cytoscape Web app networkAnalyzer — http://localhost:5556

  Install it into a local host:
  http://localhost:5500/?installApp=http%3A%2F%2Flocalhost%3A5556%2Fcyweb-app.json
```

Start the host (`npm run dev` in a
[cytoscape-web](https://github.com/cytoscape/cytoscape-web) checkout, on :5500),
open that link (or paste `http://localhost:5556/cyweb-app.json` into
**Apps → Manage Apps… → Install from URL**), confirm the install, and enable
Network Analyzer. The manifest at `/cyweb-app.json` is generated from
`package.json` on every request, so it cannot go stale.

Changes to the app rebuild immediately, but Vite HMR does not cross the
federation boundary — reload the host page to pick them up.

## Other commands

```bash
npm run build       # production build into dist/
npm run build:zip   # production build + App Store archive (see below)
npm run verify      # cyweb-app verify — asserts the federation shape of dist/
npm run typecheck   # tsc over app sources and vite.config.ts
npm test            # analyzer algorithm unit tests (Node test runner)
```

## Package for the App Store

```bash
npm run build:zip
```

writes `networkAnalyzer-<version>.zip` next to `package.json` — the file the
Cytoscape App Store submission page takes. The archive contains the browser
publish set plus a generated `cy-manifest.json` (derived from this
`package.json`; never edit or commit one), and the build is verified with the
same checks as `npm run verify` before it is packaged. A plain
`npm run build` does not write the zip.

Prefer building the release zip in CI: a workstation build embeds absolute
build-machine paths in `remoteEntry.js` (harmless dead literals, but they
disclose your username and directory layout).

---

## The production bundle

`npm run build` produces the deployable **Module Federation remote** in
`dist/`. There are **no hardcoded host URLs** in the artifact:

- The compiled-in entry for the `cyweb` remote is a **sentinel, not a URL**. At
  load time the host publishes its own `remoteEntry.js` location on
  `window.__CYWEB_HOST__`, and the app-runtime's runtime plugin swaps it in —
  so one artifact works against `localhost`, `web.cytoscape.org`, or any other
  deployment.
- Chunk URLs resolve relative to wherever `remoteEntry.js` is served (Module
  Federation `publicPath: 'auto'`); the app can live at any origin and any base
  path (e.g. `https://example.org/apps/network-analyzer/`).
- The analysis web worker is **inlined** into its chunk (`?worker&inline`) and
  constructed from a Blob at runtime, so it needs no URL at all in production.
  In dev it is loaded from the dev server through a same-origin Blob shim (see
  [useNetworkAnalyzerWorker.ts](src/hooks/useNetworkAnalyzerWorker.ts)).

`dist/` **is** the bundle: serve the whole folder side by side at one base URL.
`remoteEntry.js` is the ESM container entry the host `import()`s; the exposed
module is `./AppConfig`; `mf-manifest.json` carries the federation metadata
(and what `npm run verify` checks against).

### Deployment gotchas

- **Shared deps are not bundled.** `react`, `react-dom`, `@mui/material`,
  `@emotion/react` and `@emotion/styled` are shared singletons with
  `import: false`: the remote consumes the **host's** copies. For the same
  reason, sources must import only the package roots (`'@mui/material'`, never
  `'@mui/material/Box'`), and `@mui/icons-material` is off-limits — the icons
  used by the panel are local `SvgIcon` wrappers in
  [icons.tsx](src/components/icons.tsx). The `noSharedPayload` build gate fails
  the build if any of these packages leak into the chunks.
- **Cross-origin serving needs CORS.** The host imports `remoteEntry.js` and
  its chunks cross-origin, so the files must be served with
  `Access-Control-Allow-Origin` (the dev server already sends `*`).
- **The remote type must stay ESM** to match the cyweb host's federation
  runtime. `cyweb-app verify` asserts this, along with the sentinel entry and
  the shared-singleton records.
- **Plotly is heavy.** `plotly.js` + `react-chart-editor` live in a
  lazily-imported chunk behind the chart button (see `LazyPlotDialog` in
  [MainPanel.tsx](src/components/MainPanel.tsx)), so the panel itself stays
  light.
