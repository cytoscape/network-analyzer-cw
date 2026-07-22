"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const material_1 = require("@mui/material");
const react_1 = require("react");
const useAnalyzeNetworkAction_1 = require("../hooks/useAnalyzeNetworkAction");
const useCurrentNetworkId_1 = require("../hooks/useCurrentNetworkId");
/**
 * "Analyze as Directed Graph" checkbox + "Analyze Network" button. Shared by
 * the Apps menu item and the results panel (shown there when a network is
 * selected but hasn't been analyzed yet) so both stay behaviorally identical.
 */
const AnalyzeNetworkForm = () => {
    const networkId = (0, useCurrentNetworkId_1.useCurrentNetworkId)();
    const analyze = (0, useAnalyzeNetworkAction_1.useAnalyzeNetworkAction)();
    const [directed, setDirected] = (0, react_1.useState)(false);
    return ((0, jsx_runtime_1.jsxs)(material_1.Paper, { variant: "outlined", sx: {
            p: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }, children: [(0, jsx_runtime_1.jsx)(material_1.FormControlLabel, { label: "Analyze as Directed Graph", control: (0, jsx_runtime_1.jsx)(material_1.Checkbox, { checked: directed, onChange: (e) => setDirected(e.target.checked) }), onClick: (e) => e.stopPropagation() }), (0, jsx_runtime_1.jsx)(material_1.Button, { variant: "outlined", size: "small", disabled: networkId === '', onClick: () => analyze(networkId, directed), children: "Analyze Network" })] }));
};
exports.default = AnalyzeNetworkForm;
