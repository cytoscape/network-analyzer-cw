/**
 * VENDORED copy of @emotion/memoize@0.9.0 (MIT, © Emotion team and contributors).
 * Source: node_modules/@emotion/memoize/dist/emotion-memoize.esm.js
 *
 * Why: styled-components v5 (via react-chart-editor) imports these tiny
 * @emotion/* utility packages. The SDK's no-shared-payload gate bans ANY
 * /node_modules/@emotion/ path from the bundle (the @emotion runtime must
 * come from the host's shared singletons), so vite.config.ts aliases the
 * package names to these local copies instead. They are pure, dependency-free
 * utilities — not the Emotion runtime — so duplicating them is safe.
 */
function memoize(fn) {
  var cache = Object.create(null);
  return function (arg) {
    if (cache[arg] === undefined) cache[arg] = fn(arg);
    return cache[arg];
  };
}

export { memoize as default };
