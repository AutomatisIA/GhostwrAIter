import type { StrategyBundleInput } from "@shared/schemas/strategy";
import { Button, Card, EmptyState, Field } from "../../../design-system/primitives";
import { CompletenessIndicator } from "./CompletenessIndicator";

type OffersSectionProps = {
  offers: StrategyBundleInput["offers"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    field: keyof StrategyBundleInput["offers"][number],
    value: string
  ) => void;
};

export function OffersSection({ offers, onAdd, onRemove, onUpdate }: OffersSectionProps) {
  return (
    <section className="editor-section">
      <div className="section-heading">
        <div>
          <h2>Offres</h2>
          <p>Chaque offre sert à relier les posts à un problème concret et à un appel à l'action crédible.</p>
        </div>
        <Button variant="secondary" onClick={onAdd}>
          Ajouter une offre
        </Button>
      </div>

      <CompletenessIndicator
        filled={Math.min(offers.length, 5)}
        total={5}
        critical={offers.length === 0}
        impactedSkill="post-writer"
      />

      {offers.length === 0 ? (
        <Card elevation={1}>
          <EmptyState
            title="Aucune offre"
            description="Ajoutez au moins une offre pour orienter vos contenus vers le business : la promesse, les problèmes résolus et un appel à l'action crédible."
            action={{ label: "Ajouter une offre", onClick: onAdd }}
          />
        </Card>
      ) : null}

      {offers.map((offer, index) => (
        <Card key={`offer-${index}`} elevation={1} className="editor-card">
          <div className="section-heading compact">
            <strong>Offre {index + 1}</strong>
            <Button variant="danger" size="sm" onClick={() => onRemove(index)}>
              Retirer
            </Button>
          </div>

          <div className="strategy-fields">
            <Field
              label={`Nom de l'offre ${index + 1}`}
              htmlFor={`offer-name-${index}`}
              hint="Un nom court et reconnaissable pour cette offre."
            >
              <input
                value={offer.name}
                onChange={(event) => onUpdate(index, "name", event.target.value)}
                placeholder="Ex. Audit IA PME"
              />
            </Field>

            <Field
              label={`Promesse de l'offre ${index + 1}`}
              htmlFor={`offer-promise-${index}`}
              hint="Le résultat concret que le client obtient, en une phrase."
              example="Prioriser les cas d'usage utiles en 10 jours."
            >
              <textarea
                rows={2}
                value={offer.promise}
                onChange={(event) => onUpdate(index, "promise", event.target.value)}
                placeholder="Ex. Prioriser les cas d'usage utiles en 10 jours."
              />
            </Field>

            <Field
              label={`Problèmes traités par l'offre ${index + 1}`}
              htmlFor={`offer-problems-${index}`}
              hint="Les difficultés que vivent vos clients avant de vous solliciter."
              example="Trop d'idées IA, aucune priorisation, pas de sponsor clair."
            >
              <textarea
                rows={2}
                value={offer.problems}
                onChange={(event) => onUpdate(index, "problems", event.target.value)}
                placeholder="Ex. Trop d'idées IA, aucune priorisation, pas de sponsor clair."
              />
            </Field>

            <Field
              label="Preuves ou résultats"
              htmlFor={`offer-proofs-${index}`}
              hint="Ce qui rend votre offre crédible : missions, chiffres, retours."
              example="3 missions menées, 2 pilotes lancés, 1 roadmap validée."
            >
              <textarea
                value={offer.proofPoints ?? ""}
                onChange={(event) => onUpdate(index, "proofPoints", event.target.value)}
                rows={2}
                placeholder="Ex. 3 missions menées, 2 pilotes lancés, 1 roadmap validée."
              />
            </Field>

            <Field
              label="Appel à l'action ou mode d'entrée"
              htmlFor={`offer-cta-${index}`}
              hint="Comment un lecteur intéressé peut concrètement passer à l'étape suivante."
              example="Appel diagnostic de 30 minutes."
            >
              <input
                value={offer.ctaModes ?? ""}
                onChange={(event) => onUpdate(index, "ctaModes", event.target.value)}
                placeholder="Ex. Appel diagnostic de 30 minutes."
              />
            </Field>
          </div>
        </Card>
      ))}
    </section>
  );
}
