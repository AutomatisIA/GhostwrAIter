import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { CalendarScreen } from "../features/calendar/CalendarScreen";
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
    eyebrow: "Pilotage",
    title: "Cockpit editorial local-first",
    description:
      "Vue centrale du systeme de production LinkedIn. Le socle est pret pour brancher strategie, atelier, bibliotheque et calendrier."
  },
  {
    path: "/strategie",
    label: "Strategie",
    eyebrow: "Socle",
    title: "Positionnement, offre, ICP, voix",
    description:
      "Source de verite editoriale. Cette section accueillera le profil actif, les piliers, les regles anti-style et les preuves business."
  },
  {
    path: "/idees",
    label: "Idees",
    eyebrow: "Backlog",
    title: "Generer, scorer, prioriser",
    description:
      "Le backlog d'angles et d'observations terrain. Il servira de point d'entree au workflow guide de production."
  },
  {
    path: "/atelier",
    label: "Atelier",
    eyebrow: "Production",
    title: "Sujet -> typologie -> structure -> hook -> draft",
    description:
      "L'atelier pilotera les skills et exposera le contexte, les traces d'execution et les corrections recommandées."
  },
  {
    path: "/bibliotheque",
    label: "Bibliotheque",
    eyebrow: "Capitalisation",
    title: "Retrouver et reutiliser",
    description:
      "Les contenus, hooks, variantes et brouillons seront consultables et filtrables localement."
  },
  {
    path: "/runner",
    label: "Runner",
    eyebrow: "Diagnostic",
    title: "Executions et logs",
    description:
      "Suivre l'etat du runner local, des skills et des diagnostics d'execution."
  },
  {
    path: "/parametres",
    label: "Parametres",
    eyebrow: "Maintenance",
    title: "Export et confidentialite",
    description:
      "Exporter le workspace, purger les logs et maintenir le cockpit local."
  },
  {
    path: "/calendrier",
    label: "Calendrier",
    eyebrow: "Planification",
    title: "Vue simple des contenus prevus",
    description:
      "Le calendrier V1 restera mono-canal LinkedIn, sans synchronisation externe."
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
          <p>Shell desktop Electron pret pour l'implementation metier.</p>
        </article>
        <article className="status-card">
          <span className="status-label">Systeme</span>
          <strong>{window.linkedinPoster.platform}</strong>
          <p>Le MVP cible macOS en priorite, avec extension possible plus tard.</p>
        </article>
        <article className="status-card">
          <span className="status-label">Etat</span>
          <strong>Setup en place</strong>
          <p>Les prochaines etapes vont brancher SQLite, workspace et runner.</p>
        </article>
      </div>
    </section>
  );
}

function renderSection(path: string, eyebrow: string, title: string, description: string) {
  if (path === "/strategie") {
    return <StrategyScreen />;
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

export function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand panel">
            <div className="eyebrow">LinkedIn Poster</div>
            <h2>Machine editoriale</h2>
            <p>
              Un cockpit local pour produire des posts credibles, structures et
              reutilisables.
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
    </BrowserRouter>
  );
}
