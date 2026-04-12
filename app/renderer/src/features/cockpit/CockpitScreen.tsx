import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type CockpitState = {
  strategyReady: boolean;
  ideasCount: number;
  draftsCount: number;
  plannedCount: number;
  publishedCount: number;
};

const initialState: CockpitState = {
  strategyReady: false,
  ideasCount: 0,
  draftsCount: 0,
  plannedCount: 0,
  publishedCount: 0
};

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count > 1 ? plural : singular}`;
}

function getNextAction(state: CockpitState): {
  label: string;
  to: string | null;
} {
  if (!state.strategyReady) {
    return {
      label: "Définir votre stratégie éditoriale",
      to: "/strategie"
    };
  }
  if (state.ideasCount === 0) {
    return { label: "Créer votre première idée", to: "/creer" };
  }
  if (state.draftsCount === 0) {
    return { label: "Rédiger votre premier post", to: "/creer" };
  }
  if (state.plannedCount === 0) {
    return { label: "Planifier vos drafts", to: "/bibliotheque" };
  }
  return { label: "Tout est en place", to: null };
}

export function CockpitScreen() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<CockpitState>(initialState);

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

        setState({
          strategyReady: strategy.ready,
          ideasCount: ideas.length,
          draftsCount: drafts.length,
          plannedCount: planned.length,
          publishedCount: published.length
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

  return (
    <section className="panel page-panel dashboard-page">
      <h1>Cockpit</h1>

      {loading ? (
        <div className="dashboard-grid">
          <article
            className="panel metric-card skeleton-card"
            aria-busy="true"
          />
          <article
            className="panel metric-card skeleton-card"
            aria-busy="true"
          />
          <article
            className="panel metric-card skeleton-card"
            aria-busy="true"
          />
          <article
            className="panel metric-card skeleton-card"
            aria-busy="true"
          />
        </div>
      ) : (
        <>
          {/* Pipeline Progress Bar */}
          <div className="completeness-indicator">
            <div className="completeness-bar">
              {segments.map((seg) => (
                <div
                  key={seg.label}
                  className={`completeness-segment${seg.lit ? " lit" : ""}`}
                  title={seg.label}
                />
              ))}
            </div>
            <span
              style={{
                fontSize: "0.82rem",
                color: "var(--color-text-secondary)"
              }}
            >
              {segments.map((seg) => seg.label).join(" / ")}
            </span>
          </div>

          {/* First-run card */}
          {isFirstRun ? (
            <article className="panel first-run-card">
              <strong>
                Bienvenue — trois étapes pour démarrer
              </strong>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  <strong>Stratégie</strong> — positionnement, offres, piliers,
                  voix
                </li>
                <li>
                  <strong>Idées</strong> — capturer vos premiers sujets
                </li>
                <li>
                  <strong>Rédiger</strong> — produire votre premier draft
                </li>
              </ol>
              <Link
                to="/strategie"
                className="primary-button first-run-cta"
              >
                Commencer par la Stratégie
              </Link>
            </article>
          ) : null}

          {/* Next Action Card */}
          {!isFirstRun ? (
            <article
              className="panel"
              style={{
                padding: "18px 22px",
                borderLeft: "3px solid var(--color-accent-sky)"
              }}
            >
              <strong style={{ display: "block", marginBottom: 8 }}>
                Prochaine action
              </strong>
              <span
                style={{
                  display: "block",
                  marginBottom: nextAction.to ? 12 : 0,
                  color: "var(--color-text-secondary)"
                }}
              >
                {nextAction.label}
              </span>
              {nextAction.to ? (
                <Link to={nextAction.to} className="primary-button">
                  {nextAction.label}
                </Link>
              ) : null}
            </article>
          ) : null}

          {/* Metrics Grid */}
          <div className="dashboard-grid">
            <Link
              to="/strategie"
              className="panel metric-card metric-card-link"
            >
              <span className="status-label">Stratégie</span>
              <strong>
                {state.strategyReady ? "Complète" : "À définir"}
              </strong>
            </Link>
            <Link to="/creer" className="panel metric-card metric-card-link">
              <span className="status-label">Idées</span>
              <strong>{formatCount(state.ideasCount, "idée", "idées")}</strong>
            </Link>
            <Link
              to="/bibliotheque"
              className="panel metric-card metric-card-link"
            >
              <span className="status-label">Drafts</span>
              <strong>
                {formatCount(state.draftsCount, "draft", "drafts")}
              </strong>
            </Link>
            <Link
              to="/bibliotheque?view=planning"
              className="panel metric-card metric-card-link"
            >
              <span className="status-label">Planifiés</span>
              <strong>
                {formatCount(state.plannedCount, "planifié", "planifiés")}
              </strong>
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
