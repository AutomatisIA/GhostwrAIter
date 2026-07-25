import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { LINKEDIN_MAX_CHARS, measurePost } from "../../../../shared/post-metrics";
import type { IdeaRecord } from "@shared/types/ideas";
import type { LibraryEntry } from "@shared/types/library";
import { Button, EmptyState, PageFrame, Skeleton } from "../../design-system/primitives";

import "./cockpit.css";

type CockpitState = {
  strategyReady: boolean;
  ideasCount: number;
  draftsCount: number;
  plannedCount: number;
  publishedCount: number;
  recentIdeas: IdeaRecord[];
  recentDrafts: LibraryEntry[];
  /** Idees jamais transformees en brouillon. */
  ideasWithoutDraft: number;
  /** Brouillons prets mais absents du calendrier. */
  draftsUnscheduled: number;
  /** Posts planifies a aujourd hui ou en retard, non publies. */
  postsDue: number;
  /** Titre du prochain post a publier, pour nommer l action. */
  nextDueHeadline: string | null;
};

const initialState: CockpitState = {
  ideasWithoutDraft: 0,
  draftsUnscheduled: 0,
  postsDue: 0,
  nextDueHeadline: null,
  strategyReady: false,
  ideasCount: 0,
  draftsCount: 0,
  plannedCount: 0,
  publishedCount: 0,
  recentIdeas: [],
  recentDrafts: []
};

/** Les cinq etapes de la reglette, dans l ordre du pipeline. */
type PipelineStepKey =
  | "strategy"
  | "ideas"
  | "drafts"
  | "planned"
  | "published";

type NextAction = {
  label: string;
  explanation: string;
  /** Verbe d action du bouton. Distinct du titre : repeter le titre mot pour
   *  mot dans le bouton n apporte rien et allonge le bloc pour rien. */
  cta: string;
  to: string;
  /** Etape du pipeline que cette action concerne. La reglette la souligne en
   *  ambre : le bloc heros et la reglette racontent ainsi la meme histoire,
   *  et ils ne peuvent pas diverger puisqu ils sortent du meme calcul. */
  attention: PipelineStepKey;
};

function getNextAction(state: CockpitState): NextAction {
  if (!state.strategyReady) {
    return {
      label: "Définir votre stratégie éditoriale",
      explanation:
        "La stratégie est la fondation de tout votre contenu. Sans elle, l'IA ne peut pas générer de posts pertinents.",
      cta: "Ouvrir la stratégie",
      to: "/strategie",
      attention: "strategy"
    };
  }
  if (state.ideasCount === 0) {
    return {
      label: "Créer votre première idée",
      explanation:
        "L'atelier de création transforme vos idées en brouillons LinkedIn. Commencez par capturer un sujet.",
      cta: "Capturer une idée",
      to: "/creer",
      attention: "ideas"
    };
  }
  if (state.draftsCount === 0) {
    return {
      label: "Rédiger votre premier post",
      explanation:
        "Vous avez des idées en stock. Passez à l'étape rédaction pour générer un brouillon complet.",
      cta: "Ouvrir l'atelier",
      to: "/creer",
      attention: "drafts"
    };
  }
  if (state.plannedCount === 0) {
    return {
      label: "Planifier vos brouillons",
      explanation:
        "Vos brouillons sont prêts. Placez-les dans le calendrier pour organiser votre publication.",
      cta: "Ouvrir la bibliothèque",
      to: "/bibliotheque",
      attention: "planned"
    };
  }

  // A partir d'ici l'utilisateur est installe. Le bloc affichait « Tout est en
  // place », c'est-a-dire un appel a l'action qui n'appelait a rien, alors qu'il
  // occupe la position la plus visible de l'ecran. Il calcule desormais ce qui
  // attend reellement, du plus urgent au moins urgent
  // (cf. docs/audit-2026-07-ui-ux.md section 1).

  if (state.postsDue > 0) {
    const plural = state.postsDue > 1;
    return {
      label: plural
        ? `${state.postsDue} posts à publier`
        : `À publier : ${state.nextDueHeadline ?? "votre post planifié"}`,
      explanation: plural
        ? "Leur date de publication est arrivée. Copiez le texte, publiez, puis marquez-les comme publiés."
        : "Sa date de publication est arrivée. Copiez le texte, publiez, puis marquez-le comme publié.",
      cta: "Ouvrir la bibliothèque",
      to: "/bibliotheque",
      attention: "planned"
    };
  }

  if (state.draftsUnscheduled > 0) {
    const plural = state.draftsUnscheduled > 1;
    return {
      label: `${state.draftsUnscheduled} ${plural ? "brouillons non planifiés" : "brouillon non planifié"}`,
      explanation: plural
        ? "Ils sont rédigés mais n'ont pas de date. Un post sans date attend indéfiniment."
        : "Il est rédigé mais n'a pas de date. Un post sans date attend indéfiniment.",
      cta: "Planifier",
      to: "/bibliotheque",
      attention: "drafts"
    };
  }

  if (state.ideasWithoutDraft > 0) {
    const plural = state.ideasWithoutDraft > 1;
    return {
      label: `${state.ideasWithoutDraft} ${plural ? "idées en attente de rédaction" : "idée en attente de rédaction"}`,
      explanation: plural
        ? "Elles sont dans votre backlog et n'ont pas encore de brouillon. Passez la plus mûre à l'atelier."
        : "Elle est dans votre backlog et n'a pas encore de brouillon. Passez-la à l'atelier.",
      cta: "Ouvrir l'atelier",
      to: "/creer",
      attention: "ideas"
    };
  }

  return {
    label: "Capturer un nouveau sujet",
    explanation:
      "Tout ce que vous aviez en stock est rédigé et planifié. Le pipeline se vide : alimentez-le pour ne pas manquer de matière.",
    cta: "Capturer un sujet",
    to: "/creer",
    attention: "ideas"
  };
}

