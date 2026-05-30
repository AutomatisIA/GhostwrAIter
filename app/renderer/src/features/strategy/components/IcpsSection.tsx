import type { StrategyBundleInput } from "@shared/schemas/strategy";
import { Button, Card, EmptyState, Field } from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
import { CompletenessIndicator } from "./CompletenessIndicator";

type IcpsSectionProps = {
  icps: StrategyBundleInput["icps"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    field: keyof StrategyBundleInput["icps"][number],
    value: string
  ) => void;
};

export function IcpsSection({ icps, onAdd, onRemove, onUpdate }: IcpsSectionProps) {
  return (
    <section className="editor-section">
      <div className="section-heading">
        <div>
          <h2 className="section-title-with-hint">
            ICP
            <InfoHint term="icp" />
          </h2>
          <p>
            Ces portraits permettent d'écrire pour des problèmes et un langage réels, pas pour
            « tout le monde ».
          </p>
        </div>
        <Button variant="secondary" onClick={onAdd}>
          Ajouter un ICP
        </Button>
      </div>

      <CompletenessIndicator
        filled={Math.min(icps.length, 5)}
        total={5}
        critical={icps.length === 0}
        impactedSkill="hook-engine"
      />

      {icps.length === 0 ? (
        <Card elevation={1}>
          <EmptyState
            title="Aucun client idéal défini"
            description="Décrivez au moins un client idéal : son métier, ses douleurs et ses mots à lui. Vos posts parleront à de vraies personnes plutôt qu'à tout le monde."
            action={{ label: "Ajouter un ICP", onClick: onAdd }}
          />
        </Card>
      ) : null}

      {icps.map((icp, index) => (
        <Card key={`icp-${index}`} elevation={1} className="editor-card">
          <div className="section-heading compact">
            <strong>ICP {index + 1}</strong>
            <Button variant="danger" size="sm" onClick={() => onRemove(index)}>
              Retirer
            </Button>
          </div>

          <div className="strategy-fields">
            <Field
              label={`Segment ${index + 1}`}
              htmlFor={`icp-segment-${index}`}
              hint="Le type de client visé : métier, taille d'entreprise, contexte."
              example="Dirigeant de PME de 20 à 200 personnes."
            >
              <input
                value={icp.segment}
                onChange={(event) => onUpdate(index, "segment", event.target.value)}
                placeholder="Ex. Dirigeant de PME de 20 à 200 personnes"
              />
            </Field>

            <Field
              label={`Douleurs principales ${index + 1}`}
              htmlFor={`icp-pains-${index}`}
              hint="Ce qui empêche ce client de dormir, dans ses propres termes."
              example="Trop de bruit, peu de ROI, équipe pas alignée."
            >
              <textarea
                rows={2}
                value={icp.pains}
                onChange={(event) => onUpdate(index, "pains", event.target.value)}
                placeholder="Ex. Trop de bruit, peu de ROI, équipe pas alignée."
              />
            </Field>

            <Field
              label="Objections"
              htmlFor={`icp-objections-${index}`}
              hint="Les freins qui le retiennent avant de vous faire confiance."
              example="J'ai peur d'un gadget de plus ou d'un projet sans adoption."
            >
              <textarea
                rows={2}
                value={icp.objections ?? ""}
                onChange={(event) => onUpdate(index, "objections", event.target.value)}
                placeholder="Ex. J'ai peur d'un gadget de plus ou d'un projet sans adoption."
              />
            </Field>

            <Field
              label="Résultats attendus"
              htmlFor={`icp-outcomes-${index}`}
              hint="Le succès concret qu'il espère obtenir."
              example="Un premier cas d'usage rentable et défendable en interne."
            >
              <textarea
                rows={2}
                value={icp.desiredOutcomes ?? ""}
                onChange={(event) => onUpdate(index, "desiredOutcomes", event.target.value)}
                placeholder="Ex. Un premier cas d'usage rentable et défendable en interne."
              />
            </Field>

            <Field
              label="Indices de langage"
              htmlFor={`icp-language-${index}`}
              hint="Les mots qu'il emploie, à reprendre pour qu'il se reconnaisse."
              example="Concret, rentable, équipe, process, risque."
            >
              <textarea
                rows={2}
                value={icp.languageCues ?? ""}
                onChange={(event) => onUpdate(index, "languageCues", event.target.value)}
                placeholder="Ex. Concret, rentable, équipe, process, risque."
              />
            </Field>

            <Field
              label="Comportement LinkedIn"
              htmlFor={`icp-behavior-${index}`}
              hint="Comment il se comporte sur LinkedIn : lit, commente, partage."
              example="Lit des retours terrain, commente peu, partage les cas réels."
            >
              <textarea
                rows={2}
                value={icp.linkedinBehavior ?? ""}
                onChange={(event) => onUpdate(index, "linkedinBehavior", event.target.value)}
                placeholder="Ex. Lit des retours terrain, commente peu, partage les cas réels."
              />
            </Field>
          </div>
        </Card>
      ))}
    </section>
  );
}
