import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HashRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation
} from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { LibraryScreen } from "../features/library/LibraryScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { StrategyScreen } from "../features/strategy/StrategyScreen";
import { CreateScreen } from "../features/create/CreateScreen";
import { CockpitScreen } from "../features/cockpit/CockpitScreen";
import { applyTheme } from "./theme";
import { ToastProvider } from "../feedback/ToastProvider";
import {
  GUIDED_TOUR_SEEN_KEY,
  GuidedTour,
  shouldShowTour,
  TourContext,
  type TourApi
} from "../help";
import { pageTransition, useMotionVariants } from "../design-system/motion/variants";
import type { ThemePreference } from "../../../shared/types/settings";

const sections = [
  { path: "/", label: "Cockpit" },
  { path: "/strategie", label: "Stratégie" },
  { path: "/creer", label: "Créer" },
  { path: "/bibliotheque", label: "Bibliothèque" },
  { path: "/parametres", label: "Paramètres" }
];

/**
 * Routes animees (T042). La transition de page (`pageTransition`) est jouee
 * via `AnimatePresence` autour des `<Routes>`. On clef sur le SEUL pathname
 * (pas la `key` complete) pour que les deep-links a query-params, ex.
 * `?view=planning`, ne remontent pas inutilement la meme page. Les variants
 * sont reduced-motion-aware via `useMotionVariants`. Les redirections legacy
 * restent intactes.
 */
function AnimatedRoutes() {
  const location = useLocation();
  const variants = useMotionVariants(pageTransition);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="route-transition ds-allow-opacity-motion"
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Routes location={location}>
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
      </motion.div>
    </AnimatePresence>
  );
}

function AppShell() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  useEffect(() => {
    window.linkedinPoster.settings
      .getPreference("theme")
      .then((result) => {
        const pref = (result.value ?? "system") as ThemePreference;
        applyTheme(pref);
      })
      .catch(() => applyTheme("system"));
  }, []);

  // Declenchement automatique au premier lancement : espace vierge ET flag
  // `guided-tour-seen` absent. Decision via `shouldShowTour` (pur, teste).
  //
  // Le flag est le signal GATE : si sa lecture echoue, on s'abstient. En
  // revanche, sur un espace fraichement initialise, `getActiveBundle()` LEVE
  // « No active strategy profile found » : c'est precisement le signe d'une
  // strategie vide, pas d'un espace illisible. On traite donc l'echec de la
  // strategie comme « vide » plutot que comme un abandon (cf. data-model :
  // workspace vierge = aucune strategie/idee).
  useEffect(() => {
    let mounted = true;

    async function evaluateAutoTour() {
      let seen: boolean;
      try {
        const seenResult = await window.linkedinPoster.settings.getPreference(
          GUIDED_TOUR_SEEN_KEY
        );
        seen = seenResult.value != null;
      } catch {
        // Flag illisible : on s'abstient (signal gate indisponible).
        return;
      }

      const strategyEmpty = await window.linkedinPoster.strategy
        .getActiveBundle()
        .then(
          (bundle) =>
            bundle.offers.length === 0 &&
            bundle.icps.length === 0 &&
            bundle.pillars.length === 0 &&
            bundle.voiceRules.length === 0
        )
        // Absence de profil de strategie (espace neuf) => considere comme vide.
        .catch(() => true);

      const ideasEmpty = await window.linkedinPoster.ideas
        .listIdeas()
        .then((ideas) => ideas.length === 0)
        .catch(() => true);

      const isEmpty = strategyEmpty && ideasEmpty;
      if (mounted && shouldShowTour({ seen, isEmpty })) {
        setIsTourOpen(true);
      }
    }

    void evaluateAutoTour();
    return () => {
      mounted = false;
    };
  }, []);

  const closeTour = useCallback(() => {
    setIsTourOpen(false);
    // On marque la visite comme vue : plus de declenchement automatique.
    void window.linkedinPoster.settings
      .setPreference(GUIDED_TOUR_SEEN_KEY, "true")
      .catch(() => {
        /* Le flag sera retente au prochain passage ; sans incidence visible. */
      });
  }, []);

  const tourApi = useMemo<TourApi>(
    () => ({ open: () => setIsTourOpen(true) }),
    []
  );

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
    <TourContext.Provider value={tourApi}>
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
        <div className="brand">
          <h2 className="brand-wordmark">
            Ghostwr<span className="brand-accent">AI</span>ter
          </h2>
          <span className="brand-version">v{window.linkedinPoster.appVersion}</span>
        </div>

        <nav className="nav-panel" aria-label="Navigation principale">
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
              <span className="nav-link-label">{section.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content">
        <AnimatedRoutes />
      </main>

      {/* La cle remonte la visite a chaque ouverture, garantissant un demarrage
          a la premiere etape sans setState dans un effet. */}
      <GuidedTour key={isTourOpen ? "tour-open" : "tour-closed"} open={isTourOpen} onClose={closeTour} />
    </div>
    </TourContext.Provider>
  );
}

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </HashRouter>
  );
}
