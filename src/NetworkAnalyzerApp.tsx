/**
 * Update:
 *   1. `resources`   → add/remove panels and menu items
 *   2. `mount()`     → register context menus, event listeners, etc.
 *   3. `unmount()`   → clean up event listeners from mount()
 *
 * Identity (id, display name, version, description) arrives from
 * `virtual:cyweb-app-meta`, which the build fills in from the `cyweb` block
 * and standard fields in package.json — written once, read everywhere. The id
 * stays camelCase (the host manifest schema rejects dashes). Do NOT
 * `import packageJson from '../package.json'`: that pulls the whole file,
 * devDependencies included, into the browser bundle (`cyweb-app verify` fails
 * a build that does).
 *
 * Resources (panels and menu items) are registered declaratively — the host
 * renders them automatically. Context menus need `apis` access, so they are
 * registered in mount() instead.
 */

import { lazy } from 'react'

import { AppContext, CyAppWithLifecycle } from 'cyweb/ApiTypes'
import { description, displayName, id, version } from 'virtual:cyweb-app-meta'

import { LOGO_ICON_URI } from './components/icons'

export const NetworkAnalyzerApp: CyAppWithLifecycle = {
  id, // the Module Federation container name, from `cyweb.id` in package.json
  name: displayName,
  description,
  version,
  apiVersion: '1.0',

  // ── Declarative resource registration ──────────────────────────────────
  // Panels and menu items are declared here. The host registers them
  // automatically — no mount() needed for these.
  resources: [
    {
      // Plain data: the HOST renders the menu row (label, icon, tooltip) so
      // every app's entry looks the same. No component crosses the boundary.
      slot: 'apps-menu',
      id: 'action',
      label: 'Analyze Network',
      tooltip: 'Calculates degree, centrality, clustering and more',
      icon: LOGO_ICON_URI,
      // Greyed out until a network is loaded — there is nothing to analyze.
      requires: { network: true },
      // The host closes the dropdown, then calls this with the per-app API
      // object. The click opens the 'analyzer' modal below, which the HOST
      // renders in its own dialog shell — outside the dropdown — so the form
      // and any analysis Worker it starts keep running after the menu closes.
      onClick: (apis) => {
        apis.resource.openModal('analyzer')
      },
    },
    {
      // The "Analyze Network" form, opened via openModal('analyzer') from
      // both the apps-menu item and the panel's "New Analysis..." button.
      // The host renders it in its own dialog shell, so it outlives both
      // launchers.
      slot: 'modal-launcher',
      id: 'analyzer',
      maxWidth: 'xs',
      fullWidth: true,
      component: lazy(() => import('./components/AnalyzerModal')),
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