type PipelineStep = {
  key: PipelineStepKey;
  label: string;
  value: string;
  /** Compteur a zero : la valeur passe en encre tertiaire. */
  empty: boolean;
  to: string;
};

function getPipelineSteps(state: CockpitState): PipelineStep[] {
  return [
    {
      key: "strategy",
      label: "Stratégie",
      value: state.strategyReady ? "Prête" : "À définir",
      empty: !state.strategyReady,
      to: "/strategie"
    },
    {
      key: "ideas",
      label: "Idées",
      value: String(state.ideasCount),
      empty: state.ideasCount === 0,
      to: "/creer"
    },
    {
      key: "drafts",
      label: "Brouillons",
      value: String(state.draftsCount),
      empty: state.draftsCount === 0,
      to: "/bibliotheque"
    },
    {
      key: "planned",
      label: "Planifiés",
      value: String(state.plannedCount),
      empty: state.plannedCount === 0,
      to: "/bibliotheque?view=planning"
    },
    {
      key: "published",
      label: "Publiés",
      value: String(state.publishedCount),
      empty: state.publishedCount === 0,
      to: "/bibliotheque?view=planning"
    }
  ];
}

/**
 * Compte de caracteres d un brouillon, rapporte a la limite LinkedIn.
 * « 1 048 sur 3 000 » dit en un coup d oeil ce que « 1 048 caracteres » ne dit
 * pas : la marge restante. Les deux nombres sont mesures, jamais estimes.
 */
function formatCharBudget(bodyMarkdown: string): { text: string; over: boolean } {
  const { chars, overLimit } = measurePost(bodyMarkdown);
  return {
    text: `${chars.toLocaleString("fr-FR")} sur ${LINKEDIN_MAX_CHARS.toLocaleString("fr-FR")}`,
    over: overLimit
  };
}

