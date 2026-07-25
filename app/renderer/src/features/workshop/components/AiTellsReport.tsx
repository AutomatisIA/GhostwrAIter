import { TELL_FAMILIES, type TellFamilyId, type TellHit } from "../../../../../shared/ai-tells";

type AiTellsReportProps = {
  hits: TellHit[];
};

const labelOf = (id: TellFamilyId): string =>
  TELL_FAMILIES.find((family) => family.id === id)?.label ?? id;

/**
 * Résultat de détection affiché sur le brouillon généré. Regroupe les
 * occurrences par famille et montre l'extrait exact (`hit.excerpt`) : c'est ce
 * qui rend le constat vérifiable, pas un score global (`density` reste une
 * mesure interne, sans intérêt pour l'utilisateur, cf. app/shared/ai-tells.ts).
 *
 * La mise en garde en pied est volontairement toujours affichée, y compris
 * quand aucun marqueur n'est trouvé : l'absence de marqueur détecté ne
 * certifie jamais que le texte est propre, la détection sous-compte.
 */
export function AiTellsReport({ hits }: AiTellsReportProps) {
  const grouped = new Map<TellFamilyId, string[]>();
  for (const hit of hits) {
    const excerpts = grouped.get(hit.family) ?? [];
    excerpts.push(hit.excerpt);
    grouped.set(hit.family, excerpts);
  }

  return (
    <div className="ai-tells-report">
      <div className="status-label">Marqueurs d'écriture IA</div>

      {hits.length === 0 ? (
        <p className="ai-tells-report-empty">Aucun marqueur repéré dans ce brouillon.</p>
      ) : (
        <>
          <p className="ai-tells-report-count">
            {hits.length} marqueur{hits.length > 1 ? "s" : ""} repéré{hits.length > 1 ? "s" : ""}
          </p>
          <ul className="ai-tells-report-list">
            {[...grouped.entries()].map(([family, excerpts]) => (
              <li key={family} className="ai-tells-report-family">
                <strong>{labelOf(family)}</strong>
                <ul>
                  {excerpts.map((excerpt, index) => (
                    <li key={index} className="ai-tells-report-excerpt">
                      « {excerpt} »
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="ai-tells-caveat">
        Cette détection sous-compte : une formulation non prévue passe inaperçue. Elle montre ce
        qu'elle trouve, elle ne certifie jamais qu'un texte est propre.
      </p>
    </div>
  );
}
