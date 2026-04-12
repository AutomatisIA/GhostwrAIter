import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { IdeaRecord } from "@shared/types/ideas";
import type { LibraryEntry } from "@shared/types/library";

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
      label: "Definir votre strategie editoriale",
      explanation:
        "La strategie est la fondation de tout votre contenu. Sans elle, l'IA ne peut pas generer de posts pertinents.",
      to: "/strategie"
    };
  }
  if (state.ideasCount === 0) {
    return {
      label: "Creer votre premiere idee",
      explanation:
        "L'atelier de creation transforme vos idees en drafts LinkedIn. Commencez par capturer un sujet.",
      to: "/creer"
    };
  }
  if (state.draftsCount === 0) {
    return {
      label: "Rediger votre premier post",
      explanation:
        "Vous avez des idees en stock. Passez a l'etape redaction pour generer un draft complet.",
      to: "/creer"
    };
  }
  if (state.plannedCount === 0) {
    return {
      label: "Planifier vos drafts",
      explanation:
        "Vos drafts sont prets. Placez-les dans le calendrier pour organiser votre publication.",
      to: "/bibliotheque"
    };
  }
  return {
    label: "Tout est en place",
    explanation: "Votre pipeline de contenu est operationnel.",
    to: null
  };
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
    { label: "Strategie", lit: state.strategyReady },
    { label: "Idees", lit: state.ideasCount > 0 },
    { label: "Drafts", lit: state.draftsCount > 0 },
    { label: "Planifies", lit: state.plannedCount > 0 },
    { label: "Publies", lit: state.publishedCount > 0 }
  ];

  if (loading) {
    return (
      <section className="panel page-panel dashboard-page">
        <h1>Cockpit</h1>
        {/* Skeleton: metrics row */}
        <div className="dashboard-grid">
          <article className="panel metric-card skeleton-card" aria-busy="true" />
          <article className="panel metric-card skeleton-card" aria-busy="true" />
          <article className="panel metric-card skeleton-card" aria-busy="true" />
          <article className="panel metric-card skeleton-card" aria-busy="true" />
        </div>
        {/* Skeleton: pipeline + next action */}
        <article
          className="panel skeleton-card"
          aria-busy="true"
          style={{ minHeight: 120 }}
        />
        {/* Skeleton: recent drafts + recent ideas */}
        <div className="dashboard-grid dashboard-grid-secondary">
          <div style={{ display: "grid", gap: 12 }}>
            <article className="list-card skeleton-card" aria-busy="true" style={{ minHeight: 80 }} />
            <article className="list-card skeleton-card" aria-busy="true" style={{ minHeight: 80 }} />
            <article className="list-card skeleton-card" aria-busy="true" style={{ minHeight: 80 }} />
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <article className="list-card skeleton-card" aria-busy="true" style={{ minHeight: 80 }} />
            <article className="list-card skeleton-card" aria-busy="true" style={{ minHeight: 80 }} />
            <article className="list-card skeleton-card" aria-busy="true" style={{ minHeight: 80 }} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel page-panel dashboard-page">
      <h1>Cockpit</h1>

      {/* Metrics Row */}
      <div className="dashboard-grid">
        <Link to="/strategie" className="panel metric-card metric-card-link">
          <span className="status-label">
            {state.strategyReady ? "\u2705 " : "\u26A0\uFE0F "}Strategie
          </span>
          <strong style={{ fontSize: "2rem", lineHeight: 1.1 }}>
            {state.strategyReady ? "Prete" : "A definir"}
          </strong>
          <span style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: 4, display: "block" }}>
            {state.strategyReady
              ? "Positionnement, piliers et voix configures"
              : "Configurez offres, ICPs et piliers"}
          </span>
        </Link>
        <Link to="/creer" className="panel metric-card metric-card-link">
          <span className="status-label">{"\uD83D\uDCA1"} Idees</span>
          <strong style={{ fontSize: "2rem", lineHeight: 1.1 }}>
            {state.ideasCount}
          </strong>
          <span style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: 4, display: "block" }}>
            {state.ideasCount > 0
              ? `${state.ideasCount > 1 ? "idees" : "idee"} dans le backlog`
              : "Aucune idee encore"}
          </span>
        </Link>
        <Link to="/bibliotheque" className="panel metric-card metric-card-link">
          <span className="status-label">{"\uD83D\uDCDD"} Drafts</span>
          <strong style={{ fontSize: "2rem", lineHeight: 1.1 }}>
            {state.draftsCount}
          </strong>
          <span style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: 4, display: "block" }}>
            {state.draftsCount > 0
              ? `${state.draftsCount > 1 ? "drafts" : "draft"} en bibliotheque`
              : "Aucun draft redige"}
          </span>
        </Link>
        <Link to="/bibliotheque?view=planning" className="panel metric-card metric-card-link">
          <span className="status-label">{"\uD83D\uDCC5"} Planifies</span>
          <strong style={{ fontSize: "2rem", lineHeight: 1.1 }}>
            {state.plannedCount}
          </strong>
          <span style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: 4, display: "block" }}>
            {state.plannedCount > 0
              ? `${state.plannedCount > 1 ? "posts planifies" : "post planifie"}`
              : "Rien au calendrier"}
          </span>
        </Link>
      </div>

      {/* Pipeline Progress */}
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
        <div style={{ display: "flex", gap: 0 }}>
          {segments.map((seg) => (
            <span
              key={seg.label}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: "0.78rem",
                color: seg.lit
                  ? "var(--color-text-strong)"
                  : "var(--color-text-secondary)",
                fontWeight: seg.lit ? 600 : 400
              }}
            >
              {seg.label}
            </span>
          ))}
        </div>
      </div>

      {/* First-run card */}
      {isFirstRun ? (
        <article className="panel first-run-card">
          <strong>Bienvenue — trois etapes pour demarrer</strong>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <strong>Strategie</strong> — positionnement, offres, piliers, voix
            </li>
            <li>
              <strong>Idees</strong> — capturer vos premiers sujets
            </li>
            <li>
              <strong>Rediger</strong> — produire votre premier draft
            </li>
          </ol>
          <Link to="/strategie" className="primary-button first-run-cta">
            Commencer par la Strategie
          </Link>
        </article>
      ) : null}

      {/* Next Action Card */}
      {!isFirstRun ? (
        <article
          className="panel"
          style={{
            padding: "22px 26px",
            borderLeft: "4px solid var(--color-accent-sky)"
          }}
        >
          <strong style={{ display: "block", marginBottom: 6, fontSize: "1.1rem" }}>
            Prochaine action
          </strong>
          <span
            style={{
              display: "block",
              fontSize: "1.05rem",
              color: "var(--color-text-secondary)",
              marginBottom: 6
            }}
          >
            {nextAction.label}
          </span>
          <span
            style={{
              display: "block",
              fontSize: "0.88rem",
              color: "var(--color-text-secondary)",
              marginBottom: nextAction.to ? 14 : 0,
              opacity: 0.8
            }}
          >
            {nextAction.explanation}
          </span>
          {nextAction.to ? (
            <Link to={nextAction.to} className="primary-button">
              {nextAction.label}
            </Link>
          ) : null}
        </article>
      ) : null}

      {/* Recent Drafts + Recent Ideas */}
      <div className="dashboard-grid dashboard-grid-secondary">
        {/* Recent Drafts */}
        <div>
          <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>Derniers drafts</h2>
          {state.recentDrafts.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {state.recentDrafts.map((draft) => (
                <Link
                  key={draft.draftId}
                  to="/bibliotheque"
                  className="list-card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span className="status-label">{draft.pillarLabel}</span>
                  <strong style={{ display: "block", fontSize: "0.95rem" }}>
                    {draft.headline}
                  </strong>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 8
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.82rem",
                        color: "var(--color-text-secondary)"
                      }}
                    >
                      Qualité : {Math.round(draft.qualityScore * 100)}%
                    </span>
                    <span className="inline-link">Ouvrir</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <article className="panel" style={{ padding: "18px 20px" }}>
              <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
                Aucun draft — commencez par{" "}
                <Link to="/creer" className="inline-link" style={{ marginTop: 0 }}>
                  creer une idee
                </Link>
              </p>
            </article>
          )}
        </div>

        {/* Recent Ideas */}
        <div>
          <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>Dernieres idees</h2>
          {state.recentIdeas.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {state.recentIdeas.map((idea) => (
                <Link
                  key={idea.id}
                  to="/creer"
                  className="list-card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span className="status-label">{idea.pillarLabel}</span>
                  <strong style={{ display: "block", fontSize: "0.95rem" }}>
                    {idea.title}
                  </strong>
                  <span
                    className="inline-link"
                    style={{ fontSize: "0.85rem" }}
                  >
                    Ouvrir dans l'atelier
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <article className="panel" style={{ padding: "18px 20px" }}>
              <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
                Aucune idee —{" "}
                <Link to="/creer" className="inline-link" style={{ marginTop: 0 }}>
                  creer votre premiere idee
                </Link>
              </p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
