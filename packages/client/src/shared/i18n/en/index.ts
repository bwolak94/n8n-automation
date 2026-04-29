import { common } from "./common.js";
import { canvas } from "./canvas.js";
import { nodes } from "./nodes.js";
import { executions } from "./executions.js";
import { billing } from "./billing.js";
import { marketplace } from "./marketplace.js";

export const en = { common, canvas, nodes, executions, billing, marketplace } as const;

export type EnMessages = typeof en;
