/**
 * Build-time stand-in for `@emotion/cache`.
 *
 * `react-chart-editor` depends on `react-select`, whose dist imports
 * `@emotion/cache` — but only inside its `NonceProvider` component, which
 * nothing in this app (or in react-chart-editor) ever renders. Left alone,
 * that import drags the real `@emotion/cache` implementation (and its
 * `@emotion/sheet` internals) into our bundle, and the SDK's
 * `no-shared-payload` gate rightly fails the build: everything under
 * `@emotion/*` must come from the host's shared singletons, never be bundled.
 *
 * vite.config.ts aliases `@emotion/cache` to this module instead. If some
 * future dependency actually calls it, the analysis fails loudly here rather
 * than subtly shipping a second Emotion runtime.
 */
export default function createCache(): never {
  throw new Error(
    '@emotion/cache is stubbed out in this app (see src/vendor/emotionCacheStub.ts). ' +
      'A dependency unexpectedly called it at runtime.',
  )
}
