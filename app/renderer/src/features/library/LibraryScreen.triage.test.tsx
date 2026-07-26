// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { LibraryEntry } from "@shared/types/library";
import { ToastProvider } from "../../feedback/ToastProvider";
import { LibraryScreen } from "./LibraryScreen";
import { LINKEDIN_FOLD_CHARS } from "../../../../shared/post-metrics";

/**
 * Ecran de triage de la Bibliotheque.
 *
 * Ce que ces tests protegent, dans l ordre d importance :
 *
 * 1. « Jamais relu » s affiche. Trois tentatives ont echoue avant celle-ci,
 *    toutes pour la meme raison : le signal etait cherche dans `drafts`, ou il
 *    n existe pas. Il vit dans `draft_versions` et arrive par `versionCount`.
 * 2. Les comptes de triage sont derives des donnees, jamais ecrits en dur.
 * 3. Les variantes d un meme sujet se rangent ensemble, la plus aboutie ouverte.
 * 4. Le post est LU, avec le trait de repli trace dans le texte.
 *
 * Les requetes passent par les classes plutot que par le texte : un titre de
 * brouillon paraît DEUX fois a l ecran, une fois dans sa ligne de triage et une
 * fois en tete du volet de lecture. C est le principe meme de l ecran, et une
 * recherche globale par texte y trouve legitimement deux resultats.
 */

const DAY = 86_400_000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString();
}

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    draftId: "draft_1",
    ideaId: "idea_1",
    headline: "Un brouillon a reconnaitre",
    bodyPreview: "Apercu",
    bodyMarkdown: "Corps du brouillon",
    qualityScore: 0.8,
    createdAt: daysAgo(6),
    status: "draft",
    pillarLabel: "Adoption IA",
    tags: [],
    sourceDraftId: null,
    ideaTitle: "Devis et valeur perçue",
    targetIcpSegment: null,
    versionCount: 3,
    lastVersionAt: daysAgo(1),
    triage: "a-relire",
    ...overrides
  };
}

function renderLibrary(entries: LibraryEntry[]) {
  (globalThis as unknown as { window: Window }).window.linkedinPoster = {
    library: {
      listEntries: vi.fn().mockResolvedValue(entries),
      searchEntries: vi.fn().mockResolvedValue(entries),
      createDivergentVariant: vi.fn(),
      updateEntryText: vi.fn(),
      deleteEntry: vi.fn()
    },
    calendar: {
      listItems: vi.fn().mockResolvedValue([]),
      scheduleDraft: vi.fn()
    }
  } as unknown as typeof window.linkedinPoster;

  return render(
    <MemoryRouter>
      <ToastProvider>
        <LibraryScreen />
      </ToastProvider>
    </MemoryRouter>
  );
}

/** Titres des lignes de triage affichees, dans leur ordre d apparition. */
const rowTitles = (container: HTMLElement): (string | null)[] =>
  [...container.querySelectorAll(".library-triage-row__title")].map((node) => node.textContent);

/** Titre du post lu dans le volet de droite. */
const readerTitle = (container: HTMLElement): string | null =>
  container.querySelector(".library-reader__title")?.textContent ?? null;

/**
 * Valeur d une rangee du panneau de metadonnees, lue sur le `textContent` brut :
 * `toLocaleString("fr-FR")` pose une espace insecante etroite comme separateur
 * de milliers, que le normaliseur de testing-library replie du seul cote du DOM.
 */
const metaValue = (container: HTMLElement, label: string): string | undefined =>
  [...container.querySelectorAll(".library-reader__meta-row")]
    .find((row) => row.querySelector("dt")?.textContent === label)
    ?.querySelector("dd")?.textContent ?? undefined;

/** La ligne de triage porteuse de ce titre, comme bouton cliquable. */
const rowByTitle = (title: string): HTMLElement =>
  screen.getByRole("button", { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });

async function loaded(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector(".library-triage")).toBeTruthy();
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Bibliotheque, entrees de triage", () => {
  it("affiche les trois entrees avec leur compte reel et l effectif total", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", triage: "a-relire", versionCount: 1 }),
      entry({ draftId: "b", triage: "a-relire", versionCount: 1 }),
      entry({ draftId: "c", triage: "pret" }),
      entry({ draftId: "d", triage: "planifie" })
    ]);

    await loaded(container);

    expect(screen.getByRole("button", { name: /À relire/ }).textContent).toBe("À relire 2");
    expect(screen.getByRole("button", { name: /Prêts/ }).textContent).toBe("Prêts 1");
    expect(screen.getByRole("button", { name: /Planifiés/ }).textContent).toBe("Planifiés 1");
    expect(screen.getByText("4 au total")).toBeTruthy();
  });

  it("ouvre sur « À relire » et n affiche que les brouillons de cette entree", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Jamais repris", triage: "a-relire", versionCount: 1 }),
      entry({ draftId: "b", headline: "Deja repris", triage: "pret" })
    ]);

    await loaded(container);
    expect(rowTitles(container)).toEqual(["Jamais repris"]);

    await userEvent.click(screen.getByRole("button", { name: /Prêts/ }));

    expect(rowTitles(container)).toEqual(["Deja repris"]);
  });

  it("ouvre sur la premiere entree non vide plutot que sur un ecran vide", async () => {
    // Zero a relire, un seul pret : ouvrir sur « À relire » montrerait un vide
    // alors que la bibliotheque n est pas vide.
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Deja repris", triage: "pret" })
    ]);

    await loaded(container);

    expect(rowTitles(container)).toEqual(["Deja repris"]);
    expect(screen.getByRole("button", { name: /Prêts/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("propose une sortie utile quand l entree choisie est vide", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Deja repris", triage: "pret" })
    ]);

    await loaded(container);
    await userEvent.click(screen.getByRole("button", { name: /Planifiés/ }));

    expect(screen.getByText("Aucune publication planifiée")).toBeTruthy();
    expect(rowTitles(container)).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: /Voir 1/ }));

    expect(rowTitles(container)).toEqual(["Deja repris"]);
  });
});

