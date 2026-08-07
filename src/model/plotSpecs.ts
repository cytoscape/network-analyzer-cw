/**
 * Default Plotly figures for the two chart buttons, ported from CyPlot.
 *
 * On Cytoscape Desktop the analyzer's buttons run the CyPlot commands
 * `cyplot histogram xCol=Degree` and
 * `cyplot scatter xCol=Degree yCol=BetweennessCentrality` (see the analyzer
 * repo's AnalyzerManager.makeDegreeHisto/makeBetweenScatter). CyPlot
 * (edu.ucsf.rbvi.cyPlot: HistogramPlotTask, ScatterPlotTask,
 * JSUtils.getHistogramPlot/getXYPlot) then opens plotly's react-chart-editor
 * in a cybrowser window with a default trace + layout built from the node
 * table columns. These builders produce that same default figure.
 *
 * Differences from the CyPlot-generated JS, on purpose:
 *  - Plotly 3 dropped the plain-string form of `title` that CyPlot emits
 *    (`title: 'Frequency of Degree'`); the object form `{ text: ... }` is
 *    required, otherwise the titles silently don't render.
 *  - `dataSources` entries (the editor's X/Y Values dropdowns) are named
 *    after the actual table columns instead of CyPlot's generic
 *    `traceX`/`traceY`, and the histogram drops CyPlot's `'Frequency': null`
 *    placeholder entry.
 */

export interface PlotSpec {
  /** Dialog title — CyPlot's cybrowser window title for the same plot. */
  dialogTitle: string
  /** Column data offered in the editor's X/Y Values dropdowns, all in node order. */
  dataSources: Record<string, ReadonlyArray<number | string>>
  /** Initial traces. */
  data: Array<Record<string, unknown>>
  /** Initial layout. */
  layout: Record<string, unknown>
}

/** Shared by both plots — JSUtils.getHistogramLabelCode/getLayoutCode emit these on every layout. */
function baseLayout(title: string, xLabel: string, yLabel: string): Record<string, unknown> {
  return {
    showlegend: false,
    legend: { x: 1, y: 0.5 },
    hovermode: 'closest',
    xaxis: { title: { text: xLabel }, automargin: true },
    yaxis: { title: { text: yLabel }, automargin: true },
    title: { text: title },
  }
}

/**
 * Histogram of a numeric node column ("Node Degree Distribution" uses the
 * Degree column). Mirrors JSUtils.getHistogramPlot's editor branch: a single
 * `{x, type: 'histogram'}` trace titled "Frequency of <column>".
 */
export function buildHistogramSpec(
  xLabel: string,
  xValues: ReadonlyArray<number>,
  names: ReadonlyArray<string>,
): PlotSpec {
  return {
    dialogTitle: 'Histogram Plot',
    dataSources: { [xLabel]: xValues, name: names },
    data: [{ x: xValues, type: 'histogram' }],
    layout: baseLayout(`Frequency of ${xLabel}`, xLabel, 'Frequency'),
  }
}

/**
 * Scatter of two numeric node columns ("Betweenness by Degree" uses Degree
 * vs BetweennessCentrality). Mirrors JSUtils.getXYPlot for a single trace:
 * markers mode, node names as hover text, layout title "Scatter Plot"
 * (ScatterPlotTask passes that literal title).
 */
export function buildScatterSpec(
  xLabel: string,
  xValues: ReadonlyArray<number>,
  yLabel: string,
  yValues: ReadonlyArray<number>,
  names: ReadonlyArray<string>,
): PlotSpec {
  return {
    dialogTitle: 'Scatter Plot',
    dataSources: { [xLabel]: xValues, [yLabel]: yValues, name: names },
    data: [{ x: xValues, y: yValues, type: 'scatter', mode: 'markers', text: names }],
    layout: baseLayout('Scatter Plot', xLabel, yLabel),
  }
}
