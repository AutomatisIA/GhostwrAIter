// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SettingsScreen } from "../../app/renderer/src/features/settings/SettingsScreen";
import { ToastProvider } from "../../app/renderer/src/feedback/ToastProvider";
import { TourContext } from "../../app/renderer/src/help";

function renderScreen() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TourContext.Provider value={{ open: vi.fn() }}>
          <SettingsScreen />
        </TourContext.Provider>
      </ToastProvider>
    </MemoryRouter>
  );
}

function engine(
  name: string,
  displayName: string,
  installState: string,
  subscriptionLabel: string,
  setupHint?: string
) {
  return {
    name,
    displayName,
    binaryPath: installState === "not-installed" ? null : `/usr/local/bin/${name}`,
    installState,
    version: null,
    subscriptionLabel,
    installCommand: "",
    loginCommand: "",
    setupHint
  };
}

function mockLinkedinPoster(overrides: {
  exportWorkspace: ReturnType<typeof vi.fn>;
  countExecutionLogs: ReturnType<typeof vi.fn>;
  purgeExecutionLogs: ReturnType<typeof vi.fn>;
  engines?: unknown[];
}) {
  window.linkedinPoster = {
    platform: "darwin",
    appName: "GhostwrAIter",
    strategy: { getActiveBundle: vi.fn(), saveBundle: vi.fn() },
    ideas: { listIdeas: vi.fn(), createIdea: vi.fn() },
    workshop: {
      generateFromIdea: vi.fn(),
      correctDraft: vi.fn(),
      getSessionByIdeaId: vi.fn()
    },
    library: { listEntries: vi.fn() },
    calendar: { listItems: vi.fn(), scheduleDraft: vi.fn() },
    execution: {
      listRuns: vi.fn().mockResolvedValue([]),
      getDiagnostics: vi.fn().mockResolvedValue({ activeEngine: "codex", engines: [], availableSkills: [], message: "" }),
      openRunLog: vi.fn()
    },
    settings: {
      exportWorkspace: overrides.exportWorkspace,
      countExecutionLogs: overrides.countExecutionLogs,
      purgeExecutionLogs: overrides.purgeExecutionLogs,
      getPreference: vi.fn().mockResolvedValue({ key: "theme", value: null }),
      setPreference: vi.fn().mockResolvedValue({ key: "theme", value: "system", updated_at: "" }),
      getAllPreferences: vi.fn().mockResolvedValue({}),
      detectEngines: vi.fn().mockResolvedValue({ engines: overrides.engines ?? [] }),
      getActiveEngine: vi.fn().mockResolvedValue({ engine: "codex", status: {} }),
      setActiveEngine: vi.fn().mockResolvedValue({ engine: "codex", status: {} })
    }
  };
}

