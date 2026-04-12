import { useEffect, useState } from "react";
import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { LibraryScreen } from "../features/library/LibraryScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { StrategyScreen } from "../features/strategy/StrategyScreen";
import { CreateScreen } from "../features/create/CreateScreen";
import { CockpitScreen } from "../features/cockpit/CockpitScreen";
import { applyTheme } from "./theme";
import type { ThemePreference } from "../../../shared/types/settings";

const sections = [
  { path: "/", label: "Cockpit" },
  { path: "/strategie", label: "Stratégie" },
  { path: "/creer", label: "Créer" },
  { path: "/bibliotheque", label: "Bibliothèque" },
  { path: "/parametres", label: "Paramètres" }
];

function AppShell() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    window.linkedinPoster.settings
      .getPreference("theme")
      .then((result) => {
        const pref = (result.value ?? "system") as ThemePreference;
        applyTheme(pref);
      })
      .catch(() => applyTheme("system"));
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsDrawerOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

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
          role="presentation"
        />
      ) : null}

      <aside className={`sidebar ${isDrawerOpen ? "drawer-open" : ""}`}>
        <div className="brand panel">
          <h2>LinkedIn Poster</h2>
          <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", fontWeight: 600 }}>v{window.linkedinPoster.appVersion}</span>
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
          <Route path="/" element={<CockpitScreen />} />
          <Route path="/strategie" element={<StrategyScreen />} />
          <Route path="/creer" element={<CreateScreen />} />
          <Route path="/bibliotheque" element={<LibraryScreen />} />
          <Route path="/parametres" element={<SettingsScreen />} />

          {/* Legacy redirects */}
          <Route path="/idees" element={<Navigate to="/creer" replace />} />
          <Route path="/atelier" element={<Navigate to="/creer" replace />} />
          <Route path="/calendrier" element={<Navigate to="/bibliotheque?view=planning" replace />} />
          <Route path="/runner" element={<Navigate to="/parametres?section=diagnostics" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
