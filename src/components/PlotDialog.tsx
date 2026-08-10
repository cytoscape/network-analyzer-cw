import { useCallback, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import Plotly from 'plotly.js/dist/plotly.min'
import PlotlyEditor from 'react-chart-editor'
import 'react-chart-editor/lib/react-chart-editor.css'
import type { JSX } from 'react/jsx-runtime'

import { PlotSpec } from '../model/plotSpecs'

/** The div plotly renders into; plotly adds its own `.on` event emitter to it. */
type PlotlyGraphDiv = HTMLElement & {
  on?: (event: string, handler: (event: PlotlyPointEvent) => void) => void
}

interface PlotlyPointEvent {
  points?: Array<{
    /** Index of the source point — scatter/bar points. */
    pointIndex?: number
    /** Indices of all aggregated source points — histogram bars. */
    pointIndices?: number[]
  }>
}

const PLOT_DIV_ID = 'network-analyzer-plot'

interface PlotDialogProps {
  open: boolean
  onClose: () => void
  spec: PlotSpec | null
  /**
   * Called with the indices (positions in the spec's dataSources arrays, i.e.
   * node order) of the points picked by clicking or lasso/box-selecting in
   * the plot. Ignored when the current traces no longer index into the
   * original columns (the user can rebuild traces freely in the editor).
   */
  onSelectPoints?: (indices: number[]) => void
}

/**
 * Mounted fresh on every dialog open so the editor state restarts from the
 * spec's default figure, like each CyPlot command opening a new cybrowser
 * window.
 */
const EditorBody = ({ spec, onSelectPoints }: Omit<PlotDialogProps, 'open' | 'onClose'> & { spec: PlotSpec }): JSX.Element => {
  const [figure, setFigure] = useState(() => ({
    data: spec.data,
    layout: spec.layout,
    frames: [] as Array<Record<string, unknown>>,
  }))
  const wired = useRef(false)
  const selectHandler = useRef(onSelectPoints)
  selectHandler.current = onSelectPoints

  // Port of CyPlot's JSUtils.getClickCode/getLassoCode: push the picked plot
  // points back into Cytoscape as the node selection. CyPlot selects by node
  // name through a cybrowser command; here the point indices are mapped to
  // node ids by the caller. Wired in onRender (the plot div only exists after
  // the first render) and only once — plotly's div-level event emitter
  // survives Plotly.react updates.
  const wirePlotEvents = useCallback(() => {
    if (wired.current) return
    const div = document.getElementById(PLOT_DIV_ID) as PlotlyGraphDiv | null
    if (div === null || typeof div.on !== 'function') return
    wired.current = true

    const pick = (event: PlotlyPointEvent): void => {
      const indices = (event.points ?? []).flatMap((p) => p.pointIndices ?? (p.pointIndex !== undefined ? [p.pointIndex] : []))
      if (indices.length > 0) selectHandler.current?.(indices)
    }
    div.on('plotly_click', pick)
    div.on('plotly_selected', pick)
  }, [])

  return (
    <PlotlyEditor
      data={figure.data}
      layout={figure.layout}
      frames={figure.frames}
      config={{ editable: true }}
      dataSources={spec.dataSources}
      dataSourceOptions={Object.keys(spec.dataSources).map((name) => ({ value: name, label: name }))}
      plotly={Plotly}
      divId={PLOT_DIV_ID}
      onUpdate={(data, layout, frames) => setFigure({ data, layout, frames })}
      onRender={wirePlotEvents}
      useResizeHandler
      advancedTraceTypeSelector
    />
  )
}

/**
 * Chart dialog: plotly's react-chart-editor (the exact component CyPlot
 * embeds in its cybrowser windows on Cytoscape Desktop) inside an MUI dialog.
 */
const PlotDialog = ({ open, onClose, spec, onSelectPoints }: PlotDialogProps): JSX.Element => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 1.5,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h6">{spec?.dialogTitle ?? ''}</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close dialog">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      {/* The editor lays itself out with its own stylesheet and needs an
          explicit height; padding 0 lets its sidebar sit flush with the
          dialog edges like the CyPlot window.

          `.gtitle-subtitle` hides plotly 3's "Click to enter Plot subtitle"
          placeholder: `config.editable` welds subtitle editing to titleText
          editing (src/components/titles/index.js — "Subtitle is editable if
          and only if title is editable"), so this placeholder can't be turned
          off by config without also losing click-to-edit on the plot title.
          CyPlot's plotly 2 predates subtitles, so Desktop never shows it.

          `.fold__top` (the "trace 0" collapsible header) is pinned to
          `height: 15px` by react-chart-editor.css, which is shorter than its
          own 18px icons and so clips the header; letting it size to its
          content restores the intended look. */}
      <DialogContent
        sx={{
          p: 0,
          height: '75vh',
          '& .gtitle-subtitle': { display: 'none' }, // Hide plotly 3 subtitle placeholder
          '& .editor_controls .fold__top': { height: 'unset' }, // Fix clipped header
          // Use MUI palette colors, which should also work in dark mode:
          '& .js-test-info': { color: 'var(--mui-palette-text-secondary)' },
          '& .plotly-editor--theme-provider': {
            '--border-default': '1px solid var(--mui-palette-divider)',
            '--border-hover': '1px solid var(--mui-palette-divider)',
            '--border-light': '1px solid var(--mui-palette-divider)',
            '--border-dark': '1px solid var(--mui-palette-divider)',
            '--color-background-light': 'var(--mui-palette-background-paper)',
            '--color-background-medium': 'var(--mui-palette-background-paper)',
            '--color-background-dark': 'var(--mui-palette-background-paper)',
            '--color-background-base': 'var(--mui-palette-background-paper)',
            '--color-background-top': 'var(--mui-palette-background-paper)',
            '--color-background-bottom': 'var(--mui-palette-background-default)',
            '--color-background-hover': 'var(--mui-palette-action-hover)',
            '--color-text-active': 'var(--mui-palette-text-primary)',
            '--color-text-base': 'var(--mui-palette-text-primary)',
            '--color-text-light': 'var(--mui-palette-text-secondary)',
            '--color-text-dark': 'var(--mui-palette-text-primary)',
            '--color-text-strong': 'var(--mui-palette-text-primary)',
            '--color-text-primary': 'var(--mui-palette-text-primary)',
            '--color-text-secondary': 'var(--mui-palette-text-secondary)',
            '--color-text-disabled': 'var(--mui-palette-action-disabled)',
            '--color-text-section-header': 'var(--mui-palette-text-primary)',
            '--color-button-primary-base-fill': 'var(--mui-palette-primary-main)',
            '--color-button-primary-hover-fill': 'var(--mui-palette-primary-dark)',
            '--color-button-primary-disabled-fill': 'var(--mui-palette-action-disabledBackground)',
            '--color-button-primary-disabled-text': 'var(--mui-palette-action-disabled)',
            '--color-accent': 'var(--mui-palette-primary-main)',
            '--fold-header-background-base': 'var(--mui-palette-text-secondary)',
            '--fold-header-background-closed': 'var(--mui-palette-text-secondary)',
            '--fold-header-border-color-base': 'var(--mui-palette-divider)',
            '--fold-header-border-color-closed': 'var(--mui-palette-divider)',
            '--fold-header-text-color-base': 'var(--mui-palette-background-paper)',
            '--fold-header-text-color-closed': 'var(--mui-palette-background-paper)',
            '--panel-background': 'var(--mui-palette-background-default)',
            '--sidebar-background': 'var(--mui-palette-background-paper)',
            '--sidebar-item-background-base': 'var(--mui-palette-background-paper)',
            '--text-shadow-dark-ui': 'none',
            '--text-shadow-dark-ui-active': 'none',
          },
        }}
      >
        {spec !== null && <EditorBody spec={spec} onSelectPoints={onSelectPoints} />}
      </DialogContent>
    </Dialog>
  )
}

export default PlotDialog
