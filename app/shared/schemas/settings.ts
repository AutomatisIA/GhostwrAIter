import { z } from "zod";

export { emptyInputSchema } from "./common";

export const themePreferenceSchema = z.enum(["system", "light", "dark"]);

export const cliEngineNameSchema = z.enum(["codex", "gemini", "claude"]);

export const getPreferenceInputSchema = z.object({
  key: z.string().min(1, "key is required")
});

export const setPreferenceInputSchema = z.object({
  key: z.string().min(1, "key is required"),
  value: z.string()
});

export const setActiveEngineInputSchema = z.object({
  engine: cliEngineNameSchema
});
