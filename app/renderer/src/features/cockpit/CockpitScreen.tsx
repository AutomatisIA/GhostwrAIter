import { useEffect, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatCharCount } from "../../../../shared/post-metrics";
import { motion, useMotionTemplate, useReducedMotion, useSpring } from "motion/react";
import type { IdeaRecord } from "@shared/types/ideas";
import type { LibraryEntry } from "@shared/types/library";
import {
  Button,
  Card,
  EmptyState,
  Skeleton,
  AlertTriangleIcon,
  CalendarIcon,
  CheckCircleIcon,
  LightbulbIcon,
  PencilIcon,
  type IconProps
} from "../../design-system/primitives";
import {
  fadeInUp,
  staggerContainer,
  useMotionVariants
} from "../../design-system/motion/variants";

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

function getNextAction(state: CockpitState): {
  label: string;
  explanation: string;
  /** Verbe d action du bouton. Distinct du titre : repeter le titre mot pour
   *  mot dans le bouton n apporte rien et allonge le bloc pour rien. */
  cta: string;
  to: string | null;
} {
  if (!state.strategyReady) {
    return {
      label: "Définir votre stratégie éditoriale",
      explanation:
        "La stratégie est la fondation de tout votre contenu. Sans elle, l'IA ne peut pas générer de posts pertinents.",
      cta: "Ouvrir la stratégie",
      to: "/strategie"
    };
  }
  if (state.ideasCount === 0) {
    return {
      label: "Créer votre première idée",
      explanation:
        "L'atelier de création transforme vos idées en drafts LinkedIn. Commencez par capturer un sujet.",
      cta: "Capturer une idée",
      to: "/creer"
    };
  }
  if (state.draftsCount === 0) {
    return {
      label: "Rédiger votre premier post",
      explanation:
        "Vous avez des idées en stock. Passez à l'étape rédaction pour générer un draft complet.",
      cta: "Ouvrir l'atelier",
      to: "/creer"
    };
  }
  if (state.plannedCount === 0) {
    return {
      label: "Planifier vos drafts",
      explanation:
        "Vos drafts sont prêts. Placez-les dans le calendrier pour organiser votre publication.",
      cta: "Ouvrir la bibliothèque",
      to: "/bibliotheque"
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
      to: "/bibliotheque"
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
      to: "/bibliotheque"
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
      to: "/creer"
    };
  }

  return {
    label: "Capturer un nouveau sujet",
    explanation:
      "Tout ce que vous aviez en stock est rédigé et planifié. Le pipeline se vide : alimentez-le pour ne pas manquer de matière.",
    cta: "Capturer un sujet",
    to: "/creer"
  };
}

type MetricTone = "success" | "warning" | "neutral";

type Metric = {
  to: string;
  icon: ComponentType<IconProps>;
  tone: MetricTone;
  label: string;
  value: string;
  caption: string;
};

