import { z } from "zod";

/**
 * Canonical "no input" schema for IPC channels that take no payload.
 *
 * Declared once and re-exported from every domain schema file that
 * needs it (settings, execution, calendar's list-items, ideas' list,
 * etc.). Using a shared constant makes the convention obvious to a
 * reader of any handler file: the presence of `emptyInputSchema` at
 * a registration call site is an explicit statement that the channel
 * accepts exactly `undefined`.
 *
 * Accepts: `undefined`
 * Rejects: any non-undefined value (an object, a string, a number, null)
 */
export const emptyInputSchema = z.undefined();