export function CockpitScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<CockpitState>(initialState);
  const [loadFailed, setLoadFailed] = useState(false);
  /** Incremente par « Reessayer » : relance l effet de chargement. */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      window.linkedinPoster.strategy
        .getActiveBundle()
        // Le badge doit refleter ce que le moteur EXIGE reellement, pas la
        // simple presence de donnees. `buildStrategyContext` leve une erreur
        // sans regle de voix, et une idee sans pilier ne porte aucun contexte
        // editorial. Un OU sur quatre tableaux affichait « Prete » avec un seul
        // pilier au libelle vide, puis l atelier echouait sans explication
        // (cf. docs/audit-2026-07-fonctionnel.md section 6).
        .then((bundle) => ({
          ready: bundle.voiceRules.length > 0 && bundle.pillars.length > 0
        }))
        .catch(() => ({ ready: false })),
      window.linkedinPoster.ideas.listIdeas(),
      window.linkedinPoster.library.listEntries(),
      window.linkedinPoster.calendar.listItems()
    ])
      .then(([strategy, ideas, drafts, calendarItems]) => {
        if (!mounted) return;

        const planned = calendarItems.filter(
          (item: { status?: string }) => item.status !== "published"
        );
        const published = calendarItems.filter(
          (item: { status?: string }) => item.status === "published"
        );

        const sortedIdeas = [...ideas]
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 3);

        const sortedDrafts = [...drafts]
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 3);

        const draftedIdeaIds = new Set(drafts.map((entry) => entry.ideaId));
        const scheduledDraftIds = new Set(calendarItems.map((entry) => entry.draftId));

        // Date du jour au format ISO court, pour comparer a `plannedDate`.
        const today = new Date().toISOString().slice(0, 10);
        const due = calendarItems
          .filter((entry) => entry.status !== "published" && entry.plannedDate <= today)
          .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));

        setState({
          ideasWithoutDraft: ideas.filter((idea) => !draftedIdeaIds.has(idea.id)).length,
          draftsUnscheduled: drafts.filter((entry) => !scheduledDraftIds.has(entry.draftId)).length,
          postsDue: due.length,
          nextDueHeadline: due[0]?.draftHeadline ?? null,
          strategyReady: strategy.ready,
          ideasCount: ideas.length,
          draftsCount: drafts.length,
          plannedCount: planned.length,
          publishedCount: published.length,
          recentIdeas: sortedIdeas,
          recentDrafts: sortedDrafts
        });
      })
      // Sans cette branche, un echec de lecture laissait l ecran sur
      // `initialState` : tous les compteurs a zero et la strategie « a definir »,
      // c est-a-dire l etat exact d un espace vierge. Un utilisateur ayant trente
      // brouillons recevait l ecran d accueil du premier lancement, et la
      // reglette affichait cinq zeros mesures nulle part. On prefere dire qu on
      // ne sait pas.
      .catch(() => {
        if (mounted) setLoadFailed(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [reloadToken]);

  if (loading) {
    return (
      <PageFrame eyebrow="Cockpit">
        <div className="cockpit" aria-busy="true">
          <div className="cockpit-skeleton cockpit-skeleton--hero">
            <Skeleton variant="block" />
          </div>
          <div className="cockpit-skeleton cockpit-skeleton--pipeline">
            <Skeleton variant="block" />
          </div>
          <div className="cockpit-columns">
            <div className="cockpit-skeleton cockpit-skeleton--list">
              <Skeleton variant="block" />
            </div>
            <div className="cockpit-skeleton cockpit-skeleton--list">
              <Skeleton variant="block" />
            </div>
          </div>
        </div>
      </PageFrame>
    );
  }

  if (loadFailed) {
    return (
      <PageFrame eyebrow="Cockpit">
        <div className="cockpit">
          <section className="cockpit-hero cockpit-hero--failed" role="alert">
            <span className="cockpit-hero__eyebrow cockpit-hero__eyebrow--failed">
              Lecture impossible
            </span>
            <h2 className="cockpit-hero__title">
              Votre espace de travail n&apos;a pas répondu
            </h2>
            <p className="cockpit-hero__explanation">
              Les compteurs et les listes ne sont pas affichés : ils seraient
              faux. Réessayez, puis vérifiez l&apos;emplacement de
              l&apos;espace de travail dans les paramètres si l&apos;échec
              persiste.
            </p>
            <div className="cockpit-hero__actions">
              <Button
                variant="primary"
                onClick={() => {
                  // Remise a l etat de chargement depuis le gestionnaire
                  // d evenement, jamais depuis l effet : l effet ne fait que
                  // lire, il ne reinitialise pas ce qui l a declenche.
                  setLoadFailed(false);
                  setLoading(true);
                  setReloadToken((token) => token + 1);
                }}
              >
                Réessayer
              </Button>
            </div>
          </section>
        </div>
      </PageFrame>
    );
  }

  const isFirstRun =
    !state.strategyReady && state.ideasCount === 0 && state.draftsCount === 0;

  const nextAction = getNextAction(state);
  const steps = getPipelineSteps(state);

  return (
    <PageFrame eyebrow="Cockpit">
      <div className="cockpit">
        {/* Bloc heros. Au premier lancement il accueille, ensuite il porte la
            prochaine action reellement calculee. Un seul des deux a la fois :
            les afficher ensemble reviendrait a dire deux fois la meme chose au
            meme endroit. */}
        {isFirstRun ? (
          <section className="cockpit-hero">
            <span className="cockpit-hero__eyebrow">Bienvenue</span>
            <h2 className="cockpit-hero__title">Trois étapes pour démarrer</h2>
            <ol className="cockpit-hero__steps">
              <li>
                <strong>Stratégie</strong> : positionnement, offres, piliers, voix
              </li>
              <li>
                <strong>Idées</strong> : capturer vos premiers sujets
              </li>
              <li>
                <strong>Rédiger</strong> : produire votre premier brouillon
              </li>
            </ol>
            <div className="cockpit-hero__actions">
              <Button variant="primary" onClick={() => navigate("/strategie")}>
                Commencer par la stratégie
              </Button>
            </div>
          </section>
        ) : (
          <section className="cockpit-hero">
            <span className="cockpit-hero__eyebrow">Prochaine action</span>
            <h2 className="cockpit-hero__title">{nextAction.label}</h2>
            <p className="cockpit-hero__explanation">{nextAction.explanation}</p>
            <div className="cockpit-hero__actions">
              <Button variant="primary" onClick={() => navigate(nextAction.to)}>
                {nextAction.cta}
              </Button>
            </div>
          </section>
        )}

        {/* Reglette du pipeline : cinq colonnes egales sur une seule surface.
            L etape qui demande une action porte un lisere ambre, la meme que
            celle nommee par le bloc heros. */}
        <nav className="cockpit-pipeline" aria-label="Pipeline éditorial">
          {steps.map((step) => {
            const attention = step.key === nextAction.attention;
            return (
              <Link
                key={step.key}
                to={step.to}
                className="cockpit-pipeline__step"
                data-attention={attention ? "true" : undefined}
              >
                <span className="cockpit-pipeline__label">{step.label}</span>
                <span
                  className="cockpit-pipeline__value"
                  data-empty={step.empty ? "true" : undefined}
                >
                  {step.value}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="cockpit-columns">
          <section className="cockpit-section">
            <div className="cockpit-section__head">
              <h2 className="cockpit-section__title">Derniers brouillons</h2>
              <Link to="/bibliotheque" className="cockpit-section__all">
                Tout voir
              </Link>
            </div>
            {state.recentDrafts.length > 0 ? (
              <div className="cockpit-list">
                {state.recentDrafts.map((draft) => {
                  const budget = formatCharBudget(draft.bodyMarkdown);
                  return (
                    <Link
                      key={draft.draftId}
                      to="/bibliotheque"
                      className="cockpit-row"
                    >
                      <span className="cockpit-row__title">{draft.headline}</span>
                      <span className="cockpit-row__meta">
                        {draft.pillarLabel ? (
                          <>
                            <span className="cockpit-row__dot" aria-hidden="true" />
                            {draft.pillarLabel}
                            <span className="cockpit-row__sep" aria-hidden="true">
                              ·
                            </span>
                          </>
                        ) : null}
                        <span
                          className="cockpit-row__count"
                          data-over={budget.over ? "true" : undefined}
                          title={
                            budget.over
                              ? "Au-delà de la limite LinkedIn"
                              : undefined
                          }
                        >
                          {budget.text}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="cockpit-list cockpit-list--empty">
                <EmptyState
                  title="Aucun brouillon"
                  description="Vos brouillons apparaîtront ici. Commencez par créer une idée pour lancer la rédaction."
                  action={{
                    label: "Créer une idée",
                    onClick: () => navigate("/creer")
                  }}
                />
              </div>
            )}
          </section>

          <section className="cockpit-section">
            <div className="cockpit-section__head">
              <h2 className="cockpit-section__title">Dernières idées</h2>
              <Link to="/creer" className="cockpit-section__all">
                Tout voir
              </Link>
            </div>
            {state.recentIdeas.length > 0 ? (
              <div className="cockpit-list">
                {state.recentIdeas.map((idea) => (
                  <Link key={idea.id} to="/creer" className="cockpit-row">
                    <span className="cockpit-row__title">{idea.title}</span>
                    {idea.pillarLabel ? (
                      <span className="cockpit-row__meta">
                        <span className="cockpit-row__dot" aria-hidden="true" />
                        {idea.pillarLabel}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="cockpit-list cockpit-list--empty">
                <EmptyState
                  title="Aucune idée"
                  description="Capturez vos premiers sujets pour alimenter votre pipeline de contenu."
                  action={{
                    label: "Créer votre première idée",
                    onClick: () => navigate("/creer")
                  }}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </PageFrame>
  );
}
