import path from 'path'
import url from 'url'
import mfPlugin from '@module-federation/enhanced/webpack'
import packageJson from './package.json' with { type: 'json' }

// Use @module-federation/enhanced (NOT webpack's built-in
// webpack.container.ModuleFederationPlugin). For an ESM remote that *consumes*
// another remote (cyweb), the built-in plugin emits a static
// `import … from "cyweb@<url>"`, which the browser's ESM loader rejects
// ("Failed to resolve module specifier"). The enhanced plugin loads remotes via
// @module-federation/runtime — the same runtime the cyweb (Vite) host uses — so
// no bare `name@url` specifier is emitted.
//
// The plugin package is CommonJS while this config is an ES module, so import
// the default export and destructure (the named CJS export is not reliably
// reachable via `import { ModuleFederationPlugin }`).
const { ModuleFederationPlugin } = mfPlugin

// Extract some properties from the package.json file to avoid duplication
const deps = packageJson.peerDependencies

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// TODO: Change DEV_SERVER_PORT to an unused port.
const DEV_SERVER_PORT = 5556

// Host remote URL — switches between local dev and production.
//
// NOTE: a plain URL, NOT the classic `cyweb@<url>` syntax. The `name@url` form
// only works for the `script` remote type; with ESM output (remoteType
// 'module') webpack uses the whole string as a static `import` specifier, and
// `cyweb@http://…` is not a valid module specifier ("Failed to resolve module
// specifier"). The remote's name comes from the `remotes` key (`cyweb`) below.
const LOCAL_CYWEB = 'http://localhost:5500/remoteEntry.js'
const PROD_CYWEB = 'https://web.cytoscape.org/remoteEntry.js'

