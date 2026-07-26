// @vitest-environment jsdom
/*
 * Ce que les Parametres disent quand la copie d une commande echoue.
 *
 * Le bouton copie la commande de connexion d un moteur (`codex login`, etc.).
 * Sans branche d erreur, un refus du presse-papier ne changeait rien a l ecran :
 * ni « Copié », ni message. L utilisateur va coller dans son terminal ce qui s y
 * trouvait avant, et conclut que la commande affichee ne marche pas.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../feedback/ToastProvider";
import { EnginePanel } from "./EnginePanel";

function poserPressePapier(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true
  });
}

/** Un moteur installe mais non connecte : c est le seul etat qui montre une commande. */
function installApi() {
  (window as unknown as { linkedinPoster: unknown }).linkedinPoster = {
    settings: {
      detectEngines: vi.fn().mockResolvedValue({
        engines: [
          {
            name: "codex",
            displayName: "Codex (ChatGPT)",
            installState: "installed",
            installCommand: "",
            loginCommand: "codex login",
            setupHint: ""
          }
        ]
      }),
      getActiveEngine: vi.fn().mockResolvedValue({ engine: null })
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("Parametres, copie d une commande moteur", () => {
  it("dit que la copie a echoue au lieu de ne rien dire", async () => {
    const user = userEvent.setup();
    installApi();
    poserPressePapier(() => Promise.reject(new Error("NotAllowedError")));

    render(
      <ToastProvider>
        <EnginePanel />
      </ToastProvider>
    );

    await user.click(await screen.findByRole("button", { name: /Copier la commande/ }));

    expect(
      await screen.findByText(/Impossible de copier dans le presse-papier/)
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copié" })).toBeNull();
  });

  it("confirme la copie quand elle reussit", async () => {
    // Garde : le chemin nominal ne doit pas devenir une erreur.
    const user = userEvent.setup();
    installApi();
    const writeText = vi.fn().mockResolvedValue(undefined);
    poserPressePapier(writeText);

    render(
      <ToastProvider>
        <EnginePanel />
      </ToastProvider>
    );

    await user.click(await screen.findByRole("button", { name: /Copier la commande/ }));

    await waitFor(() => expect(screen.getByText("Copié")).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith("codex login");
    expect(screen.queryByText(/Impossible de copier/)).toBeNull();
  });
});
