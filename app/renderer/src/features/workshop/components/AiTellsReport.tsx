import type { TellHit } from "../../../../../shared/ai-tells";

type AiTellsReportProps = {
  hits: TellHit[];
  /** Ouvre la reecriture manuelle. Absent : le bandeau reste informatif. */
  onFix?: () => void;
};

/**
 * Bandeau de synthese des marqueurs d'écriture IA.
 *
 * La version precedente recopiait chaque extrait dans une liste sous le
 * brouillon : l'utilisateur devait ensuite retrouver a l'oeil, dans le texte, ou
 * se trouvait la formule citee. Les extraits sont desormais soulignes a leur
 * place dans le post, et ce bandeau ne porte plus que le compte et l'accès a la
 * correction manuelle.
 *
 * La mise en garde reste affichée dans les deux cas, y compris quand aucun
 * marqueur n'est trouvé : la détection sous-compte, et l'absence de marqueur
 * repéré ne certifie jamais qu'un texte est propre.
 */
export function AiTellsReport({ hits, onFix }: AiTellsReportProps) {
  const count = hits.length;

  if (count === 0) {
    return (
      <p className="tells-empty">
        Aucun marqueur d&apos;écriture IA repéré. La détection sous-compte : elle montre ce
        qu&apos;elle trouve, elle ne certifie jamais qu&apos;un texte est propre.
      </p>
    );
  }

  return (
    <div className="tells-banner" role="note">
      <div className="tells-banner__line">
        <span className="tells-banner__count">
          <span className="tabular">{count}</span> marqueur{count > 1 ? "s" : ""} d&apos;écriture
          IA
        </span>
        <span className="tells-banner__hint">
          soulignés dans le texte{onFix ? ", cliquez pour les réécrire" : ""}
        </span>
        {onFix ? (
          <button type="button" className="tells-banner__action" onClick={onFix}>
            Réécrire à la main
          </button>
        ) : null}
      </div>
      <p className="tells-banner__caveat">
        Cette détection sous-compte : une formulation non prévue passe inaperçue.
      </p>
    </div>
  );
}
