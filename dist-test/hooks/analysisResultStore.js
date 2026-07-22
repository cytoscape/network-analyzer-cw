"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAnalysisResult = setAnalysisResult;
exports.useAnalysisResult = useAnalysisResult;
/**
 * Module-level store of the last analysis result per network, shared between
 * every independently-mounted consumer (the Apps menu item and the results
 * panel are separate React trees, so plain component state can't bridge them).
 */
const react_1 = require("react");
const results = new Map();
const listeners = new Set();
function emitChange() {
    for (const listener of listeners)
        listener();
}
function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
function setAnalysisResult(networkId, result) {
    results.set(networkId, result);
    emitChange();
}
/** The last analysis result for `networkId`, or undefined if it hasn't been analyzed yet. */
function useAnalysisResult(networkId) {
    return (0, react_1.useSyncExternalStore)(subscribe, () => results.get(networkId));
}
