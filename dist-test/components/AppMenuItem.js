"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const material_1 = require("@mui/material");
const AnalyzeNetworkForm_1 = __importDefault(require("./AnalyzeNetworkForm"));
// `handleClose` (MenuItemHostProps) is unused — closeOnAction on the resource
// registration handles closing the dropdown automatically.
const AppMenuItem = (_props) => {
    return ((0, jsx_runtime_1.jsxs)(material_1.Box, { sx: { p: 1 }, children: [(0, jsx_runtime_1.jsx)(material_1.Typography, { variant: "subtitle1", color: "text.primary", children: "Network Analyzer:" }), (0, jsx_runtime_1.jsx)(AnalyzeNetworkForm_1.default, {})] }));
};
exports.default = AppMenuItem;
