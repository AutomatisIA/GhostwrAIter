import type { StrategyBundleInput } from "@shared/schemas/strategy";

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
          <p>Chaque offre sert a relier les posts a un probleme concret et a un CTA credible.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onAdd}>
          Ajouter une offre
        </button>
      </div>

      {offers.length === 0 ? (
        <p className="empty-state">
          Aucune offre. Ajoute au moins une offre si tu veux orienter tes contenus vers le business.
        </p>
      ) : null}

      {offers.map((offer, index) => (
        <article key={`offer-${index}`} className="editor-card">
          <div className="section-heading compact">
            <strong>Offre {index + 1}</strong>
            <button
              type="button"
              className="secondary-button danger-button"
              onClick={() => onRemove(index)}
            >
              Retirer
            </button>
          </div>

          <label className="field">
            <span>Nom de l'offre {index + 1}</span>
            <input
              aria-label={`Nom de l'offre ${index + 1}`}
              value={offer.name}
              onChange={(event) => onUpdate(index, "name", event.target.value)}
              placeholder="Ex. Audit IA PME"
            />
          </label>

          <label className="field">
            <span>Promesse de l'offre {index + 1}</span>
            <textarea
              aria-label={`Promesse de l'offre ${index + 1}`}
              rows={2}
              value={offer.promise}
              onChange={(event) => onUpdate(index, "promise", event.target.value)}
              placeholder="Ex. Prioriser les cas d'usage utiles en 10 jours."
            />
          </label>

          <label className="field">
            <span>Problemes traites par l'offre {index + 1}</span>
            <textarea
              aria-label={`Problemes traites par l'offre ${index + 1}`}
              rows={2}
              value={offer.problems}
              onChange={(event) => onUpdate(index, "problems", event.target.value)}
              placeholder="Ex. Trop d'idees IA, aucune priorisation, pas de sponsor clair."
            />
          </label>

          <label className="field">
            <span>Preuves ou resultats</span>
            <textarea
              value={offer.proofPoints ?? ""}
              onChange={(event) => onUpdate(index, "proofPoints", event.target.value)}
              rows={2}
              placeholder="Ex. 3 missions menees, 2 pilotes lances, 1 roadmap validee."
            />
          </label>

          <label className="field">
            <span>CTA ou mode d'entree</span>
            <input
              value={offer.ctaModes ?? ""}
              onChange={(event) => onUpdate(index, "ctaModes", event.target.value)}
              placeholder="Ex. Appel diagnostic de 30 minutes."
            />
          </label>
        </article>
      ))}
    </section>
  );
}
