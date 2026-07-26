import type { HookOption, PostObjective, PostTypology, StructureOption } from "@shared/types/workshop";
import { Button } from "../../../design-system/primitives";
import { STEP_LABELS, TYPOLOGIES, formatObjectiveLabel } from "../constants";

type WorkshopContextBarProps = {
  step: number;
  /**
   * Etat courant du parcours. Il n est PLUS rendu ici : pose entre la rangee
   * d etiquettes et le retour au cadrage, il ecrasait les deux. La bande porte
   * desormais trois elements seulement, chacun de largeur bornee. La progression
   * d une generation est portee par l ecran d attente, une erreur par le bandeau
   * d erreur ; l etat calme a sa place dans l en-tete de page, qui appartient a
   * l ecran appelant.
   */
  status?: string;
  typology: PostTypology;
  objective: PostObjective;
  selectedStructure: StructureOption | undefined;
  selectedHook: HookOption | undefined;
  /** Accroche persistee sur le brouillon, quand la session est rechargee. */
  fallbackHookText?: string;
  pillarLabel?: string;
  /** Absent pendant une generation : le cadrage ne se rouvre pas a chaud. */
  onReopenCadrage?: () => void;
};

function readableStructure(label: string): string {
  return label
    .split(/\s*->\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" › ");
}

/**
 * Bande de contexte de l atelier.
 *
 * Elle remplace le guide lateral de 340 px, qui rappelait sur trois cartes ce
 * que l utilisateur venait de choisir et prenait un tiers de la largeur pour
 * le faire. Les memes decisions tiennent ici sur une ligne de 48 px, et la
 * place recuperee revient au texte du post et a son apercu.
 *
 * La bande a d abord porte cinq elements, dont un etat de longueur libre et une
 * accroche de plus de soixante caracteres : ils se recouvraient. La correction
 * n est pas d en rendre la rangee defilante, un bord tranche un mot aussi bien
 * dans une rangee qui defile que dans une rangee qui deborde. Elle est d en
 * SORTIR ce qui n avait pas a y etre, et de borner ce qui reste : chaque
 * etiquette s arrete a 26 caracteres et donne son texte entier en infobulle.
 */
export function WorkshopContextBar({
  step,
  typology,
  objective,
  selectedStructure,
  selectedHook,
  fallbackHookText,
  pillarLabel,
  onReopenCadrage
}: WorkshopContextBarProps) {
  const hookText = selectedHook?.text ?? fallbackHookText;
  const chips: { key: string; role: string; value: string; display: string }[] = [];

  function pushChip(key: string, role: string, value: string, display = value) {
    chips.push({ key, role, value, display });
  }

  const typologyLabel = TYPOLOGIES.find((item) => item.value === typology)?.label;
  if (typologyLabel) pushChip("typologie", "Typologie", typologyLabel);
  pushChip("objectif", "Objectif", formatObjectiveLabel(objective));
  if (selectedStructure?.label) {
    pushChip("structure", "Structure", readableStructure(selectedStructure.label));
  }
  // L accroche est la seule decision qui s ecrit en phrase. Son role est donc
  // prefixe au texte visible : coupee a 26 caracteres, « Si vos equipes
  // bloquent des qu un outil… » ne se distinguerait pas d un titre de post.
  if (hookText) pushChip("accroche", "Accroche", hookText, `Accroche : ${hookText}`);
  if (pillarLabel) pushChip("pilier", "Pilier éditorial", pillarLabel);

  return (
    <div className="workshop-context">
      <span className="workshop-context__step">
        Étape {step} sur {STEP_LABELS.length}
      </span>

      <div className="workshop-context__chips">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="workshop-context__chip"
            title={`${chip.role} : ${chip.value}`}
            aria-label={`${chip.role} : ${chip.value}`}
          >
            {chip.display}
          </span>
        ))}
      </div>

      {/* Le retour au cadrage ne s affiche qu a partir de l etape 2. A l etape 1
          on EST sur le cadrage : le bouton restait affiche et ne menait nulle
          part, ce qui en faisait une commande morte au meme rang que les
          vivantes. Un bouton qui ne fait rien est pire qu un bouton absent :
          il apprend a l utilisateur a se mefier des autres. */}
      {onReopenCadrage && step > 1 ? (
        <Button variant="ghost" size="sm" onClick={onReopenCadrage}>
          Revenir au cadrage
        </Button>
      ) : null}
    </div>
  );
}