export function CockpitScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<CockpitState>(initialState);

  const prefersReducedMotion = useReducedMotion() ?? false;
  const container = useMotionVariants(staggerContainer);
  const item = useMotionVariants(fadeInUp);

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
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const isFirstRun =
    !loading &&
    !state.strategyReady &&
    state.ideasCount === 0 &&
    state.draftsCount === 0;

  const nextAction = getNextAction(state);

  const segments = [
    { label: "Stratégie", lit: state.strategyReady },
    { label: "Idées", lit: state.ideasCount > 0 },
    { label: "Drafts", lit: state.draftsCount > 0 },
    { label: "Planifiés", lit: state.plannedCount > 0 },
    { label: "Publiés", lit: state.publishedCount > 0 }
  ];
  const litCount = segments.filter((seg) => seg.lit).length;
  const progress = litCount / segments.length;
  const progressVariants = useMotionVariants({
    hidden: { scaleX: 0 },
    visible: {
      scaleX: progress,
      transition: { duration: 0.4, ease: [0.2, 0, 0, 1] as [number, number, number, number] }
    }
  });

  // Parallaxe subtile sur la carte hero « Prochaine action » (feature 010, T044,
  // FR-017). L'inclinaison suit le curseur avec une amplitude faible (±5 deg) et
  // un ressort doux. ENTIEREMENT neutralisee sous prefers-reduced-motion : on
  // n'attache alors aucun handler et la transformation reste a zero (voir
  // `handleNextActionPointerMove`). Reste discret, pas un gadget.
  const NEXT_ACTION_TILT_DEG = 5;
  const tiltSpringConfig = { stiffness: 150, damping: 18, mass: 0.4 };
  const nextActionRotateX = useSpring(0, tiltSpringConfig);
  const nextActionRotateY = useSpring(0, tiltSpringConfig);
  const nextActionTransform = useMotionTemplate`perspective(900px) rotateX(${nextActionRotateX}deg) rotateY(${nextActionRotateY}deg)`;

  function handleNextActionPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (prefersReducedMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratioX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const ratioY = (event.clientY - bounds.top) / bounds.height - 0.5;
    nextActionRotateY.set(ratioX * NEXT_ACTION_TILT_DEG * 2);
    nextActionRotateX.set(-ratioY * NEXT_ACTION_TILT_DEG * 2);
  }

  function handleNextActionPointerLeave() {
    nextActionRotateX.set(0);
    nextActionRotateY.set(0);
  }

  const metrics: Metric[] = [
    {
      to: "/strategie",
      icon: state.strategyReady ? CheckCircleIcon : AlertTriangleIcon,
      tone: state.strategyReady ? "success" : "warning",
      label: "Stratégie",
      value: state.strategyReady ? "Prête" : "À définir",
      caption: state.strategyReady
        ? "Positionnement, piliers et voix configurés"
        : "Configurez offres, ICPs et piliers"
    },
    {
      to: "/creer",
      icon: LightbulbIcon,
      tone: state.ideasCount > 0 ? "success" : "neutral",
      label: "Idées",
      value: String(state.ideasCount),
      caption:
        state.ideasCount > 0
          ? `${state.ideasCount > 1 ? "idées" : "idée"} dans le backlog`
          : "Aucune idée encore"
    },
    {
      to: "/bibliotheque",
      icon: PencilIcon,
      tone: state.draftsCount > 0 ? "success" : "neutral",
      label: "Drafts",
      value: String(state.draftsCount),
      caption:
        state.draftsCount > 0
          ? `${state.draftsCount > 1 ? "drafts" : "draft"} en bibliothèque`
          : "Aucun draft rédigé"
    },
    {
      to: "/bibliotheque?view=planning",
      icon: CalendarIcon,
      tone: state.plannedCount > 0 ? "success" : "neutral",
      label: "Planifiés",
      value: String(state.plannedCount),
      caption:
        state.plannedCount > 0
          ? `${state.plannedCount > 1 ? "posts planifiés" : "post planifié"}`
          : "Rien au calendrier"
    }
  ];

  if (loading) {
    return (
      <section className="panel page-panel dashboard-page">
        <h1>Cockpit</h1>
        <div className="dashboard-grid cockpit-skeleton-metrics">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
        <div className="cockpit-skeleton-pipeline">
          <Skeleton variant="card" />
        </div>
        <div className="dashboard-grid dashboard-grid-secondary cockpit-skeleton-lists">
          <div className="cockpit-list-stack">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
          <div className="cockpit-list-stack">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel page-panel dashboard-page">
      <h1>Cockpit</h1>

      {/* Metrics Row : profondeur via elevation, surfaces neutres, lift au survol */}
      <motion.div
        className="dashboard-grid"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        {metrics.map((metric) => {
          const MetricIcon = metric.icon;
          return (
            <motion.div key={metric.to} variants={item}>
              <Card
                as={Link}
                to={metric.to}
                interactive
                elevation={2}
                className="metric-card"
              >
                <span className="status-label">
                  <MetricIcon className={`metric-icon metric-icon--${metric.tone}`} />
                  {metric.label}
                </span>
                <strong className="metric-card-value">{metric.value}</strong>
                <span className="metric-card-caption">{metric.caption}</span>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Pipeline Progress : barre tokenisee, remplissage anime */}
      <div className="cockpit-pipeline">
        <div className="cockpit-pipeline-track">
          <motion.div
            className="cockpit-pipeline-fill"
            variants={progressVariants}
            initial={prefersReducedMotion ? "visible" : "hidden"}
            animate="visible"
          />
        </div>
        <div className="cockpit-pipeline-labels">
          {segments.map((seg) => (
            <span
              key={seg.label}
              className={`cockpit-pipeline-label${seg.lit ? " lit" : ""}`}
            >
              {seg.label}
            </span>
          ))}
        </div>
      </div>

      {/* First-run card */}
      {isFirstRun ? (
        <Card accent elevation={2} className="first-run-card">
          <strong>Bienvenue : trois étapes pour démarrer</strong>
          <ol className="first-run-steps">
            <li>
              <strong>Stratégie</strong> : positionnement, offres, piliers, voix
            </li>
            <li>
              <strong>Idées</strong> : capturer vos premiers sujets
            </li>
            <li>
              <strong>Rédiger</strong> : produire votre premier draft
            </li>
          </ol>
          <Button variant="primary" onClick={() => navigate("/strategie")}>
            Commencer par la stratégie
          </Button>
        </Card>
      ) : null}

      {/* Next Action Card : surface mise en avant (gradient d'accent + glow),
          parallaxe subtile au survol (T044) neutralisee si reduced-motion. */}
      {!isFirstRun ? (
        <motion.div
          className="next-action-parallax"
          style={prefersReducedMotion ? undefined : { transform: nextActionTransform }}
          onPointerMove={prefersReducedMotion ? undefined : handleNextActionPointerMove}
          onPointerLeave={prefersReducedMotion ? undefined : handleNextActionPointerLeave}
        >
          <Card accent elevation={3} className="next-action-card">
            <span className="next-action-eyebrow">Prochaine action</span>
            <strong className="next-action-title">{nextAction.label}</strong>
            <span className="next-action-explanation">
              {nextAction.explanation}
            </span>
            {nextAction.to ? (
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate(nextAction.to as string)}
              >
                {nextAction.cta}
              </Button>
            ) : null}
          </Card>
        </motion.div>
      ) : null}

      {/* Recent Drafts + Recent Ideas : zones de lecture, fonds neutres */}
      <div className="dashboard-grid dashboard-grid-secondary">
        <div>
          <h2 className="cockpit-list-heading">Derniers drafts</h2>
          {state.recentDrafts.length > 0 ? (
            <div className="cockpit-list-stack">
              {state.recentDrafts.map((draft) => (
                <Link
                  key={draft.draftId}
                  to="/bibliotheque"
                  className="list-card cockpit-list-card"
                >
                  <span className="status-label">{draft.pillarLabel}</span>
                  <strong className="cockpit-list-title">
                    {draft.headline}
                  </strong>
                  <div className="cockpit-list-footer">
                    <span className="cockpit-list-meta">
                      {formatCharCount(draft.bodyMarkdown)}
                    </span>
                    <span className="inline-link">Ouvrir</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Card elevation={1}>
              <EmptyState
                title="Aucun draft"
                description="Vos drafts apparaîtront ici. Commencez par créer une idée pour lancer la rédaction."
                action={{
                  label: "Créer une idée",
                  onClick: () => navigate("/creer")
                }}
              />
            </Card>
          )}
        </div>

        <div>
          <h2 className="cockpit-list-heading">Dernières idées</h2>
          {state.recentIdeas.length > 0 ? (
            <div className="cockpit-list-stack">
              {state.recentIdeas.map((idea) => (
                <Link
                  key={idea.id}
                  to="/creer"
                  className="list-card cockpit-list-card"
                >
                  <span className="status-label">{idea.pillarLabel}</span>
                  <strong className="cockpit-list-title">{idea.title}</strong>
                  <span className="inline-link cockpit-list-link">
                    Ouvrir dans l'atelier
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Card elevation={1}>
              <EmptyState
                title="Aucune idée"
                description="Capturez vos premiers sujets pour alimenter votre pipeline de contenu."
                action={{
                  label: "Créer votre première idée",
                  onClick: () => navigate("/creer")
                }}
              />
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