describe("Bibliotheque, « jamais relu »", () => {
  /*
   * LE test de ce chantier. Trois agents ont refuse d afficher ce marqueur, a
   * juste titre : ils cherchaient une colonne de `drafts` qui n existe pas. Le
   * signal est le nombre d entrees de `draft_versions`, expose par
   * `versionCount`.
   */
  it("affiche le marqueur quand le brouillon n a que sa version de generation", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Genere et jamais repris", versionCount: 1 })
    ]);

    await loaded(container);

    const marqueur = container.querySelector(".library-triage-row .library-row__attention");
    expect(marqueur?.textContent).toBe("jamais relu");
  });

  it("ne l affiche pas quand le brouillon a ete repris", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Repris trois fois", versionCount: 3 })
    ]);

    await loaded(container);

    expect(container.querySelector(".library-triage-row .library-row__attention")).toBeNull();
    expect(screen.queryByText("jamais relu")).toBeNull();
  });

  it("dit la meme chose dans le panneau de metadonnees du post lu", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Genere et jamais repris", versionCount: 1 })
    ]);

    await loaded(container);
    expect(metaValue(container, "Versions")).toBe("1 version, jamais relu");
  });

  /*
   * Le cas que l egalite stricte aurait tu : la requete du processus principal
   * compte les lignes de `draft_versions` avec un `COALESCE(..., 0)`, donc un
   * brouillon sans aucune version rend ZERO. C est le moins relu de tous.
   */
  it("marque aussi le brouillon qui ne compte aucune version", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Aucune version en base", versionCount: 0 })
    ]);

    await loaded(container);

    expect(
      container.querySelector(".library-triage-row .library-row__attention")?.textContent
    ).toBe("jamais relu");
    expect(metaValue(container, "Versions")).toBe("Aucune version, jamais relu");
  });
});

describe("Bibliotheque, cible visee", () => {
  it("dit pour qui le post a ete ecrit", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Un post cible", targetIcpSegment: "Dirigeants de PME" })
    ]);

    await loaded(container);

    expect(metaValue(container, "Cible")).toBe("Dirigeants de PME");
  });

  it("omet la rangee plutot que de la rendre vide sur un brouillon sans cible", async () => {
    // Une rangee « Cible : rien » ferait croire a une donnee perdue la ou il
    // n y en a jamais eu : tous les brouillons anterieurs au champ sont dans
    // ce cas.
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Un post sans cible", targetIcpSegment: null })
    ]);

    await loaded(container);

    expect(metaValue(container, "Cible")).toBeUndefined();
  });
});

describe("Bibliotheque, historique des versions", () => {
  it("affiche l historique, qui existait en base et n apparaissait nulle part", async () => {
    const { container } = renderLibrary([
      entry({
        draftId: "a",
        headline: "Repris trois fois",
        versionCount: 3,
        lastVersionAt: daysAgo(1)
      })
    ]);

    await loaded(container);

    // En meta de ligne : le compte de versions et la date de modification.
    const meta = container.querySelector(".library-triage-row__meta")?.textContent ?? "";
    expect(meta).toContain("3 versions");
    expect(meta).toContain("modifié hier");

    // Et en une ligne dans le panneau du post lu.
    expect(screen.getByText("3 versions, la dernière hier")).toBeTruthy();
  });
});

