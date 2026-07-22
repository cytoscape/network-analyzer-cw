# Network Analyzer App — Cytoscape Web

Aa a Cytoscape Web plugin, Network Analyzer performs analysis of biological networks 
and calculates network topology parameters including the diameter of a network, the average number of neighbors, 
and the number of connected pairs of nodes. It also computes the distributions of more complex network parameters 
such as node degrees, average clustering coefficients, topological coefficients, and shortest path lengths.
It displays the results in diagrams, which can be saved as images or text files.

| Field | Value |
|---|---|
| Federation name | `networkAnalyzer` |
| Dev server port | `5556` |
| Entry point | `template@http://localhost:5556/remoteEntry.js` |

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (host must be running on :5500)
npm run dev
```

Add your app to the host's `src/assets/apps.local.json` (a JSON array):
```json
{
  "id": "networkAnalyzer",
  "name": "Network Analyzer",
  "url": "http://localhost:5556/remoteEntry.js",
  "author": "Cytoscape Core Team",
  "description": "Calculates topological properties of a network (degree distribution, clustering coefficients, centrality, etc.)",
  "version": "1.0.0",
  "tags": ["graph-analysis"],
  "license": "LGPL 2.1",
  "repository": "https://github.com/cytoscape/network-analyzer-cw"
}
```

Open `http://localhost:5500` → **Apps** → **App Settings** → enable your app.

---

## Building for production

```bash
npx webpack --env production
```

This switches the host remote from `localhost:5556` to `web.cytoscape.org` and
enables minification.
