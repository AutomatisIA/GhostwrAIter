import { z } from "zod";

/**
 * Input shape accepted by `ideas:create`. Every field is required
 * and non-empty: a manual idea must have a title, a defensible
 * angle, and a pillar label tying it to the editorial strategy.
 */
export const ideaInputSchema = z
  .object({
    title: z.string().min(1, "title is required"),
    angle: z.string().min(1, "angle is required"),
    pillarLabel: z.string().min(1, "pillarLabel is required"),
    /**
     * Segment de la cible visee. Optionnel : une idee creee sans cible reste
     * valide et retombe sur l ancien comportement (toutes les cibles envoyees
     * au modele). Le champ porte le segment, pas l identifiant, parce que les
     * identifiants de cibles sont regeneres a chaque enregistrement de la
     * strategie (cf. `IdeaRecord.targetIcpSegment`).
     */
    targetIcpSegment: z.string().trim().min(1, "targetIcpSegment must not be blank").optional()
  })
  .strict();

export type IdeaInput = z.infer<typeof ideaInputSchema>;

/**
 * Input shape accepted by `ideas:create-from-news-source`. Both
 * fields are required and non-empty so the strict-execution
 * Codex doctrine has enough material to refuse a weak source
 * downstream without the handler crashing on a missing field
 * upstream.
 */
export const newsSourceInputSchema = z
  .object({
    sourceTitle: z.string().min(1, "sourceTitle is required"),
    sourceSummary: z.string().min(1, "sourceSummary is required"),
    /**
     * Meme champ, meme role que sur `ideaInputSchema`. La doctrine editoriale
     * vaut pour TOUT post, quelle que soit sa porte d entree : sans ce champ
     * ici, un post issu d une veille recevrait encore toutes les cibles, et la
     * fonctionnalite ne tiendrait sa promesse que sur la saisie manuelle.
     */
    targetIcpSegment: z.string().trim().min(1, "targetIcpSegment must not be blank").optional()
  })
  .strict();

export type NewsSourceInput = z.infer<typeof newsSourceInputSchema>;

/**
 * Input schema for `ideas:generate-from-strategy`.
 *
 * Optionnel dans les deux sens : le canal acceptait `undefined` et doit
 * continuer a le faire, un appel sans cible restant valide. Quand une cible est
 * fournie, le generateur ne recoit QUE celle-la et chaque sujet produit la
 * porte. C est la troisieme et derniere porte d entree qui cree des idees, et
 * la seule ou l utilisateur n aurait aucun moment ulterieur pour designer une
 * cible : une idee generee sans cible le resterait pour toujours.
 */
export const generateFromStrategySchema = z
  .object({
    targetIcpSegment: z.string().trim().min(1, "targetIcpSegment must not be blank").optional()
  })
  .strict()
  .optional();

export type GenerateFromStrategyInput = z.infer<typeof generateFromStrategySchema>;

// Re-export the shared empty-input schema for `ideas:list`.
export { emptyInputSchema } from "./common";
