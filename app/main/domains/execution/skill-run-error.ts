import type { SkillRunnerResult } from "./skill-runner.service";

/**
 * Erreur d execution de skill qui conserve son code jusqu au renderer.
 *
 * La couche IPC (`classifyThrown`) ne preserve un code typé que si le `name` de
 * l erreur a ete enregistre via `registerKnownErrorCode`. Un `new Error(...)` nu
 * retombe donc sur `IPC_HANDLER_ERROR`, ecrase en un message generique unique.
 * En portant le code dans `name`, cette classe rend le message actionnable
 * cote utilisateur (cf. docs/audit-2026-07-fonctionnel.md section 2).
 */
export class SkillRunError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = code;
  }
}

/**
 * Convertit un resultat de runner en echec en erreur portant son code.
 * A utiliser partout ou un service levait `new Error(result.error?.message)`.
 */
export function skillRunError(result: SkillRunnerResult): SkillRunError {
  return new SkillRunError(
    result.error?.code ?? "SKILL_RUN_FAILED",
    result.error?.message ?? result.summary
  );
}
