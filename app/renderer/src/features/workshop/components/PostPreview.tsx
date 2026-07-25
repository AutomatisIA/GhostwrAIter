import { LINKEDIN_FOLD_CHARS, measurePost } from "../../../../../shared/post-metrics";
import type { WorkshopContextUsed } from "@shared/types/workshop";

type PostPreviewProps = {
  bodyMarkdown: string;
  contextUsed: WorkshopContextUsed;
};

/**
 * Vrai quand le repli tombe entre deux caracteres non blancs, donc au milieu
 * d un mot. Le decoupage se fait sur le meme tableau de points de code que
 * `measurePost` : avec `charAt`, un caractere hors BMP decalerait le verdict
 * d une position.
 */
function foldCutsAWord(text: string): boolean {
  const codePoints = [...(text ?? "")];
  if (codePoints.length <= LINKEDIN_FOLD_CHARS) return false;
  const before = codePoints[LINKEDIN_FOLD_CHARS - 1] ?? "";
  const after = codePoints[LINKEDIN_FOLD_CHARS] ?? "";
  return /\S/u.test(before) && /\S/u.test(after);
}

/**
 * Apercu du post tel qu il paraitra sur le fil.
 *
 * La seule mesure qui compte avant publication est celle-la : ce qui passe
 * au-dessus du repli decide si le reste sera lu. Le trait est pose a
 * `LINKEDIN_FOLD_CHARS`, valeur partagee avec le reste de l application, et le
 * texte au-dela est attenue plutot que masque : on doit pouvoir constater ou la
 * phrase se coupe.
 *
 * Le nom affiche vient du profil de la strategie quand il existe. Quand il n en
 * existe pas, on ecrit « Votre profil » : un nom invente serait un mensonge sur
 * une capture que l utilisateur pourrait prendre pour un rendu reel.
 */
export function PostPreview({ bodyMarkdown, contextUsed }: PostPreviewProps) {
  const metrics = measurePost(bodyMarkdown);
  const after = [...(bodyMarkdown ?? "")].slice(LINKEDIN_FOLD_CHARS).join("");
  const authorName = contextUsed.strategyProfileName?.trim() || "Votre profil";

  return (
    <aside className="post-preview">
      <div className="post-preview__head">
        <span className="eyebrow">Aperçu réel</span>
        <span className="post-preview__fold-note">
          Repli à <span className="tabular">{LINKEDIN_FOLD_CHARS}</span> caractères
        </span>
      </div>

      <div className="post-preview__body">
        <div className="post-preview__author">
          <span className="post-preview__avatar" aria-hidden="true" />
          <span className="post-preview__identity">
            <span className="post-preview__name">{authorName}</span>
            <span className="post-preview__meta">Publication à l&apos;instant</span>
          </span>
        </div>

        <div className="post-preview__text">
          <span>{metrics.visibleBeforeFold}</span>
          {metrics.isFolded ? (
            <>
              <span className="post-preview__fold" aria-hidden="true">
                <span className="post-preview__fold-label">Repli, {LINKEDIN_FOLD_CHARS}</span>
              </span>
              <span className="post-preview__after">{after}</span>
            </>
          ) : null}
        </div>

        {metrics.isFolded ? (
          <p className="post-preview__note">
            Ce qui est au-dessus du trait décide de la lecture. Le reste ne s&apos;affiche
            qu&apos;après un clic sur « voir plus ».
            {/* La coupe au milieu d un mot est l information utile de cet
                apercu : elle se commente, sinon elle se lit comme un defaut de
                rendu. La phrase n apparait que quand la coupe tombe vraiment
                entre deux lettres. */}
            {foldCutsAWord(bodyMarkdown) ? (
              <>
                {" "}
                Ici la coupe tombe au milieu d&apos;un mot : l&apos;accroche gagnerait à
                finir avant <span className="tabular">{LINKEDIN_FOLD_CHARS}</span>{" "}
                caractères.
              </>
            ) : null}
          </p>
        ) : (
          <p className="post-preview__note">
            Le post tient entier au-dessus du repli : il s&apos;affiche sans « voir plus ».
          </p>
        )}

        <dl className="post-preview__context">
          <div className="post-preview__context-row">
            <dt>Pilier</dt>
            <dd>{contextUsed.pillarLabel}</dd>
          </div>
          <div className="post-preview__context-row">
            <dt>Voix</dt>
            <dd>{contextUsed.voiceGuardrail}</dd>
          </div>
          <div className="post-preview__context-row">
            <dt>Compétences</dt>
            <dd>{contextUsed.activeSkills.join(", ")}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
