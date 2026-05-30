import type { PostObjective, PostTypology } from "@shared/types/workshop";

export const TYPOLOGIES: { value: PostTypology; label: string; description: string }[] = [
  {
    value: "expertise",
    label: "Expertise",
    description: "Partage un savoir-faire technique ou une méthode."
  },
  {
    value: "contrarian",
    label: "Contrarien",
    description: "Prend le contre-pied d'une idée reçue sur le marché."
  },
  {
    value: "case_study",
    label: "Cas Client",
    description: "Analyse un problème réel et les résultats obtenus."
  },
  {
    value: "tutorial",
    label: "Tuto / Guide",
    description: "Donne des étapes actionnables pour résoudre un problème."
  },
  {
    value: "thought_leadership",
    label: "Vision",
    description: "Partage une perspective sur le futur de l'IA et des PME."
  }
];

export const OBJECTIVES: { value: PostObjective; label: string }[] = [
  { value: "awareness", label: "Visibilité" },
  { value: "authority", label: "Autorité" },
  { value: "conversion", label: "Conversion" },
  { value: "engagement", label: "Engagement" }
];

export const STEP_LABELS = [
  "1. Choisir le cadrage",
  "2. Choisir la structure",
  "3. Choisir l'accroche",
  "4. Finaliser le draft"
] as const;

export function formatObjectiveLabel(objective: PostObjective): string {
  return OBJECTIVES.find((item) => item.value === objective)?.label ?? objective;
}

export function formatTypologyDescription(typology: PostTypology): string {
  return TYPOLOGIES.find((item) => item.value === typology)?.description ?? "";
}

export function getQualityFeedback(score: number): { title: string; message: string } {
  if (score < 0.7) {
    return {
      title: "Draft encore fragile",
      message:
        "Le texte a une base exploitable, mais il reste trop générique ou trop peu spécifique pour être publié tel quel."
    };
  }
  if (score < 0.85) {
    return {
      title: "Base correcte à renforcer",
      message:
        "Le draft tient debout, mais il mérite encore un passage de concret, d'exemples ou de tension avant publication."
    };
  }
  return {
    title: "Draft solide",
    message: "Le texte est relativement propre, mais garde une relecture humaine avant publication."
  };
}
