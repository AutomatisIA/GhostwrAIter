import type { StrategyBundleInput } from "@shared/schemas/strategy";
import { Button, EmptyState } from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
import { CompletenessIndicator } from "./CompletenessIndicator";
import { SectionHead } from "./SectionHead";
import { StrategyField } from "./StrategyField";
import { isFilled } from "./completeness-text";

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
  const complete = icps.filter((icp) => isFilled(icp.segment) && isFilled(icp.pains)).length;
  const incomplete = icps.length - complete;

  let consequence: string | null = null;
  if (icps.length === 0) {
    consequence =
      "Aucun client idéal décrit. Les accroches viseront « tout le monde » plutôt qu'une personne précise, sans que la génération échoue. Il n'y a pas de nombre imposé : un seul portrait suffit pour commencer.";
  } else if (incomplete > 0) {
    consequence = `${incomplete} ICP sans segment ni douleurs. Ce${
      incomplete > 1 ? "s portraits ne seront" : " portrait ne sera"
    } pas mobilisé${incomplete > 1 ? "s" : ""} à la génération, sans que celle-ci échoue.`;
  }

  return (
    <section className="strategy-section" aria-label="Clients idéaux">
      <SectionHead
        title="ICP"
        hint={<InfoHint term="icp" />}
        lead="Ces portraits permettent d'écrire pour des problèmes et un langage réels, pas pour « tout le monde »."
        action={
          <Button variant="secondary" onClick={onAdd}>
            Ajouter un ICP
          </Button>
        }
      />

      <CompletenessIndicator
        filled={complete}
        total={icps.length}
        emptyLabel="Aucun ICP"
        consequence={consequence}
      />

      {icps.length === 0 ? (
        <div className="strategy-surface strategy-empty">
          <EmptyState
            title="Aucun client idéal défini"
            description="Décrivez au moins un client idéal : son métier, ses douleurs et ses mots à lui. Vos posts parleront à de vraies personnes plutôt qu'à tout le monde."
            action={{ label: "Ajouter un ICP", onClick: onAdd }}
          />
        </div>
      ) : null}

      {icps.map((icp, index) => (
        <section
          key={`icp-${index}`}
          className="strategy-surface strategy-item"
          aria-label={`ICP ${index + 1}`}
        >
          <div className="strategy-item__head">
            <span className="strategy-item__title">ICP {index + 1}</span>
            <Button variant="danger" size="sm" onClick={() => onRemove(index)}>
              Retirer
            </Button>
          </div>

          <StrategyField
            field="icp-segment"
            controlId={`icp-segment-${index}`}
            label="Segment"
            help="Le type de client visé : métier, taille d'entreprise, contexte."
          >
            <input
              value={icp.segment}
              onChange={(event) => onUpdate(index, "segment", event.target.value)}
              placeholder="Ex. Dirigeant de PME de 20 à 200 personnes"
            />
          </StrategyField>

          <StrategyField
            field="icp-pains"
            controlId={`icp-pains-${index}`}
            label="Douleurs principales"
            help="Ce qui empêche ce client de dormir, dans ses propres termes."
            align="start"
          >
            <textarea
              value={icp.pains}
              onChange={(event) => onUpdate(index, "pains", event.target.value)}
              placeholder="Ex. Trop de bruit, peu de ROI, équipe pas alignée."
            />
          </StrategyField>

          <StrategyField
            field="icp-objections"
            controlId={`icp-objections-${index}`}
            label="Objections"
            help="Les freins qui le retiennent avant de vous faire confiance."
            align="start"
          >
            <textarea
              value={icp.objections ?? ""}
              onChange={(event) => onUpdate(index, "objections", event.target.value)}
              placeholder="Ex. J'ai peur d'un gadget de plus ou d'un projet sans adoption."
            />
          </StrategyField>

          <StrategyField
            field="icp-outcomes"
            controlId={`icp-outcomes-${index}`}
            label="Résultats attendus"
            help="Le succès concret qu'il espère obtenir."
            align="start"
          >
            <textarea
              value={icp.desiredOutcomes ?? ""}
              onChange={(event) => onUpdate(index, "desiredOutcomes", event.target.value)}
              placeholder="Ex. Un premier cas d'usage rentable et défendable en interne."
            />
          </StrategyField>

          <StrategyField
            field="icp-language"
            controlId={`icp-language-${index}`}
            label="Indices de langage"
            help="Les mots qu'il emploie, à reprendre pour qu'il se reconnaisse."
            align="start"
          >
            <textarea
              value={icp.languageCues ?? ""}
              onChange={(event) => onUpdate(index, "languageCues", event.target.value)}
              placeholder="Ex. Concret, rentable, équipe, process, risque."
            />
          </StrategyField>

          <StrategyField
            field="icp-behavior"
            controlId={`icp-behavior-${index}`}
            label="Comportement LinkedIn"
            help="Comment il se comporte sur LinkedIn : lit, commente, partage."
            align="start"
          >
            <textarea
              value={icp.linkedinBehavior ?? ""}
              onChange={(event) => onUpdate(index, "linkedinBehavior", event.target.value)}
              placeholder="Ex. Lit des retours terrain, commente peu, partage les cas réels."
            />
          </StrategyField>
        </section>
      ))}
    </section>
  );
}
