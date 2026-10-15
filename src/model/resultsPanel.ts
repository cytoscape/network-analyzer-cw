/**
 * Bringing the results tab into view through the host's Panel API
 * (`AppContext.apis.panel`). Pure: it is handed the api object, never reaches
 * for one.
 *
 * Why it exists: "Analyze Network" is launched from the Apps menu, and its
 * results land in a right-panel tab. If the side panel is closed, or another
 * tab is selected, a new user has no cue that the run produced anything.
 */

import type { PanelApi } from '@cytoscape-web/api-types'

/** The id the results tab is registered with in the 'right-panel' slot. */
export const RESULTS_PANEL_ID = 'NetworkAnalyzerPanel'

/**
 * Open the host's right panel on the results tab. Returns whether the host
 * was asked to: a host that predates the Panel API has no `apis.panel`, and
 * the app must keep working there — the results are still in the tab, just
 * not brought forward.
 */
export function showResultsPanel(apis: unknown): boolean {
  const panel = (apis as { panel?: PanelApi } | null | undefined)?.panel
  if (typeof panel?.open !== 'function') return false
  panel.open('right', RESULTS_PANEL_ID)
  return true
}
