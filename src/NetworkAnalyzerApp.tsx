/**
 * Update:
 *   1. `id`          → must match the Module Federation `name` in webpack.config.js
 *                      AND the app's "id" in cytoscape-web's apps.json manifest
 *                      (camelCase — the manifest schema rejects dashes)
 *   2. `name`        → human-readable name shown in the host's App Settings
 *   3. `description` → one-line summary
 *   4. `resources`   → add/remove panels and menu items
 *   5. `mount()`     → register context menus, event listeners, etc.
 *   6. `unmount()`   → clean up event listeners from mount()
 *
 * Resources (panels and menu items) are registered declaratively — the host
 * renders them automatically. Context menus need `apis` access, so they are
 * registered in mount() instead.
 */

import { lazy } from 'react'

import { AppContext, CyAppWithLifecycle } from 'cyweb/ApiTypes'
import packageJson from '../package.json'


const { version } = packageJson

export const NetworkAnalyzerApp: CyAppWithLifecycle = {
  id: 'networkAnalyzer', // must match the Module Federation `name` in webpack.config.js
  name: 'Network Analyzer',
  description: 'Network Analyzer calculates topological properties of a network (degree distribution, clustering coefficients, centrality, etc.)',
  version,
  apiVersion: '1.0',

  // ── Declarative resource registration ──────────────────────────────────
  // Panels and menu items are declared here. The host registers them
  // automatically — no mount() needed for these.
  resources: [
    {
      slot: 'apps-menu',
      id: 'action',
      component: lazy(() => import('./components/AppMenuItem')),
      closeOnAction: true, // auto-close menu after action
    },
    {
      slot: 'right-panel',
      id: 'NetworkAnalyzerPanel',
      title: 'Network Analyzer', // Tab title shown in the right panel.
      component: lazy(() => import('./components/MainPanel')),
    },
  ],

  // ── Lifecycle hooks ────────────────────────────────────────────────────
  // mount() is called once after the app's resources are registered.
  // Use it for context menus (handlers need api access) and event listeners.

  mount(context: AppContext): void {
    // Context menu items are registered here because their handlers need
    // access to context.apis. The host auto-cleans all items when the app
    // is disabled — no explicit removal in unmount() needed.
    // registerSelectNeighbors(context)

    // TODO: Add more context menu registrations or event listeners here.
    // See src/contextMenus.ts for the pattern.
  },

  unmount(): void {
    // Only manual cleanup (e.g. event listeners) goes here.
    // Context menu items and resources are auto-cleaned by the host.
    //
    // if (_handler !== null) {
    //   window.removeEventListener('network:switched', _handler)
    //   _handler = null
    // }
  },
}