describe("Bibliotheque, regroupement par sujet", () => {
  const cinqVariantes = () => [
    entry({
      draftId: "v1",
      headline: "Variante la plus aboutie",
      triage: "a-relire",
      versionCount: 4
    }),
    entry({ draftId: "v2", headline: "Variante deux", triage: "a-relire", versionCount: 3 }),
    entry({ draftId: "v3", headline: "Variante trois", triage: "a-relire", versionCount: 2 }),
    entry({ draftId: "v4", headline: "Variante quatre", triage: "a-relire", versionCount: 1 }),
    entry({ draftId: "v5", headline: "Variante cinq", triage: "a-relire", versionCount: 1 }),
    entry({
      draftId: "autre",
      headline: "Un autre sujet",
      ideaTitle: "Agents IA et processus",
      triage: "a-relire"
    })
  ];

  it("range les variantes sous leur sujet et dit combien elles sont", async () => {
    const { container } = renderLibrary(cinqVariantes());

    await loaded(container);

    const titres = [...container.querySelectorAll(".library-group__title")].map(
      (node) => node.textContent
    );
    expect(titres).toEqual(["Devis et valeur perçue", "Agents IA et processus"]);

    // Un sujet unique ne porte aucune mention : il n y a pas de choix a faire.
    const mentions = [...container.querySelectorAll(".library-group__variants")].map(
      (node) => node.textContent
    );
    expect(mentions).toEqual(["5 variantes du même sujet"]);
  });

  it("montre trois variantes puis replie les suivantes", async () => {
    const { container } = renderLibrary(cinqVariantes());

    await loaded(container);
    expect(rowTitles(container)).toEqual([
      "Variante la plus aboutie",
      "Variante deux",
      "Variante trois",
      "Un autre sujet"
    ]);

    const repli = screen.getByRole("button", { name: /Deux variantes de plus, repliées/ });
    expect(repli.getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(repli);

    expect(rowTitles(container)).toEqual([
      "Variante la plus aboutie",
      "Variante deux",
      "Variante trois",
      "Variante quatre",
      "Variante cinq",
      "Un autre sujet"
    ]);
    expect(
      screen
        .getByRole("button", { name: /Deux variantes de plus, affichées/ })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("selectionne la variante la plus aboutie du sujet le plus prolifique", async () => {
    const { container } = renderLibrary(cinqVariantes());

    await loaded(container);

    const selectionnee = container.querySelector('.library-triage-row[aria-current="true"]');
    expect(selectionnee?.textContent).toContain("Variante la plus aboutie");
    expect(readerTitle(container)).toBe("Variante la plus aboutie");
  });

  it("change de post lu au clic sur une autre ligne", async () => {
    const { container } = renderLibrary(cinqVariantes());

    await loaded(container);
    await userEvent.click(rowByTitle("Variante deux"));

    expect(readerTitle(container)).toBe("Variante deux");
  });
});

describe("Bibliotheque, lecture du post", () => {
  const long = "a".repeat(LINKEDIN_FOLD_CHARS) + "b".repeat(120);

  it("trace le repli DANS le texte, a la valeur partagee", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Un post long", bodyMarkdown: long })
    ]);

    await loaded(container);

    expect(container.querySelector(".library-reader__fold-label")?.textContent).toBe(
      `Repli, ${LINKEDIN_FOLD_CHARS}`
    );

    // Ce qui suit le trait n est pas coupe, il est marque : le texte entier
    // reste lisible, attenue.
    expect(container.querySelector(".library-reader__after")?.textContent).toBe("b".repeat(120));
    expect(container.querySelector(".library-reader__text")?.textContent).toBe(
      `${long.slice(0, LINKEDIN_FOLD_CHARS)}Repli, ${LINKEDIN_FOLD_CHARS}${"b".repeat(120)}`
    );
  });

  it("ne trace aucun repli sur un post qui tient au-dessus", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Un post court", bodyMarkdown: "Trois mots." })
    ]);

    await loaded(container);
    expect(container.querySelector(".library-reader__fold")).toBeNull();
  });

  it("mesure la longueur contre la limite LinkedIn", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Un post long", bodyMarkdown: long })
    ]);

    await loaded(container);
    const longueur = (LINKEDIN_FOLD_CHARS + 120).toLocaleString("fr-FR");
    expect(metaValue(container, "Longueur")).toBe(
      `${longueur} sur ${(3000).toLocaleString("fr-FR")}`
    );
  });
});

describe("Bibliotheque, actions du post lu", () => {
  it("porte les actions une seule fois, sur le post affiche", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Premier" }),
      entry({ draftId: "b", headline: "Second", versionCount: 2 })
    ]);

    await loaded(container);

    for (const label of ["Copier le post", "Planifier", "Modifier", "Retravailler"]) {
      expect(screen.getAllByRole("button", { name: label })).toHaveLength(1);
    }
  });

  it("garde « Supprimer » derriere le revelateur, et le referme sur Echap", async () => {
    const user = userEvent.setup();
    const { container } = renderLibrary([entry({ draftId: "a", headline: "Premier" })]);

    await loaded(container);
    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();

    const revelateur = screen.getByRole("button", { name: /Autres actions/ });
    revelateur.focus();
    await user.keyboard("{Enter}");

    const panneau = document.getElementById(revelateur.getAttribute("aria-controls")!);
    expect(panneau).toBeTruthy();
    const supprimer = within(panneau!).getByRole("button", { name: "Supprimer" });

    supprimer.focus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
    expect(revelateur.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(revelateur);
  });

  it("ouvre l edition sur le post selectionne", async () => {
    const { container } = renderLibrary([
      entry({ draftId: "a", headline: "Premier", bodyMarkdown: "Le corps." })
    ]);

    await loaded(container);
    await userEvent.click(screen.getByRole("button", { name: "Modifier" }));

    expect((screen.getByLabelText("Titre du post") as HTMLInputElement).value).toBe("Premier");
    expect((screen.getByLabelText("Corps du post") as HTMLTextAreaElement).value).toBe("Le corps.");
  });
});
