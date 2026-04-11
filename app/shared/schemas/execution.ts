// Both execution IPC channels (`execution:list-runs` and
// `execution:get-diagnostics`) take no input. They use the shared
// `emptyInputSchema` from `common.ts`.
export { emptyInputSchema } from "./common";
