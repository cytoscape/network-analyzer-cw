"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCurrentNetworkId = useCurrentNetworkId;
const react_1 = require("react");
const EventBus_1 = require("cyweb/EventBus");
const WorkspaceApi_1 = require("cyweb/WorkspaceApi");
/**
 * The current network's id, or '' when no network is selected. Stays in sync
 * across every independently-mounted consumer (the Apps menu item, the
 * results panel) since each subscribes to the same `network:switched` event.
 */
function useCurrentNetworkId() {
    const workspaceApi = (0, WorkspaceApi_1.useWorkspaceApi)();
    const [networkId, setNetworkId] = (0, react_1.useState)(() => {
        const result = workspaceApi.getCurrentNetworkId();
        return result.success ? result.data.networkId : '';
    });
    (0, EventBus_1.useCyWebEvent)('network:switched', ({ networkId: newNetworkId }) => {
        setNetworkId(newNetworkId);
    });
    return networkId;
}
