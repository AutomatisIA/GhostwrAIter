import type { StrategyBundleInput } from "@shared/schemas/strategy";
import { Button, Card, EmptyState, Field } from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
import { CompletenessIndicator } from "./CompletenessIndicator";

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
  return (
    <section className="editor-section">
      <div className="section-heading">
        <div>
          <h2 className="section-title-with-hint">
            Piliers éditoriaux
            <InfoHint term="pilier" />
          </h2>
          <p>Les piliers servent à organiser le backlog, la bibliothèque et le calendrier.</p>
        </div>
        <Button variant="secondary" onClick={onAdd}>
          Ajouter un pilier
        </Button>
      </div>

      <CompletenessIndicator
        filled={Math.min(pillars.length, 5)}
        total={5}
        critical={pillars.length === 0}
        impactedSkill="topic-generator"
      />

      {pillars.length === 0 ? (
        <Card elevation={1}>
          <EmptyState
            title="Aucun pilier"
            description="Définissez deux à quatre grands thèmes autour desquels vous publiez. Chaque idée et chaque post se rattachera à l'un d'eux pour garder une ligne cohérente."
            action={{ label: "Ajouter un pilier", onClick: onAdd }}
          />
        </Card>
      ) : null}

      {pillars.map((pillar, index) => (
        <Card key={`pillar-${index}`} elevation={1} className="editor-card">
          <div className="section-heading compact">
            <strong>Pilier {index + 1}</strong>
            <Button variant="danger" size="sm" onClick={() => onRemove(index)}>
              Retirer
            </Button>
          </div>

          <div className="strategy-fields">
            <Field
              label={`Label du pilier ${index + 1}`}
              htmlFor={`pillar-label-${index}`}
              hint="Un thème court qui revient dans vos publications."
              example="Adoption IA, Recrutement, Relation client."
            >
              <input
                value={pillar.label}
                onChange={(event) => onUpdate(index, "label", event.target.value)}
                placeholder="Ex. Adoption IA"
              />
            </Field>

            <Field
              label="Description du pilier"
              htmlFor={`pillar-description-${index}`}
              hint="Ce que recouvre ce thème, pour cadrer les idées qui en relèvent."
              example="Comment cadrer, embarquer l'équipe et déployer sans friction."
            >
              <textarea
                rows={2}
                value={pillar.description ?? ""}
                onChange={(event) => onUpdate(index, "description", event.target.value)}
                placeholder="Ex. Comment cadrer, embarquer l'équipe et déployer sans friction."
              />
            </Field>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={pillar.isDefault}
                onChange={(event) => onUpdate(index, "isDefault", event.target.checked)}
              />
              <span>Pilier par défaut</span>
            </label>
          </div>
        </Card>
      ))}
    </section>
  );
}
