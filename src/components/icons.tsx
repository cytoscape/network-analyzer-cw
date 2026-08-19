/**
 * Local Material Design icons.
 *
 * `@mui/icons-material` is deliberately NOT used: the host shares only the
 * five singletons (react, react-dom, @mui/material, @emotion/react,
 * @emotion/styled), and each icon module imports @mui/material internals by
 * subpath, which drags a second copy of MUI into this remote's bundle — the
 * SDK's no-shared-payload build gate fails on that. Building the icons from
 * the shared `@mui/material` root export keeps the bundle clean.
 *
 * Path data is the standard 24x24 Material Design set (Apache-2.0), identical
 * to what @mui/icons-material ships.
 */
import type { FC, ReactElement } from 'react'

import { SvgIcon, SvgIconProps } from '@mui/material'

const makeIcon = (name: string, d: string): FC<SvgIconProps> => {
  const Icon = (props: SvgIconProps): ReactElement => (
    <SvgIcon {...props}>
      <path d={d} />
    </SvgIcon>
  )
  Icon.displayName = name
  return Icon
}

export const BarChartIcon = makeIcon('BarChartIcon', 'M4 9h4v11H4zm12 4h4v7h-4zm-6-9h4v16h-4z')

export const CloseIcon = makeIcon(
  'CloseIcon',
  'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
)
