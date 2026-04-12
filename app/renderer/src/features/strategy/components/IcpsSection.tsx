import type { StrategyBundleInput } from "@shared/schemas/strategy";
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
          <h2>ICP</h2>
          <p>
            Les personas permettent d'ecrire pour des problemes et un langage reel, pas pour
            “tout le monde”.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={onAdd}>
          Ajouter un ICP
        </button>
      </div>

      <CompletenessIndicator
        filled={Math.min(icps.length, 5)}
        total={5}
        critical={icps.length === 0}
        impactedSkill="hook-engine"
      />

      {icps.map((icp, index) => (
        <article key={`icp-${index}`} className="editor-card">
          <div className="section-heading compact">
            <strong>ICP {index + 1}</strong>
            <button
              type="button"
              className="secondary-button danger-button"
              onClick={() => onRemove(index)}
            >
              Retirer
            </button>
          </div>

          <label className="field">
            <span>Segment {index + 1}</span>
            <input
              aria-label={`Segment ${index + 1}`}
              value={icp.segment}
              onChange={(event) => onUpdate(index, "segment", event.target.value)}
              placeholder="Ex. Dirigeant de PME de 20 a 200 personnes"
            />
          </label>

          <label className="field">
            <span>Douleurs principales {index + 1}</span>
            <textarea
              aria-label={`Douleurs principales ${index + 1}`}
              rows={2}
              value={icp.pains}
              onChange={(event) => onUpdate(index, "pains", event.target.value)}
              placeholder="Ex. Trop de bruit, peu de ROI, equipe pas alignee."
            />
          </label>

          <label className="field">
            <span>Objections</span>
            <textarea
              rows={2}
              value={icp.objections ?? ""}
              onChange={(event) => onUpdate(index, "objections", event.target.value)}
              placeholder="Ex. J'ai peur d'un gadget de plus ou d'un projet sans adoption."
            />
          </label>

          <label className="field">
            <span>Resultats attendus</span>
            <textarea
              rows={2}
              value={icp.desiredOutcomes ?? ""}
              onChange={(event) => onUpdate(index, "desiredOutcomes", event.target.value)}
              placeholder="Ex. Un premier cas d'usage rentable et defendable en interne."
            />
          </label>

          <label className="field">
            <span>Indices de langage</span>
            <textarea
              rows={2}
              value={icp.languageCues ?? ""}
              onChange={(event) => onUpdate(index, "languageCues", event.target.value)}
              placeholder="Ex. Concret, rentable, equipe, process, risque."
            />
          </label>

          <label className="field">
            <span>Comportement LinkedIn</span>
            <textarea
              rows={2}
              value={icp.linkedinBehavior ?? ""}
              onChange={(event) => onUpdate(index, "linkedinBehavior", event.target.value)}
              placeholder="Ex. Lit des retours terrain, commente peu, partage les cas reels."
            />
          </label>
        </article>
      ))}
    </section>
  );
}
