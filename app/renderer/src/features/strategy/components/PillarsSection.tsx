import type { StrategyBundleInput } from "@shared/schemas/strategy";
import { Button, EmptyState } from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
import { CompletenessIndicator } from "./CompletenessIndicator";
import { SectionHead } from "./SectionHead";
import { StrategyField } from "./StrategyField";
import { isFilled } from "./completeness-text";

type PillarsSectionProps = {
  pillars: StrategyBundleInput["pillars"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    field: keyof StrategyBundleInput["pillars"][number],
    value: string | boolean
  ) => void;
};

export function PillarsSection({
  pillars,
  onAdd,
  onRemove,
  onUpdate
}: PillarsSectionProps) {
  const complete = pillars.filter((pillar) => isFilled(pillar.label)).length;
  const incomplete = pillars.length - complete;

  let consequence: string | null = null;
  if (pillars.length === 0) {
    consequence =
      "Aucun pilier défini. Les idées générées ne seront rattachées à aucun thème et le calendrier restera sans ligne directrice, sans que la génération échoue. Deux à quatre piliers suffisent.";
  } else if (incomplete > 0) {
    consequence = `${incomplete} pilier${incomplete > 1 ? "s" : ""} sans intitulé. Il${
      incomplete > 1 ? "s ne seront" : " ne sera"
    } pas proposé${incomplete > 1 ? "s" : ""} au classement des idées, sans que la génération échoue.`;
  }

  return (
    <section className="strategy-section" aria-label="Piliers éditoriaux">
      <SectionHead
        title="Piliers éditoriaux"
        hint={<InfoHint term="pilier" />}
        lead="Les piliers servent à organiser le backlog, la bibliothèque et le calendrier."
        action={
          <Button variant="secondary" onClick={onAdd}>
            Ajouter un pilier
          </Button>
        }
      />

      <CompletenessIndicator
        filled={complete}
        total={pillars.length}
        unitOne="pilier"
        unitMany="piliers"
        emptyLabel="Aucun pilier"
        consequence={consequence}
      />

      {pillars.length === 0 ? (
        <div className="strategy-surface strategy-empty">
          <EmptyState
            title="Aucun pilier"
            description="Définissez deux à quatre grands thèmes autour desquels vous publiez. Chaque idée et chaque post se rattachera à l'un d'eux pour garder une ligne cohérente."
            action={{ label: "Ajouter un pilier", onClick: onAdd }}
          />
        </div>
      ) : null}

      {pillars.map((pillar, index) => (
        <section
          key={`pillar-${index}`}
          className="strategy-surface strategy-item"
          aria-label={`Pilier ${index + 1}`}
        >
          <div className="strategy-item__head">
            <span className="strategy-item__title">Pilier {index + 1}</span>
            <Button variant="danger" size="sm" onClick={() => onRemove(index)}>
              Retirer
            </Button>
          </div>

          <StrategyField
            field="pillar-label"
            controlId={`pillar-label-${index}`}
            label="Intitulé"
            help="Un thème court qui revient dans vos publications."
          >
            <input
              value={pillar.label}
              onChange={(event) => onUpdate(index, "label", event.target.value)}
              placeholder="Ex. Adoption IA, Recrutement, Relation client"
            />
          </StrategyField>

          <StrategyField
            field="pillar-description"
            controlId={`pillar-description-${index}`}
            label="Description"
            help="Ce que recouvre ce thème, pour cadrer les idées qui en relèvent."
            align="start"
          >
            <textarea
              value={pillar.description ?? ""}
              onChange={(event) => onUpdate(index, "description", event.target.value)}
              placeholder="Ex. Comment cadrer, embarquer l'équipe et déployer sans friction."
            />
          </StrategyField>

          <div className="strategy-row strategy-row--plain">
            <label className="strategy-check">
              <input
                type="checkbox"
                checked={pillar.isDefault}
                onChange={(event) => onUpdate(index, "isDefault", event.target.checked)}
              />
              <span>Pilier par défaut</span>
            </label>
          </div>
        </section>
      ))}
    </section>
  );
}
