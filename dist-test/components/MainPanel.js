"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const material_1 = require("@mui/material");
const WorkspaceApi_1 = require("cyweb/WorkspaceApi");
const analysisResultStore_1 = require("../hooks/analysisResultStore");
const useCurrentNetworkId_1 = require("../hooks/useCurrentNetworkId");
const AnalyzeNetworkForm_1 = __importDefault(require("./AnalyzeNetworkForm"));
function formatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(3);
}
// `value` returns null to hide a row entirely — used for centralization/
// heterogeneity, which are undirected-only (null in directed mode, same as
// the Java tool simply omitting them from a directed analysis summary).
const METRICS = [
    { label: 'Number of nodes', value: (r) => formatNumber(r.nodeCount) },
    { label: 'Number of edges', value: (r) => formatNumber(r.edgeCount) },
    { label: 'Avg. number of neighbors', value: (r) => formatNumber(r.avNeighbors) },
    { label: 'Network diameter', value: (r) => formatNumber(r.diameter) },
    { label: 'Network radius', value: (r) => formatNumber(r.radius) },
    { label: 'Network centralization', value: (r) => (r.centralization === null ? null : formatNumber(r.centralization)) },
    { label: 'Characteristic path length', value: (r) => formatNumber(r.avgShortestPathLength) },
    { label: 'Clustering coefficient', value: (r) => formatNumber(r.clusteringCoefficient) },
    { label: 'Network density', value: (r) => formatNumber(r.density) },
    { label: 'Network heterogeneity', value: (r) => (r.heterogeneity === null ? null : formatNumber(r.heterogeneity)) },
    { label: 'Connected components', value: (r) => formatNumber(r.connectedComponents) },
    { label: 'Multi-edge node pairs', value: (r) => formatNumber(r.multiEdgeNodePairs) },
    { label: 'Number of self-loops', value: (r) => formatNumber(r.selfLoops) },
    { label: 'Analysis time (sec)', value: (r) => formatNumber(r.analysisTimeMs / 1000) },
];
const ResultsPanel = () => {
    const workspaceApi = (0, WorkspaceApi_1.useWorkspaceApi)();
    const networkId = (0, useCurrentNetworkId_1.useCurrentNetworkId)();
    const result = (0, analysisResultStore_1.useAnalysisResult)(networkId);
    if (networkId === '') {
        return ((0, jsx_runtime_1.jsx)(material_1.Box, { sx: { p: 2 }, children: (0, jsx_runtime_1.jsx)(material_1.Typography, { color: "text.secondary", children: "No network is selected for analysis." }) }));
    }
    if (result === undefined) {
        return ((0, jsx_runtime_1.jsx)(material_1.Box, { sx: { p: 2 }, children: (0, jsx_runtime_1.jsx)(AnalyzeNetworkForm_1.default, {}) }));
    }
    const summaryResult = workspaceApi.getNetworkSummary(networkId);
    const networkName = summaryResult.success ? summaryResult.data.name : networkId;
    return ((0, jsx_runtime_1.jsxs)(material_1.Box, { sx: { p: 2 }, children: [(0, jsx_runtime_1.jsxs)(material_1.Typography, { variant: "subtitle1", color: "text.primary", children: [networkName, " (", result.directed ? 'directed' : 'undirected', ")"] }), (0, jsx_runtime_1.jsx)(material_1.Typography, { variant: "overline", color: "text.secondary", children: "Summary Statistics" }), (0, jsx_runtime_1.jsx)(material_1.Table, { size: "small", children: (0, jsx_runtime_1.jsx)(material_1.TableBody, { children: METRICS.map(({ label, value }) => {
                        const formatted = value(result);
                        if (formatted === null)
                            return null;
                        return ((0, jsx_runtime_1.jsxs)(material_1.TableRow, { children: [(0, jsx_runtime_1.jsx)(material_1.TableCell, { sx: { color: 'text.secondary', pl: 0 }, children: label }), (0, jsx_runtime_1.jsx)(material_1.TableCell, { align: "right", sx: { pr: 0 }, children: formatted })] }, label));
                    }) }) })] }));
};
exports.default = ResultsPanel;
