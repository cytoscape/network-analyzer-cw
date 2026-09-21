import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RESULTS_PANEL_ID, showResultsPanel } from './resultsPanel'

describe('showResultsPanel', () => {
  it("opens the host's right panel on the results tab", () => {
    const calls: unknown[][] = []
    const apis = { panel: { open: (...args: unknown[]) => calls.push(args) } }

    assert.equal(showResultsPanel(apis), true)
    assert.deepEqual(calls, [['right', RESULTS_PANEL_ID]])
  })

  it('does nothing on a host that predates the Panel API', () => {
    assert.equal(showResultsPanel({ resource: {} }), false)
    assert.equal(showResultsPanel({ panel: {} }), false)
    assert.equal(showResultsPanel(undefined), false)
    assert.equal(showResultsPanel(null), false)
  })
})
