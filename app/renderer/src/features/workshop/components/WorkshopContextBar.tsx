import type { HookOption, PostObjective, PostTypology, StructureOption } from "@shared/types/workshop";
import { Button } from "../../../design-system/primitives";
import { STEP_LABELS, TYPOLOGIES, formatObjectiveLabel } from "../constants";

type WorkshopContextBarProps = {
  step: number;
  status: string;
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

const CHIP_MAX_CHARS = 46;

function shorten(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= CHIP_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, CHIP_MAX_CHARS - 1)}…`;
}

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
 * le faire. Les memes decisions tiennent ici sur une ligne de 52 px, et la
 * place recuperee revient au texte du post et a son apercu.
 *
 * Rien n est perdu au passage : la position dans le parcours, les quatre
 * decisions et l etat courant sont tous portes ici. L aide de vocabulaire, qui
 * vivait sur le guide, reste attachee aux ecrans ou la decision se prend, et
 * revient sur le panneau de rappel de l ecran d attente.
 */
export function WorkshopContextBar({
  step,
  status,
  typology,
  objective,
  selectedStructure,
  selectedHook,
  fallbackHookText,
  pillarLabel,
  onReopenCadrage
}: WorkshopContextBarProps) {
  const hookText = selectedHook?.text ?? fallbackHookText;
  const chips: { key: string; role: string; value: string }[] = [];

  const typologyLabel = TYPOLOGIES.find((item) => item.value === typology)?.label;
  if (typologyLabel) chips.push({ key: "typologie", role: "Typologie", value: typologyLabel });
  chips.push({ key: "objectif", role: "Objectif", value: formatObjectiveLabel(objective) });
  if (selectedStructure?.label) {
    chips.push({
      key: "structure",
      role: "Structure",
      value: readableStructure(selectedStructure.label)
    });
  }
  if (hookText) chips.push({ key: "accroche", role: "Accroche", value: hookText });
  if (pillarLabel) chips.push({ key: "pilier", role: "Pilier éditorial", value: pillarLabel });

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
            {shorten(chip.value)}
          </span>
        ))}
      </div>

      <span className="workshop-context__status">{status}</span>

      {onReopenCadrage ? (
        <Button variant="ghost" size="sm" onClick={onReopenCadrage}>
          Revenir au cadrage
        </Button>
      ) : null}
    </div>
  );
}
