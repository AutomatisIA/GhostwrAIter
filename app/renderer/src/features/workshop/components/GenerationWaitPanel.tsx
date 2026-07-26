import type { HookOption, PostObjective, PostTypology, StructureOption } from "@shared/types/workshop";
import { InfoHint } from "../../../help";
import type { EngineSignal, PhaseDurations } from "../../create/useGenerationTelemetry";
import { TYPOLOGIES, formatObjectiveLabel } from "../constants";
import { GenerationPulse } from "./GenerationPulse";
import {
  WORKSHOP_PHASE_LABELS,
  WORKSHOP_PHASE_SEQUENCE,
  formatSeconds,
  type WorkshopPhaseKey
} from "./generation-phases";

type GenerationWaitPanelProps = {
  activePhase: WorkshopPhaseKey | null;
  elapsedMs: number;
  durations: PhaseDurations;
  signal: EngineSignal;
  typology: PostTypology;
  objective: PostObjective;
  selectedStructure: StructureOption | undefined;
  selectedHook: HookOption | undefined;
  fallbackHookText?: string;
  pillarLabel?: string;
};

const UNDECIDED = "À choisir";

/**
 * Une decision rappelee. `term` porte l aide de vocabulaire, qui vivait sur le
 * guide lateral supprime : elle revient ici, ou la place ne manque pas, plutot
 * que sur la bande de contexte, ou chaque etiquette tient sur une ligne.
 */
type RecapRow = {
  key: string;
  label: string;
  term: "typologie" | "objectif" | "structure" | "accroche" | "pilier";
  value: string;
};

function readableStructure(label: string): string {
  return label
    .split(/\s*->\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" › ");
}

/**
 * Ecran d attente de generation.
 *
 * Il existe parce qu une generation dure de vingt a cent secondes et que
 * l application donnait, pendant tout ce temps, l impression d avoir plante.
 * Trois partis pris :
 *
 * - aucun voile modal, aucune desactivation de la navigation : l utilisateur
 *   reste libre de circuler ;
 * - un temps ecoule plutot qu un pourcentage, parce que le second serait faux ;
 * - le rappel des decisions a droite, parce que l attente est le seul moment ou
 *   les relire ne coute rien.
 */
export function GenerationWaitPanel({
  activePhase,
  elapsedMs,
  durations,
  signal,
  typology,
  objective,
  selectedStructure,
  selectedHook,
  fallbackHookText,
  pillarLabel
}: GenerationWaitPanelProps) {
  const activeIndex = activePhase ? WORKSHOP_PHASE_SEQUENCE.indexOf(activePhase) : -1;
  const phaseLabel = activePhase
    ? WORKSHOP_PHASE_LABELS[activePhase]
    : "Génération en cours";

  const hookText = selectedHook?.text ?? fallbackHookText;
  const decisions: RecapRow[] = [
    {
      key: "typologie",
      label: "Typologie",
      term: "typologie",
      value: TYPOLOGIES.find((item) => item.value === typology)?.label ?? UNDECIDED
    },
    {
      key: "objectif",
      label: "Objectif",
      term: "objectif",
      value: formatObjectiveLabel(objective)
    },
    {
      key: "structure",
      label: "Structure",
      term: "structure",
      value: selectedStructure?.label ? readableStructure(selectedStructure.label) : UNDECIDED
    },
    {
      key: "accroche",
      label: "Accroche retenue",
      term: "accroche",
      value: hookText ?? UNDECIDED
    },
    {
      key: "pilier",
      label: "Pilier éditorial",
      term: "pilier",
      value: pillarLabel ?? UNDECIDED
    }
  ];

  return (
    <div className="wait-screen">
      <div className="wait-main">
        <GenerationPulse phaseLabel={phaseLabel} elapsedMs={elapsedMs} signal={signal} />

        <section className="wait-phases">
          <span className="eyebrow">Phases, avec leur durée réelle</span>

          <ol className="wait-phases__list">
            {WORKSHOP_PHASE_SEQUENCE.map((phase, index) => {
              const measured = durations[phase];
              const isActive = phase === activePhase;
              let value: string;
              if (isActive) value = formatSeconds(elapsedMs);
              else if (measured !== undefined) value = formatSeconds(measured);
              else if (activeIndex >= 0 && index < activeIndex) value = "non mesurée";
              else value = "en attente";

              return (
                <li
                  key={phase}
                  className="wait-phases__row"
                  data-state={isActive ? "active" : measured !== undefined ? "done" : "pending"}
                >
                  <span className="wait-phases__label">{WORKSHOP_PHASE_LABELS[phase]}</span>
                  <span className="wait-phases__value">{value}</span>
                </li>
              );
            })}
          </ol>

          <p className="wait-phases__caveat">
            Aucun pourcentage : sur une durée non prédictible, il mentirait quatre fois sur
            cinq. Les durées affichées sont mesurées pendant cette session ; une phase
            déjà passée avant l&apos;ouverture de l&apos;atelier n&apos;en a pas.
          </p>
        </section>
      </div>

      <aside className="wait-recap">
        <div className="wait-recap__head">
          <span className="eyebrow">Ce que vous avez décidé</span>
        </div>
        <div className="wait-recap__body">
          <dl className="wait-recap__list">
            {decisions.map((decision) => (
              <div key={decision.key} className="wait-recap__row">
                <dt className="wait-recap__label">
                  {decision.label} <InfoHint term={decision.term} />
                </dt>
                <dd className="wait-recap__value">{decision.value}</dd>
              </div>
            ))}
          </dl>
          <p className="wait-recap__note">
            L&apos;attente est le seul moment où relire ces choix ne coûte rien.
          </p>
        </div>
      </aside>
    </div>
  );
}