describe("SettingsScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("exports the workspace from settings", async () => {
    const user = userEvent.setup();
    const exportWorkspace = vi.fn().mockResolvedValue({
      exportPath: "/tmp/workspace-export-1.json"
    });

    mockLinkedinPoster({
      exportWorkspace,
      countExecutionLogs: vi.fn().mockResolvedValue({ count: 0 }),
      purgeExecutionLogs: vi.fn()
    });

    renderScreen();

    await user.click(screen.getByRole("button", { name: "Exporter l'espace de travail" }));

    await waitFor(() => {
      expect(exportWorkspace).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("/tmp/workspace-export-1.json")).toBeTruthy();
  });

  it("requires inline confirmation before purging logs", async () => {
    const user = userEvent.setup();
    const countExecutionLogs = vi.fn().mockResolvedValue({ count: 7 });
    const purgeExecutionLogs = vi.fn().mockResolvedValue({ deletedCount: 7 });

    mockLinkedinPoster({
      exportWorkspace: vi.fn().mockResolvedValue({ exportPath: "" }),
      countExecutionLogs,
      purgeExecutionLogs
    });

    renderScreen();

    await user.click(screen.getByRole("button", { name: "Purger les journaux" }));

    await waitFor(() => {
      expect(countExecutionLogs).toHaveBeenCalledTimes(1);
    });

    // La purge ne doit jamais partir sans confirmation explicite.
    expect(purgeExecutionLogs).not.toHaveBeenCalled();

    // Un dialogue de confirmation s'ouvre et indique le nombre de logs concernes.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(await screen.findByText(/7 journaux techniques/)).toBeTruthy();

    expect(screen.getByRole("button", { name: "Annuler" })).toBeTruthy();

    const confirmButton = screen.getByRole("button", { name: "Purger définitivement" });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(purgeExecutionLogs).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("7 journaux techniques supprimés de votre ordinateur.")).toBeTruthy();
  });

  it("cancels the purge when clicking Annuler", async () => {
    const user = userEvent.setup();
    const countExecutionLogs = vi.fn().mockResolvedValue({ count: 3 });
    const purgeExecutionLogs = vi.fn();

    mockLinkedinPoster({
      exportWorkspace: vi.fn().mockResolvedValue({ exportPath: "" }),
      countExecutionLogs,
      purgeExecutionLogs
    });

    renderScreen();

    await user.click(screen.getByRole("button", { name: "Purger les journaux" }));

    await waitFor(() => {
      expect(countExecutionLogs).toHaveBeenCalledTimes(1);
    });

    await user.click(await screen.findByRole("button", { name: "Annuler" }));

    expect(purgeExecutionLogs).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Purger les journaux" })).toBeTruthy();
  });

  // Le rouge plein appartient a la confirmation. Sur l ecran, l action reste
  // bordee : c est la plus destructive et la plus rare, elle n a pas a etre la
  // plus visible.
  it("garde la purge en bouton borde, pas en bouton plein rouge", async () => {
    mockLinkedinPoster({
      exportWorkspace: vi.fn().mockResolvedValue({ exportPath: "" }),
      countExecutionLogs: vi.fn().mockResolvedValue({ count: 0 }),
      purgeExecutionLogs: vi.fn()
    });

    renderScreen();

    const purge = screen.getByRole("button", { name: "Purger les journaux" });
    expect(purge.getAttribute("data-variant")).toBe("secondary");
    expect(purge.className).toContain("settings-danger");
  });

  // Trois coches vertes identiques ne repondaient pas a la question de l ecran :
  // lequel travaille. Une seule marque, bleue, sur le moteur actif.
  it("ne marque que le moteur actif et dit les autres etats en texte", async () => {
    mockLinkedinPoster({
      exportWorkspace: vi.fn().mockResolvedValue({ exportPath: "" }),
      countExecutionLogs: vi.fn().mockResolvedValue({ count: 0 }),
      purgeExecutionLogs: vi.fn(),
      engines: [
        engine("codex", "Codex, ChatGPT", "authenticated", "Abonnement ChatGPT Plus ou Team"),
        engine("claude", "Claude Code", "authenticated", "Abonnement Claude Pro ou Team"),
        engine("antigravity", "Antigravity", "installed", "Compte Google")
      ]
    });

    const { container } = renderScreen();

    // Une seule mention « Moteur actif », sur le moteur retenu.
    const actifs = await screen.findAllByText("Moteur actif");
    expect(actifs).toHaveLength(1);
    expect(container.querySelectorAll(".settings-engine--active")).toHaveLength(1);
    expect(
      container.querySelector(".settings-engine--active .settings-engine__name")?.textContent
    ).toBe("Codex, ChatGPT");

    // Plus aucune pastille d etat : les moteurs non retenus enoncent leur etat.
    expect(container.querySelectorAll(".engine-badge")).toHaveLength(0);
    expect(screen.getByText("Connecté · Abonnement Claude Pro ou Team")).toBeTruthy();
    expect(screen.getByText("Installé, non connecté · Compte Google")).toBeTruthy();
  });

  // Le cas que la phrase de section annonce : le moteur retenu n est pas
  // connecte. La ligne teintee doit continuer de porter le repere d installation
  // du moteur, et n inventer aucune commande pour un binaire qui n en a pas.
  it("garde le repere d installation sur la ligne du moteur actif non connecte", async () => {
    mockLinkedinPoster({
      exportWorkspace: vi.fn().mockResolvedValue({ exportPath: "" }),
      countExecutionLogs: vi.fn().mockResolvedValue({ count: 0 }),
      purgeExecutionLogs: vi.fn(),
      engines: [
        engine(
          "codex",
          "Antigravity",
          "installed",
          "Compte Google",
          "Fourni avec la suite Antigravity."
        )
      ]
    });

    const { container } = renderScreen();

    await screen.findByText("Moteur actif");

    const active = container.querySelector(".settings-engine--active");
    expect(active).toBeTruthy();
    expect(active?.querySelector(".settings-engine__hint")?.textContent).toBe(
      "Fourni avec la suite Antigravity."
    );

    // Aucune commande n est fabriquee quand les deux champs sont vides.
    expect(container.querySelectorAll(".engine-command")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Copier/ })).toBeNull();
  });
});
