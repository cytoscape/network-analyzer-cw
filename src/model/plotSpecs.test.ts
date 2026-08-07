import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { buildHistogramSpec, buildScatterSpec } from './plotSpecs'

const names = ['a', 'b', 'c']
const degrees = [1, 2, 2]
const betweenness = [0, 0.5, 0.25]

test('histogram spec mirrors CyPlot getHistogramPlot defaults', () => {
  const spec = buildHistogramSpec('Degree', degrees, names)

  assert.equal(spec.dialogTitle, 'Histogram Plot')
  assert.deepEqual(spec.dataSources, { Degree: degrees, name: names })
  assert.deepEqual(spec.data, [{ x: degrees, type: 'histogram' }])
  // Plotly 3 requires the object form for titles — the CyPlot string form renders nothing
  assert.deepEqual(spec.layout.title, { text: 'Frequency of Degree' })
  assert.deepEqual(spec.layout.xaxis, { title: { text: 'Degree' }, automargin: true })
  assert.deepEqual(spec.layout.yaxis, { title: { text: 'Frequency' }, automargin: true })
  assert.equal(spec.layout.showlegend, false)
  assert.equal(spec.layout.hovermode, 'closest')
})

test('scatter spec mirrors CyPlot getXYPlot defaults', () => {
  const spec = buildScatterSpec('Degree', degrees, 'BetweennessCentrality', betweenness, names)

  assert.equal(spec.dialogTitle, 'Scatter Plot')
  assert.deepEqual(spec.dataSources, { Degree: degrees, BetweennessCentrality: betweenness, name: names })
  assert.deepEqual(spec.data, [{ x: degrees, y: betweenness, type: 'scatter', mode: 'markers', text: names }])
  assert.deepEqual(spec.layout.title, { text: 'Scatter Plot' })
  assert.deepEqual(spec.layout.xaxis, { title: { text: 'Degree' }, automargin: true })
  assert.deepEqual(spec.layout.yaxis, { title: { text: 'BetweennessCentrality' }, automargin: true })
})
