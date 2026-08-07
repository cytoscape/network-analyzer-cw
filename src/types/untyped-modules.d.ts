/**
 * Ambient declarations for dependencies that ship no TypeScript types.
 *
 * react-chart-editor is plotly's chart editor React component — the same UI
 * the CyPlot Cytoscape Desktop app embeds in its cybrowser windows (CyPlot
 * bundles it as `app.bundle.js`; see CyPlot's react-editor/examples/simple).
 * The props below are the subset this app uses, typed from the propTypes in
 * react-chart-editor/lib/PlotlyEditor.js.
 */

declare module 'plotly.js/dist/plotly.min' {
  const Plotly: Record<string, unknown>
  export default Plotly
}

declare module 'react-chart-editor' {
  import type { Component, ReactNode } from 'react'

  export interface PlotlyEditorProps {
    data?: Array<Record<string, unknown>>
    layout?: Record<string, unknown>
    frames?: Array<Record<string, unknown>>
    config?: Record<string, unknown>
    dataSources?: Record<string, ReadonlyArray<unknown>>
    dataSourceOptions?: Array<{ value: string; label: string }>
    plotly: unknown
    onUpdate?: (
      data: Array<Record<string, unknown>>,
      layout: Record<string, unknown>,
      frames: Array<Record<string, unknown>>,
    ) => void
    /** Fired after the underlying plot (re)renders — the `divId` div exists by then. */
    onRender?: (
      data: Array<Record<string, unknown>>,
      layout: Record<string, unknown>,
      frames: Array<Record<string, unknown>>,
    ) => void
    useResizeHandler?: boolean
    advancedTraceTypeSelector?: boolean
    divId?: string
    hideControls?: boolean
    children?: ReactNode
  }

  export default class PlotlyEditor extends Component<PlotlyEditorProps> {}
}

declare module 'react-chart-editor/lib/react-chart-editor.css'
