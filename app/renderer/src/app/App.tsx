import { useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { CalendarScreen } from "../features/calendar/CalendarScreen";
import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { ExecutionScreen } from "../features/execution/ExecutionScreen";
import { IdeasScreen } from "../features/ideas/IdeasScreen";
import { LibraryScreen } from "../features/library/LibraryScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { StrategyScreen } from "../features/strategy/StrategyScreen";
import { WorkshopScreen } from "../features/workshop/WorkshopScreen";

const sections = [
  {
    path: "/",
    label: "Tableau de bord",
    eyebrow: "Vue d'ensemble",
    title: "Piloter toute la machine editoriale depuis un seul endroit",
    description:
      "Cette page sert a comprendre le produit, voir les sections disponibles et savoir par ou commencer si tu decouvres l'outil."
  },
  {
    path: "/strategie",
    label: "Strategie",
    eyebrow: "Socle",
    title: "Definir le contexte qui guidera toutes les generations",
    description:
      "Ici, tu poses qui tu es, ce que tu vends, pour qui tu ecris et les regles de ton qui doivent rester stables."
  },
  {
    path: "/idees",
    label: "Idees",
    eyebrow: "Backlog",
    title: "Capturer des sujets avant qu'ils ne se perdent",
    description:
      "Cette page sert a transformer une intuition, une observation terrain ou une actualite en point de depart editorial."
  },
  {
    path: "/atelier",
    label: "Atelier",
    eyebrow: "Production",
    title: "Transformer une idee en post structure",
    description:
      "L'atelier decoupe la production en etapes visibles pour que la generation reste controlable et rejouable."
  },
  {
    path: "/bibliotheque",
    label: "Bibliotheque",
    eyebrow: "Capitalisation",
    title: "Retrouver un draft et le reutiliser",
    description:
      "La bibliotheque evite de perdre les bons contenus et permet de creer rapidement des variantes utiles."
  },
  {
    path: "/runner",
    label: "Runner",
    eyebrow: "Diagnostic",
    title: "Comprendre ce que fait le runner",
    description:
      "Cette page sert a verifier si Codex est bien detecte et a relire les executions recentes."
  },
  {
    path: "/parametres",
    label: "Parametres",
    eyebrow: "Maintenance",
    title: "Exporter et nettoyer le workspace local",
    description:
      "Les parametres regroupent les actions utiles pour maintenir l'outil sans manipuler les fichiers a la main."
  },
  {
    path: "/calendrier",
    label: "Calendrier",
    eyebrow: "Planification",
    title: "Donner une date aux drafts a publier",
    description:
      "Le calendrier permet de passer d'un brouillon produit a un contenu prevu dans une cadence simple."
  }
];

function SectionPage({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="panel page-panel">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>

      <div className="status-grid">
        <article className="status-card">
          <span className="status-label">Plateforme</span>
          <strong>{window.linkedinPoster.appName}</strong>
          <p>Application desktop locale pour produire, stocker et planifier des posts LinkedIn.</p>
        </article>
        <article className="status-card">
          <span className="status-label">Systeme</span>
          <strong>{window.linkedinPoster.platform}</strong>
          <p>Le flux prioritaire vise macOS, avec un usage simple depuis une seule machine.</p>
        </article>
        <article className="status-card">
          <span className="status-label">Commencer Ici</span>
          <strong>Strategie puis Idees</strong>
          <p>Si tu decouvres l'outil, commence par remplir la strategie puis ajoute un premier sujet.</p>
        </article>
      </div>
    </section>
  );
}

function renderSection(path: string, eyebrow: string, title: string, description: string) {
  if (path === "/strategie") {
    return <StrategyScreen />;
  }

  if (path === "/") {
    return <DashboardScreen />;
  }

  if (path === "/idees") {
    return <IdeasScreen />;
  }

  if (path === "/atelier") {
    return <WorkshopScreen />;
  }

  if (path === "/bibliotheque") {
    return <LibraryScreen />;
  }

  if (path === "/calendrier") {
    return <CalendarScreen />;
  }

  if (path === "/runner") {
    return <ExecutionScreen />;
  }

  if (path === "/parametres") {
    return <SettingsScreen />;
  }

  return <SectionPage eyebrow={eyebrow} title={title} description={description} />;
}

function AppShell() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  function closeDrawer() {
    setIsDrawerOpen(false);
  }

  return (
    <div className="shell">
      <button
        type="button"
        className="hamburger-button"
        onClick={() => setIsDrawerOpen(true)}
        aria-expanded={isDrawerOpen}
        aria-label="Ouvrir la navigation"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {isDrawerOpen ? (
        <div
          className="drawer-overlay"
          onClick={() => setIsDrawerOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsDrawerOpen(false);
            }
          }}
          role="presentation"
        />
      ) : null}

      <aside className={`sidebar ${isDrawerOpen ? "drawer-open" : ""}`}>
        <div className="brand panel">
          <div className="eyebrow">LinkedIn Poster</div>
          <h2>Machine editoriale</h2>
          <p>
            Un cockpit local pour passer d'une idee brute a un post credibile,
            structuré et reutilisable.
          </p>
        </div>

        <nav className="panel nav-panel" aria-label="Navigation principale">
          {sections.map((section) => (
            <NavLink
              key={section.path}
              to={section.path}
              end={section.path === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={closeDrawer}
            >
              <span>{section.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content">
        <Routes>
          {sections.map((section) => (
            <Route
              key={section.path}
              path={section.path}
              element={renderSection(
                section.path,
                section.eyebrow,
                section.title,
                section.description
              )}
            />
          ))}
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
