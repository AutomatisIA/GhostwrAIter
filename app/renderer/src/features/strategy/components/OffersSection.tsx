import type { StrategyBundleInput } from "@shared/schemas/strategy";
import { Button, EmptyState } from "../../../design-system/primitives";
import { CompletenessIndicator } from "./CompletenessIndicator";
import { SectionHead } from "./SectionHead";
import { StrategyField } from "./StrategyField";
import { isFilled } from "./completeness-text";

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
  const complete = offers.filter(
    (offer) => isFilled(offer.name) && isFilled(offer.promise)
  ).length;
  const incomplete = offers.length - complete;

  let consequence: string | null = null;
  if (offers.length === 0) {
    consequence =
      "Aucune offre renseignée. Les posts n'auront pas d'appel à l'action ancré dans une offre, sans que la génération échoue. Il n'y a pas de nombre imposé : une seule suffit pour commencer.";
  } else if (incomplete > 0) {
    consequence = `${incomplete} offre${incomplete > 1 ? "s" : ""} sans nom ni promesse. Elle${
      incomplete > 1 ? "s ne seront" : " ne sera"
    } pas mobilisée${incomplete > 1 ? "s" : ""} à la génération, sans que celle-ci échoue.`;
  }

  return (
    <section className="strategy-section" aria-label="Offres">
      <SectionHead
        title="Offres"
        lead="Chaque offre sert à relier les posts à un problème concret et à un appel à l'action crédible."
        action={
          <Button variant="secondary" onClick={onAdd}>
            Ajouter une offre
          </Button>
        }
      />

      <CompletenessIndicator
        filled={complete}
        total={offers.length}
        unitOne="offre"
        unitMany="offres"
        emptyLabel="Aucune offre"
        consequence={consequence}
      />

      {offers.length === 0 ? (
        <div className="strategy-surface strategy-empty">
          <EmptyState
            title="Aucune offre"
            description="Ajoutez au moins une offre pour orienter vos contenus vers le business : la promesse, les problèmes résolus et un appel à l'action crédible."
            action={{ label: "Ajouter une offre", onClick: onAdd }}
          />
        </div>
      ) : null}

      {offers.map((offer, index) => (
        <section
          key={`offer-${index}`}
          className="strategy-surface strategy-item"
          aria-label={`Offre ${index + 1}`}
        >
          <div className="strategy-item__head">
            <span className="strategy-item__title">Offre {index + 1}</span>
            <Button variant="danger" size="sm" onClick={() => onRemove(index)}>
              Retirer
            </Button>
          </div>

          <StrategyField
            field="offer-name"
            controlId={`offer-name-${index}`}
            label="Nom"
            help="Un nom court et reconnaissable pour cette offre."
          >
            <input
              value={offer.name}
              onChange={(event) => onUpdate(index, "name", event.target.value)}
              placeholder="Ex. Audit IA PME"
            />
          </StrategyField>

          <StrategyField
            field="offer-promise"
            controlId={`offer-promise-${index}`}
            label="Promesse"
            help="Le résultat concret que le client obtient, en une phrase."
            align="start"
          >
            <textarea
              value={offer.promise}
              onChange={(event) => onUpdate(index, "promise", event.target.value)}
              placeholder="Ex. Prioriser les cas d'usage utiles en 10 jours."
            />
          </StrategyField>

          <StrategyField
            field="offer-problems"
            controlId={`offer-problems-${index}`}
            label="Problèmes traités"
            help="Les difficultés que vivent vos clients avant de vous solliciter."
            align="start"
          >
            <textarea
              value={offer.problems}
              onChange={(event) => onUpdate(index, "problems", event.target.value)}
              placeholder="Ex. Trop d'idées IA, aucune priorisation, pas de sponsor clair."
            />
          </StrategyField>

          <StrategyField
            field="offer-proofs"
            controlId={`offer-proofs-${index}`}
            label="Preuves ou résultats"
            help="Ce qui rend votre offre crédible : missions, chiffres, retours."
            align="start"
          >
            <textarea
              value={offer.proofPoints ?? ""}
              onChange={(event) => onUpdate(index, "proofPoints", event.target.value)}
              placeholder="Ex. 3 missions menées, 2 pilotes lancés, 1 roadmap validée."
            />
          </StrategyField>

          <StrategyField
            field="offer-cta"
            controlId={`offer-cta-${index}`}
            label="Appel à l'action"
            help="Comment un lecteur intéressé peut concrètement passer à l'étape suivante. C'est aussi son mode d'entrée dans l'offre."
          >
            <input
              value={offer.ctaModes ?? ""}
              onChange={(event) => onUpdate(index, "ctaModes", event.target.value)}
              placeholder="Ex. Appel diagnostic de 30 minutes."
            />
          </StrategyField>
        </section>
      ))}
    </section>
  );
}
