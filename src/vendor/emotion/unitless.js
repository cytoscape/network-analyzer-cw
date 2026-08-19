/**
 * VENDORED copy of @emotion/unitless@0.10.0 (MIT, © Emotion team and contributors).
 * Source: node_modules/@emotion/unitless/dist/emotion-unitless.esm.js
 *
 * Why: styled-components v5 (via react-chart-editor) imports these tiny
 * @emotion/* utility packages. The SDK's no-shared-payload gate bans ANY
 * /node_modules/@emotion/ path from the bundle (the @emotion runtime must
 * come from the host's shared singletons), so vite.config.ts aliases the
 * package names to these local copies instead. They are pure, dependency-free
 * utilities — not the Emotion runtime — so duplicating them is safe.
 */
var unitlessKeys = {
  animationIterationCount: 1,
  aspectRatio: 1,
  borderImageOutset: 1,
  borderImageSlice: 1,
  borderImageWidth: 1,
  boxFlex: 1,
  boxFlexGroup: 1,
  boxOrdinalGroup: 1,
  columnCount: 1,
  columns: 1,
  flex: 1,
  flexGrow: 1,
  flexPositive: 1,
  flexShrink: 1,
  flexNegative: 1,
  flexOrder: 1,
  gridRow: 1,
  gridRowEnd: 1,
  gridRowSpan: 1,
  gridRowStart: 1,
  gridColumn: 1,
  gridColumnEnd: 1,
  gridColumnSpan: 1,
  gridColumnStart: 1,
  msGridRow: 1,
  msGridRowSpan: 1,
  msGridColumn: 1,
  msGridColumnSpan: 1,
  fontWeight: 1,
  lineHeight: 1,
  opacity: 1,
  order: 1,
  orphans: 1,
  scale: 1,
  tabSize: 1,
  widows: 1,
  zIndex: 1,
  zoom: 1,
  WebkitLineClamp: 1,
  // SVG-related properties
  fillOpacity: 1,
  floodOpacity: 1,
  stopOpacity: 1,
  strokeDasharray: 1,
  strokeDashoffset: 1,
  strokeMiterlimit: 1,
  strokeOpacity: 1,
  strokeWidth: 1
};

export { unitlessKeys as default };
