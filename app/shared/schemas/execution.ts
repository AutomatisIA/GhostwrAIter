import { z } from "zod";

// `execution:list-runs` and `execution:get-diagnostics` take no input and reuse
// the shared `emptyInputSchema` from `common.ts`.
export { emptyInputSchema } from "./common";

// `execution:open-run-log` takes a single non-empty run identifier.
export const openRunLogInputSchema = z.string().min(1);
