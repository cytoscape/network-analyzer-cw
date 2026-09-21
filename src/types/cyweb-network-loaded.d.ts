// TEMPORARY — delete this file once `@cytoscape-web/api-types` 1.0.0-beta.5 is
// published and the dependency in package.json is bumped to it.
//
// The host's `network:loaded` event (cytoscape/cytoscape-web#731) is declared
// in api-types 1.0.0-beta.5, which is not on npm yet; the installed beta.4
// does not know the key, so `useCyWebEvent('network:loaded', ...)` would not
// compile. This merges the one missing entry into the published interface.
// The shape is copied from the host's `src/app-api/event-bus/CyWebEvents.ts`.
//
// The `import` makes this file a module, which is what turns the block below
// into an augmentation of the package rather than a replacement for it.
import '@cytoscape-web/api-types'

declare module '@cytoscape-web/api-types' {
  interface CyWebEvents {
    /**
     * Fired once a network's node and edge tables and its view have all landed
     * in the host's stores, i.e. once table/element/viewport reads for it
     * succeed. At most once per network until it is deleted, and not only for
     * the current network.
     */
    'network:loaded': { networkId: string }
  }
}