export default (env) => {
  // webpack-cli passes `--env production=false` as the STRING "false", which is
  // truthy — so guard against it explicitly rather than testing `env.production`.
  const isProduction =
    env?.production === true || env?.production === 'true'

  const mainConfig = {
    // Anchor entry/context resolution to this file's directory so the build
    // doesn't depend on the process's current working directory.
    context: __dirname,
    mode: isProduction ? 'production' : 'development',
    devtool: false,
    target: 'web',
    optimization: {
      minimize: false,
      runtimeChunk: false,
    },
    entry: {
      main: './src/index.ts',
    },
    // Emit an ES module remote. The cyweb host loads every remote via
    // `import()` (registerRemotes with `type: 'module'`), so the container and
    // its chunks must be ESM, not the classic `var networkAnalyzer` global.
    experiments: { outputModule: true },
    output: {
      // No `clean: true` — this now runs alongside workerConfig as a webpack
      // multi-compiler build (both writing into the same `dist/`), and the
      // two compilers run concurrently: `clean` from one config can wipe
      // files the other just emitted (this was observed — worker + main
      // output going stale/missing after a build). Filenames here are static
      // (no contenthash), so skipping clean just means old-but-same-named
      // outputs get overwritten normally; nothing to garbage-collect.
      path: path.resolve(__dirname, 'dist'),
      // In dev, webpack-dev-server injects an `import.meta.url`-based auto
      // publicPath snippet into every chunk of a 'web'-target compiler. Prod
      // builds have no dev server and don't inject it, so 'auto' stays there
      // to keep the deployed remote location-agnostic.
      publicPath: isProduction ? 'auto' : `http://localhost:${DEV_SERVER_PORT}/`,
      module: true,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    plugins: [
      new ModuleFederationPlugin({
        // Must exactly match the app's "id" in cytoscape-web's apps.json
        // manifest — the host's Module Federation runtime registers this
        // remote under that id and looks up the exposed module as
        // "<id>/AppConfig". A mismatch fails silently (see AppManager's
        // loadRemoteApp.ts): the app just never appears in the App menu.
        // NOTE: the manifest's "id" must be a valid JS identifier (no dashes) —
        // see parseManifest.ts's JS_IDENTIFIER_PATTERN in the cyweb host —
        // so this must be camelCase, not kebab-case.
        name: 'networkAnalyzer',
        filename: 'remoteEntry.js',
        // Emit the federation container as an ES module so the host can import()
        // it. Requires output.module / experiments.outputModule above.
        library: { type: 'module' },
        // Load the cyweb remote as a native ES module (matches the host's ESM
        // container and the plain-URL remote entries above).
        remoteType: 'module',
        remotes: {
          cyweb: isProduction ? PROD_CYWEB : LOCAL_CYWEB,
        },
        exposes: {
          './AppConfig': './src/index.ts',
        },
        shared: {
          // Host-owned singletons: `import: false` means this remote never
          // bundles its own fallback copy — it consumes cyweb's instance only.
          // Keeps react/react-dom/@mui out of the distributed files entirely.
          react: { singleton: true, requiredVersion: deps.react, import: false },
          'react-dom': {
            singleton: true,
            requiredVersion: deps['react-dom'],
            import: false,
          },
          '@mui/material': {
            singleton: true,
            requiredVersion: deps['@mui/material'],
            import: false,
          },
        },
      }),
    ],
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    devServer: {
      hot: true,
      port: DEV_SERVER_PORT,
      headers: {
        'Access-Control-Allow-Origin': '*', // allow access from any origin
      },
      // Silences the injected dev/HMR client's own console output —
      // specifically its "Invalid Host/Origin header" log, which fires
      // harmlessly every time the Network Analyzer worker chunk loads (see
      // workerConfig's comment below for why that client ends up inside the
      // worker at all, and why `devServer: false` on that compiler is NOT the
      // right way to suppress it — it broke the compiler's own asset serving
      // under `webpack serve` instead). This only mutes logging; it doesn't
      // change what gets built, injected, or served.
      client: { logging: 'none' },
    },
  }

  // A SEPARATE compiler config (webpack multi-compiler — this file exports an
  // array), not a second entry alongside `main` in mainConfig above — so this
  // chunk gets its own `target: 'webworker'` instead of inheriting mainConfig's
  // `target: 'web'` (needed for correct worker globals either way). Note this
  // does NOT stop webpack-dev-server's HMR/live-reload client from being
  // injected into it too — webpack-dev-server's `Server.isWebTarget()`
  // explicitly treats 'webworker' as a web-like target (see its `webTargets`
  // list in node_modules/webpack-dev-server/lib/Server.js), so the client
  // still ends up in this bundle and tries (and fails) to open its own
  // WebSocket back to the dev server ("Invalid Host/Origin header" — muted
  // above via mainConfig's `devServer.client.logging`). Setting
  // `devServer: false` here looks like the "correct" opt-out from reading
  // Server.js's source (it skips that specific compiler's client-injection
  // step), but empirically it also stopped webpack-dev-server from actually
  // serving/watching this compiler's output under `webpack serve`
  // (`importScripts` failed to load the chunk at all) — so it's deliberately
  // NOT used here despite matching the documented condition.
  const workerConfig = {
    context: __dirname,
    mode: isProduction ? 'production' : 'development',
    devtool: false,
    target: 'webworker',
    entry: {
      // Predictable output filename (`network-analyzer-worker.mjs`, matching
      // this entry key) so useNetworkAnalyzerWorker.ts's hook can reference it
      // by a plain string. No Module Federation plugin here — this bundle is
      // purely internal, never exposed to consumers of the remote.
      'network-analyzer-worker': './src/model/networkAnalyzer.worker.ts',
    },
    output: {
      // Same output directory as mainConfig, served by the same dev server —
      // do NOT set `clean: true` here too, or each compiler's rebuild would
      // race to wipe the other's freshly-emitted files.
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].mjs',
      publicPath: isProduction ? 'auto' : `http://localhost:${DEV_SERVER_PORT}/`,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    // No `devServer` block: webpack-dev-server's multi-compiler mode only
    // needs devServer options on one config in the array (mainConfig above)
    // to serve every compiler's output from the same server instance.
  }

  return [mainConfig, workerConfig]
}
