"use strict";
/**
 * Update:
 *   1. `id`          → must match the Module Federation `name` in webpack.config.js
 *                      AND the app's "id" in cytoscape-web's apps.json manifest
 *                      (camelCase — the manifest schema rejects dashes)
 *   2. `name`        → human-readable name shown in the host's App Settings
 *   3. `description` → one-line summary
 *   4. `resources`   → add/remove panels and menu items
 *   5. `mount()`     → register context menus, event listeners, etc.
 *   6. `unmount()`   → clean up event listeners from mount()
 *
 * Resources (panels and menu items) are registered declaratively — the host
 * renders them automatically. Context menus need `apis` access, so they are
 * registered in mount() instead.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkAnalyzerApp = void 0;
const react_1 = require("react");
const package_json_1 = __importDefault(require("../package.json"));
const { version } = package_json_1.default;
exports.NetworkAnalyzerApp = {
    id: 'networkAnalyzer', // must match the Module Federation `name` in webpack.config.js
    name: 'Network Analyzer',
    description: 'Network Analyzer calculates topological properties of a network (degree distribution, clustering coefficients, centrality, etc.)',
    version,
    apiVersion: '1.0',
    // ── Declarative resource registration ──────────────────────────────────
    // Panels and menu items are declared here. The host registers them
    // automatically — no mount() needed for these.
    resources: [
        {
            slot: 'apps-menu',
            id: 'action',
            component: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require('./components/AppMenuItem')))),
            closeOnAction: true, // auto-close menu after action
        },
        {
            slot: 'right-panel',
            id: 'NetworkAnalyzerPanel',
            title: 'Network Analyzer', // Tab title shown in the right panel.
            component: (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require('./components/MainPanel')))),
        },
    ],
    // ── Lifecycle hooks ────────────────────────────────────────────────────
    // mount() is called once after the app's resources are registered.
    // Use it for context menus (handlers need api access) and event listeners.
    mount(context) {
        // Context menu items are registered here because their handlers need
        // access to context.apis. The host auto-cleans all items when the app
        // is disabled — no explicit removal in unmount() needed.
        // registerSelectNeighbors(context)
        // TODO: Add more context menu registrations or event listeners here.
        // See src/contextMenus.ts for the pattern.
    },
    unmount() {
        // Only manual cleanup (e.g. event listeners) goes here.
        // Context menu items and resources are auto-cleaned by the host.
        //
        // if (_handler !== null) {
        //   window.removeEventListener('network:switched', _handler)
        //   _handler = null
        // }
    },
};
