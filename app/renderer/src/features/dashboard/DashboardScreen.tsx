import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type DashboardState = {
  strategyReady: boolean;
  ideasCount: number;
  draftsCount: number;
  plannedCount: number;
  runnerMode: "unavailable" | "codex";
};

const initialState: DashboardState = {
  strategyReady: false,
  ideasCount: 0,
  draftsCount: 0,
  plannedCount: 0,
  runnerMode: "unavailable"
};

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count > 1 ? plural : singular}`;
}

export function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<DashboardState>(initialState);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      window.linkedinPoster.strategy.getActiveBundle().then((bundle) => ({
        ready:
          bundle.offers.length > 0 ||
          bundle.icps.length > 0 ||
          bundle.pillars.length > 0 ||
          bundle.voiceRules.length > 0
      })).catch(() => ({ ready: false })),
      window.linkedinPoster.ideas.listIdeas(),
      window.linkedinPoster.library.listEntries(),
      window.linkedinPoster.calendar.listItems(),
      window.linkedinPoster.execution.getDiagnostics()
    ])
      .then(([strategy, ideas, drafts, calendarItems, diagnostics]) => {
        if (!mounted) {
          return;
        }

        setState({
          strategyReady: strategy.ready,
          ideasCount: ideas.length,
          draftsCount: drafts.length,
          plannedCount: calendarItems.length,
          runnerMode: diagnostics.runnerMode
        });
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const isFirstRun =
    !loading && !state.strategyReady && state.ideasCount === 0 && state.draftsCount === 0;

  return (
    <section className="page-panel dashboard-page">
      <div className="hero-card panel">
        <div className="eyebrow">Commencer</div>
        <h1>Commencer sans se perdre</h1>
        <p>
          LinkedIn Poster te guide du socle editorial jusqu'au calendrier. Si tu
          arrives pour la premiere fois, remplis d'abord la strategie, ajoute une
          idee simple, puis passe dans l'atelier.
        </p>
        <div className="hero-actions">
          <div className="hero-chip">1. Strategie</div>
          <div className="hero-chip">2. Idees</div>
          <div className="hero-chip">3. Atelier</div>
          <div className="hero-chip">4. Bibliotheque</div>
        </div>
      </div>

      {isFirstRun ? (
        <article className="panel first-run-card">
          <div className="eyebrow">Premier demarrage</div>
          <strong>Rien n'est encore configure — on commence par le socle.</strong>
          <p>
            Remplis ta strategie (positionnement, offres, piliers, voix) et
            l'application saura guider les generations. Sans ce socle, tous les
            ecrans suivants restent en mode degrade.
          </p>
          <Link to="/strategie" className="primary-button first-run-cta">
            Commencer ici : Strategie
          </Link>
        </article>
      ) : null}

      <div className="dashboard-grid">
        {loading ? (
          <>
            <article className="panel metric-card skeleton-card" aria-busy="true" />
            <article className="panel metric-card skeleton-card" aria-busy="true" />
            <article className="panel metric-card skeleton-card" aria-busy="true" />
            <article className="panel metric-card skeleton-card" aria-busy="true" />
          </>
        ) : (
          <>
            <Link to="/strategie" className="panel metric-card metric-card-link">
              <span className="status-label">Strategie</span>
              <strong>{state.strategyReady ? "Strategie: OK" : "Strategie incomplete"}</strong>
              <p>Le socle editorial doit etre suffisamment rempli pour guider les generations.</p>
            </Link>
            <Link to="/idees" className="panel metric-card metric-card-link">
              <span className="status-label">Backlog</span>
              <strong>{formatCount(state.ideasCount, "idee", "idees")}</strong>
              <p>Les idees sont le point d'entree le plus rapide pour lancer un premier test realiste.</p>
            </Link>
            <Link to="/bibliotheque" className="panel metric-card metric-card-link">
              <span className="status-label">Bibliotheque</span>
              <strong>{formatCount(state.draftsCount, "draft", "drafts")}</strong>
              <p>La bibliotheque montre ce qui est deja reutilisable sans repartir d'une page blanche.</p>
            </Link>
            <Link to="/calendrier" className="panel metric-card metric-card-link">
              <span className="status-label">Calendrier</span>
              <strong>{formatCount(state.plannedCount, "contenu planifie", "contenus planifies")}</strong>
              <p>Un draft planifie est un draft qui a plus de chances d'etre publie.</p>
            </Link>
          </>
        )}
      </div>

      <div className="dashboard-grid dashboard-grid-secondary">
        <article className="panel checklist-card">
          <span className="status-label">Prochaines Actions</span>
          <strong>Parcours recommande</strong>
          <ul className="flat-checklist">
            <li>Completer au moins une offre, un pilier et une regle de voix.</li>
            <li>Ajouter une idee concrete depuis le terrain ou la veille.</li>
            <li>Generer un premier draft dans l'atelier.</li>
          </ul>
        </article>

        <article className="panel checklist-card">
          <span className="status-label">Premier Run</span>
          <strong>Si c'est ta premiere ouverture</strong>
          <ul className="flat-checklist">
            <li>Va d'abord dans Strategie.</li>
            <li>Remplis au moins le positionnement, une offre et deux piliers.</li>
            <li>Ensuite seulement, passe dans Idees pour saisir un premier sujet terrain.</li>
            <li>Quand tu bloques, prefere une phrase concrete plutot qu'un texte parfait.</li>
          </ul>
        </article>

        <article className="panel checklist-card">
          <span className="status-label">Runner</span>
          <strong>{loading ? "Chargement..." : `Mode ${state.runnerMode}`}</strong>
          <p>
            Si le mode est `codex`, l'application execute les generations via Codex.
            Sinon, elle bloque la production et remonte une erreur au lieu de degrader la sortie.
          </p>
        </article>
      </div>
    </section>
  );
}
