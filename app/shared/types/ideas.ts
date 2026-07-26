export type IdeaRecord = {
  id: string;
  title: string;
  angle: string;
  pillarLabel: string;
  createdAt: string;
  /**
   * Segment de la cible visee par ce post, ou `null` quand aucune cible n a ete
   * choisie (idees creees avant le champ, idees issues d une veille).
   *
   * On stocke le SEGMENT et non l identifiant de la cible : `saveBundle` vide
   * la table `icps` puis la reinsere a chaque enregistrement de la strategie,
   * donc les identifiants sont regeneres et un identifiant stocke ici serait
   * orphelin des la prochaine visite de l ecran Strategie. Le segment est le
   * libelle que l utilisateur voit et modifie sciemment.
   *
   * Un segment qui ne correspond plus a aucune cible courante (renommee,
   * supprimee) retombe sur le meme chemin que `null` : toutes les cibles.
   */
  targetIcpSegment: string | null;
};

// Re-exported from the zod schema in app/shared/schemas/ideas.ts which is
// now the single source of truth for the IPC input shapes (feature 003).
import type {
  GenerateFromStrategyInput,
  IdeaInput,
  NewsSourceInput
} from "../schemas/ideas";
export type { GenerateFromStrategyInput, IdeaInput, NewsSourceInput };

export type IdeaDraftCreationResult = {
  idea: IdeaRecord;
  draft: {
    id: string;
    headline: string;
    bodyMarkdown: string;
    qualityScore: number;
  };
  hooks: Array<{
    id: string;
    text: string;
  }>;
  run: {
    id: string;
    skillName: string;
    status: "succeeded" | "failed" | "partial";
    summary: string;
  };
  versions: Array<{
    id: string;
    bodyMarkdown: string;
    qualityScore: number;
    reason: "generation" | "correction" | "variant";
    createdAt: string;
  }>;
  contextUsed: {
    pillarLabel: string;
    voiceGuardrail: string;
    activeSkills: string[];
  };
};

export type IdeasApi = {
  listIdeas: () => Promise<IdeaRecord[]>;
  createIdea: (idea: IdeaInput) => Promise<IdeaRecord>;
  createFromNewsSource: (input: NewsSourceInput) => Promise<IdeaDraftCreationResult>;
  generateFromStrategy: (input?: GenerateFromStrategyInput) => Promise<IdeaRecord[]>;
};
