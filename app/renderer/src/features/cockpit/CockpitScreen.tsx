import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import type { IdeaRecord } from "@shared/types/ideas";
import type { LibraryEntry } from "@shared/types/library";
import { Button, Card, EmptyState, Skeleton } from "../../design-system/primitives";
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
};

const initialState: CockpitState = {
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
  to: string | null;
} {
  if (!state.strategyReady) {
    return {
      label: "Définir votre stratégie éditoriale",
      explanation:
        "La stratégie est la fondation de tout votre contenu. Sans elle, l'IA ne peut pas générer de posts pertinents.",
      to: "/strategie"
    };
  }
  if (state.ideasCount === 0) {
    return {
      label: "Créer votre première idée",
      explanation:
        "L'atelier de création transforme vos idées en drafts LinkedIn. Commencez par capturer un sujet.",
      to: "/creer"
    };
  }
  if (state.draftsCount === 0) {
    return {
      label: "Rédiger votre premier post",
      explanation:
        "Vous avez des idées en stock. Passez à l'étape rédaction pour générer un draft complet.",
      to: "/creer"
    };
  }
  if (state.plannedCount === 0) {
    return {
      label: "Planifier vos drafts",
      explanation:
        "Vos drafts sont prêts. Placez-les dans le calendrier pour organiser votre publication.",
      to: "/bibliotheque"
    };
  }
  return {
    label: "Tout est en place",
    explanation: "Votre pipeline de contenu est opérationnel.",
    to: null
  };
}

type Metric = {
  to: string;
  icon: string;
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
        .then((bundle) => ({
          ready:
            bundle.offers.length > 0 ||
            bundle.icps.length > 0 ||
            bundle.pillars.length > 0 ||
            bundle.voiceRules.length > 0
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

        setState({
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
      transition: { duration: 0.4, ease: [0.2, 0, 0, 1] }
    }
  });

  const metrics: Metric[] = [
    {
      to: "/strategie",
      icon: state.strategyReady ? "✅" : "⚠️",
      label: "Stratégie",
      value: state.strategyReady ? "Prête" : "À définir",
      caption: state.strategyReady
        ? "Positionnement, piliers et voix configurés"
        : "Configurez offres, ICPs et piliers"
    },
    {
      to: "/creer",
      icon: "💡",
      label: "Idées",
      value: String(state.ideasCount),
      caption:
        state.ideasCount > 0
          ? `${state.ideasCount > 1 ? "idées" : "idée"} dans le backlog`
          : "Aucune idée encore"
    },
    {
      to: "/bibliotheque",
      icon: "📝",
      label: "Drafts",
      value: String(state.draftsCount),
      caption:
        state.draftsCount > 0
          ? `${state.draftsCount > 1 ? "drafts" : "draft"} en bibliothèque`
          : "Aucun draft rédigé"
    },
    {
      to: "/bibliotheque?view=planning",
      icon: "📅",
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
        {metrics.map((metric) => (
          <motion.div key={metric.to} variants={item}>
            <Card
              as={Link}
              to={metric.to}
              interactive
              elevation={2}
              className="metric-card"
            >
              <span className="status-label">
                {metric.icon} {metric.label}
              </span>
              <strong className="metric-card-value">{metric.value}</strong>
              <span className="metric-card-caption">{metric.caption}</span>
            </Card>
          </motion.div>
        ))}
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

      {/* Next Action Card : surface mise en avant (gradient d'accent + glow) */}
      {!isFirstRun ? (
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
              {nextAction.label}
            </Button>
          ) : null}
        </Card>
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
                      Qualité : {Math.round(draft.qualityScore * 100)}%
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
