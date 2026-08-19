import { fileURLToPath } from 'node:url'

import { defineCyWebApp } from '@cytoscape-web/app-runtime/vite'

const local = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

export default defineCyWebApp(import.meta.url, {
  vite: {
    // react-chart-editor's dependency tree (draft-js and friends) references
    // Node's `global`, which Webpack shimmed automatically and Vite does not:
    // without this the chart dialog throws "global is not defined".
    define: {
      global: 'globalThis',
    },
    optimizeDeps: {
      // The same shim for the dev-time dependency pre-bundle (Vite 8 /
      // rolldown — the old `esbuildOptions` is deprecated and ignored;
      // rolldown takes `define` inside `transform`).
      rolldownOptions: {
        transform: {
          define: {
            global: 'globalThis',
          },
        },
      },
    },
    resolve: {
      // The SDK's no-shared-payload gate bans ANY bundled module under
      // /node_modules/@emotion/ — the Emotion runtime must come from the
      // host's shared singletons. react-chart-editor's dependency tree
      // reaches the namespace anyway, in two harmless ways, so those imports
      // are redirected:
      alias: {
        // react-select imports '@emotion/cache' only for its NonceProvider,
        // which is never rendered here → throwing stub.
        '@emotion/cache': local('./src/vendor/emotionCacheStub.ts'),
        // styled-components v5 uses these tiny dependency-free @emotion/*
        // utilities (NOT the Emotion runtime) at runtime → vendored copies.
        '@emotion/stylis': local('./src/vendor/emotion/stylis.js'),
        '@emotion/unitless': local('./src/vendor/emotion/unitless.js'),
        '@emotion/is-prop-valid': local('./src/vendor/emotion/is-prop-valid.js'),
        '@emotion/memoize': local('./src/vendor/emotion/memoize.js'),
      },
    },
  },
})

// That is the whole build configuration. defineCyWebApp sets up:
//
//   - the `cyweb` remote with `type: 'module'` (the host emits an ESM
//     remoteEntry.js)
//   - a production entry that is a SENTINEL, not a URL — the host publishes its
//     own entry on window.__CYWEB_HOST__ at boot and a runtime plugin swaps it
//     in, so one artifact works against any deployment (no hardcoded domains)
//   - `shared` matching the host's five singletons (react, react-dom,
//     @mui/material, @emotion/react, @emotion/styled) with `import: false`
//   - the `./AppConfig` expose from src/index.ts
//   - a build-time gate that fails if a shared package's implementation ends
//     up bundled anyway
//
// The app's identity — id, display name, dev port — lives in the `cyweb` block
// in package.json.
//
// The analysis web worker needs nothing here: worker code is emitted by Vite's
// built-in `?worker&inline` handling and loaded through a same-origin Blob
// shim in dev (see src/hooks/useNetworkAnalyzerWorker.ts), which works on any
// origin.
