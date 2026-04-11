import { z } from "zod";

/**
 * Status values allowed for a calendar item, matching the existing
 * CalendarItem["status"] union in app/shared/types/calendar.ts.
 */
export const calendarItemStatusSchema = z.enum([
  "planned",
  "ready",
  "published",
  "missed"
]);

/**
 * ISO 8601 date or datetime string. We accept both `YYYY-MM-DD` and
 * full ISO timestamps so the renderer can pass either a simple date
 * picker value or a timezone-aware string.
 */
const isoDateStringSchema = z
  .string()
  .min(1, "plannedDate is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "plannedDate must be an ISO 8601 date or datetime string"
  });

/**
 * Input shape accepted by `calendar:schedule-draft`. Every field is
 * required: a draft id, a target date, and an explicit status.
 */
export const scheduleDraftInputSchema = z.object({
  draftId: z.string().min(1, "draftId is required"),
  plannedDate: isoDateStringSchema,
  status: calendarItemStatusSchema
});

export type ScheduleDraftInput = z.infer<typeof scheduleDraftInputSchema>;

/**
 * Empty-input schema for `calendar:list-items`. The channel takes no
 * payload; the schema explicitly accepts `undefined` and rejects
 * anything else.
 */
export const emptyInputSchema = z.undefined();
