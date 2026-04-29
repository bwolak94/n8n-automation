import { common } from "./common.js";
import { canvas } from "./canvas.js";
import { nodes } from "./nodes.js";
import { executions } from "./executions.js";
import { billing } from "./billing.js";
import { marketplace } from "./marketplace.js";
import type { EnMessages } from "../en/index.js";

// TypeScript enforces that PL implements the full EN schema
const pl: EnMessages = { common, canvas, nodes, executions, billing, marketplace };

export { pl };
