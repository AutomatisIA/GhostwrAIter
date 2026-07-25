import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { formatCharCount, measurePost } from "../../../../shared/post-metrics";
import { motion } from "motion/react";
import type { LibraryEntry } from "@shared/types/library";
import type { CalendarItem } from "@shared/types/calendar";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  PageFrame,
  Skeleton,
  Tabs,
  useToast
} from "../../design-system/primitives";
import { fadeInUp, useMotionVariants } from "../../design-system/motion/variants";

import "./library.css";
function formatLibraryStatus(status: LibraryEntry["status"]) {
  if (status === "scheduled") {
    return "Planifié";
  }

  if (status === "variant") {
    return "Variante";
  }

  return "Brouillon";
}

function formatCalendarStatus(status: CalendarItem["status"]) {
  if (status === "planned") {
    return "Planifié";
  }

  if (status === "published") {
    return "Publié";
  }

  if (status === "missed") {
    return "Manqué";
  }

  return "Prêt";
}

/**
 * Nombre d etiquettes libres affichees en clair sur une ligne de liste. Au dela,
 * un fragment « +N » porte le reste, detail complet dans son `title`. Une ligne
 * de liste sert a reconnaitre un brouillon, pas a epuiser ses metadonnees.
 */
const MAX_VISIBLE_TAGS = 3;

/**
 * Trois points du revelateur d actions. Le jeu d icones partage
 * (`design-system/primitives/icons`) appartient au chantier commun : ce trace
 * reste confine a l ecran Bibliotheque plutot que d y etre ajoute. Un carre de
 * 30px la ou un libelle ecrit prenait cent trente : c est la colonne de titres
 * qui recupere la place, et c est elle qui sert a reconnaitre un brouillon.
 */
function MoreHorizontalIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

/**
 * Pastille du pilier. Elle ne vaut que collee au nom qu elle annonce : posee en
 * tete de rangee comme fragment autonome, `MetaLine` inserait un point median
 * derriere elle et la ligne s ouvrait sur « · Brouillon », une puce sans
 * referent suivie d un separateur sans rien a separer.
 */
function PillarDot() {
  return <span className="library-row__dot" aria-hidden="true" />;
}

/**
 * Ligne de metadonnees du modele de liste : des fragments separes par des points
 * medians. Le separateur est purement typographique, d ou `aria-hidden` : lu a
 * voix haute il n ajoute rien au fragment qu il suit.
 *
 * La troncature appartient a chaque fragment (voir `library.css`), pas au
 * conteneur : un rognage de conteneur coupe le dernier fragment en plein milieu
 * d un mot, sans marque, ce qui donne un texte faux plutot qu un texte abrege.
 */
function MetaLine({ parts }: { parts: ReactNode[] }) {
  return (
    <span className="library-row__meta">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span className="library-row__sep" aria-hidden="true">
              ·
            </span>
          ) : null}
          {part}
        </Fragment>
      ))}
    </span>
  );
}

/** Trois lignes fantomes dans la meme surface bordee que la liste reelle. */
function LoadingList({ label }: { label: string }) {
  return (
    <div className="library-list" aria-busy="true" aria-label={label}>
      {[0, 1, 2].map((index) => (
        <div className="library-entry" key={index}>
          <div className="library-row">
            <div className="library-row__main">
              <Skeleton variant="text" />
              <Skeleton variant="text" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type TabView = "drafts" | "planning";

export function LibraryScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const listReveal = useMotionVariants(fadeInUp);

  // `activeTab` est DERIVE de l'URL (`?view=planning`), pas un state local
  // (finding revue Codex). La transition de route d'App.tsx est keyee sur le
  // SEUL pathname (pas la query), donc naviguer vers `/bibliotheque?view=planning`
  // alors qu'on est deja sur `/bibliotheque` (lien Cockpit « Planifiés »,
  // redirections legacy) NE remonte PAS le composant. Un `useState` initialise a
  // l'init ne verrait alors jamais le changement de query. En derivant de
  // `searchParams` (qui re-rend a chaque changement d'URL sans remount), l'onglet
  // suit l'URL en continu sans setState dans un effet.
  const activeTab: TabView = searchParams.get("view") === "planning" ? "planning" : "drafts";

  // --- Drafts state ---
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LibraryEntry["status"] | "all">("all");
  const [loading, setLoading] = useState(true);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const [confirmingVariantId, setConfirmingVariantId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editHeadline, setEditHeadline] = useState("");
  const [editBody, setEditBody] = useState("");

  // Ligne dont le panneau d actions secondaires est deploye. Une seule a la
  // fois : ouvrir un panneau referme le precedent.
  const [expandedActionsId, setExpandedActionsId] = useState<string | null>(null);

  // --- Inline scheduling state ---
  const [schedulingDraftId, setSchedulingDraftId] = useState<string | null>(null);
  const [schedulingDate, setSchedulingDate] = useState("");

  // --- Planning state ---
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [calendarStatusFilter, setCalendarStatusFilter] = useState<CalendarItem["status"] | "all">("all");
  const [planningLoading, setPlanningLoading] = useState(false);

  // --- Scheduled dates lookup (draftId -> plannedDate) ---
  const [scheduledDates, setScheduledDates] = useState<Map<string, string>>(new Map());

  function switchTab(tab: TabView) {
    // `activeTab` etant derive de l'URL, il suffit de mettre a jour la query :
    // le changement de `searchParams` re-rend et re-derive l'onglet actif.
    setSearchParams(tab === "drafts" ? {} : { view: "planning" });
  }

  // Load library entries on mount
  useEffect(() => {
    window.linkedinPoster.library
      .listEntries()
      .then((result) => {
        setEntries(result);
      })
      .catch(() => {
        toast.show({ kind: "error", message: "Impossible de charger la bibliothèque." });
      })
      .finally(() => {
        setLoading(false);
      });

    // Also load calendar items to populate scheduled dates badges
    window.linkedinPoster.calendar
      .listItems()
      .then((items) => {
        const dateMap = new Map<string, string>();
        for (const calItem of items) {
          dateMap.set(calItem.draftId, calItem.plannedDate);
        }
        setScheduledDates(dateMap);
      })
      .catch(() => {
        // Non-critique : les dates planifiees ne s'affichent simplement pas.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load planning items when switching to planning tab
  useEffect(() => {
    if (activeTab !== "planning") return;

    setPlanningLoading(true);

    window.linkedinPoster.calendar
      .listItems()
      .then((items) => {
        // Sort chronologically
        const sorted = [...items].sort(
          (a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime()
        );
        setCalendarItems(sorted);
      })
      .catch(() => {
        toast.show({ kind: "error", message: "Impossible de charger le planning." });
      })
      .finally(() => {
        setPlanningLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    try {
      const result = await window.linkedinPoster.library.searchEntries({ query: nextQuery });
      setEntries(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.show({ kind: "error", message: `Erreur de recherche : ${message}` });
    }
  }

  async function handleCreateDivergentVariant(draftId: string) {
    setBusyDraftId(draftId);
    try {
      await window.linkedinPoster.library.createDivergentVariant(draftId);
      const refreshed = await window.linkedinPoster.library.listEntries();
      setEntries(refreshed);
      toast.show({
        kind: "success",
        message: "Variante divergente créée : structure, accroche et angle différents."
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.show({ kind: "error", message: `Erreur variante divergente : ${message}` });
    } finally {
      setBusyDraftId(null);
    }
  }

  /**
   * Replie le panneau d actions d une ligne. La demande de confirmation de
   * variante est retiree au passage : elle vit dans le panneau, et un
   * « Confirmer ? » retrouve tel quel a la reouverture n aurait plus de question
   * a laquelle repondre.
   */
  function closeRowActions() {
    setExpandedActionsId(null);
    setConfirmingVariantId(null);
  }

  /**
   * Replie le panneau depuis un de ses propres boutons, en rendant le focus au
   * revelateur. Sans ce rappel, refermer depuis le panneau demonte l element
   * focalise et renvoie le focus sur `body` : la navigation au clavier repart du
   * haut de la page. Le revelateur est le seul bouton porteur d `aria-expanded`
   * dans la ligne, ce qui suffit a le retrouver sans table de refs.
   */
  function collapseRowActions(origin: HTMLElement | null) {
    const disclosure = origin
      ?.closest(".library-entry")
      ?.querySelector<HTMLButtonElement>("button[aria-expanded]");
    closeRowActions();
    disclosure?.focus();
  }

  /**
   * Echap referme le panneau d actions de la ligne ou se trouve le focus. Le
   * panneau est reellement demonte, jamais rendu transparent : aucune action
   * destructive ne reste cliquable derriere un element invisible.
   */
  function handleEntryKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") {
      return;
    }

    const disclosure = event.currentTarget.querySelector<HTMLButtonElement>(
      "button[aria-expanded]"
    );
    if (disclosure?.getAttribute("aria-expanded") !== "true") {
      return;
    }

    event.stopPropagation();
    closeRowActions();
    disclosure.focus();
  }

  /**
   * Les quatre actions secondaires d une ligne. Elles sont rendues a deux
   * endroits qui ne coexistent jamais : dans la ligne, revelees au survol ou au
   * focus, et dans le panneau ouvert au clic sur le revelateur. Un seul source
   * pour les deux, sans quoi les libelles et les gardes de re-entree divergent.
   *
   * `fromPanel` ne change qu une chose : replier le panneau et rendre le focus a
   * son declencheur n a de sens que si l on vient du panneau.
   */
  function secondaryActions(entry: LibraryEntry, fromPanel: boolean) {
    return (
      <>
        {confirmingVariantId === entry.draftId ? (
          <Button
            variant="primary"
            size="sm"
            loading={busyDraftId === entry.draftId}
            disabled={busyDraftId !== null}
            onClick={() => {
              setConfirmingVariantId(null);
              void handleCreateDivergentVariant(entry.draftId);
            }}
          >
            Confirmer ?
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busyDraftId !== null}
            onClick={() => setConfirmingVariantId(entry.draftId)}
          >
            Variante
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={busyDraftId !== null}
          onClick={(event) => {
            // Le panneau se referme au profit de la bande de planification :
            // deux bandes empilees sous la meme ligne n auraient plus de lecture
            // possible.
            const alreadyScheduling = schedulingDraftId === entry.draftId;
            setSchedulingDraftId(alreadyScheduling ? null : entry.draftId);
            setSchedulingDate("");
            if (fromPanel) {
              collapseRowActions(event.currentTarget);
            }
          }}
        >
          Planifier
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/creer?ideaId=${entry.ideaId}`)}
        >
          Retravailler
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={busyDraftId !== null}
          onClick={() => setDeletingDraftId(entry.draftId)}
        >
          Supprimer
        </Button>
      </>
    );
  }

  function handleStartEditing(entry: LibraryEntry) {
    closeRowActions();
    setEditingDraftId(entry.draftId);
    setEditHeadline(entry.headline);
    setEditBody(entry.bodyMarkdown);
  }

  function handleCancelEditing() {
    setEditingDraftId(null);
  }

  async function handleSaveEditing(draftId: string) {
    setBusyDraftId(draftId);
    try {
      await window.linkedinPoster.library.updateEntryText(draftId, editHeadline, editBody);
      const refreshed = await window.linkedinPoster.library.listEntries();
      setEntries(refreshed);
      setEditingDraftId(null);
      toast.show({ kind: "success", message: "Texte enregistré." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.show({ kind: "error", message: `Erreur d'enregistrement : ${message}` });
    } finally {
      setBusyDraftId(null);
    }
  }

  async function handleDeleteEntry(draftId: string) {
    // Garde de re-entree : si une suppression (ou toute action draft) est deja
    // en vol, on ignore tout clic supplementaire sur Confirmer (anti
    // double-soumission, complement du bouton disabled cote dialog).
    if (busyDraftId !== null) {
      return;
    }
    setBusyDraftId(draftId);
    try {
      await window.linkedinPoster.library.deleteEntry(draftId);
      const refreshed = await window.linkedinPoster.library.listEntries();
      setEntries(refreshed);
      setDeletingDraftId(null);
      // La ligne disparait : son panneau d actions ne doit pas rester ouvert au
      // profit d une ligne qui reprendrait le meme identifiant plus tard.
      closeRowActions();
      toast.show({ kind: "success", message: "Brouillon supprimé." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.show({ kind: "error", message: `Erreur de suppression : ${message}` });
    } finally {
      setBusyDraftId(null);
    }
  }

  async function handleConfirmSchedule(draftId: string) {
    if (!schedulingDate) return;
    setBusyDraftId(draftId);
    try {
      await window.linkedinPoster.calendar.scheduleDraft({
        draftId,
        plannedDate: schedulingDate,
        status: "planned"
      });
      // Refresh entries and scheduled dates
      const [refreshedEntries, refreshedItems] = await Promise.all([
        window.linkedinPoster.library.listEntries(),
        window.linkedinPoster.calendar.listItems()
      ]);
      setEntries(refreshedEntries);
      const dateMap = new Map<string, string>();
      for (const calItem of refreshedItems) {
        dateMap.set(calItem.draftId, calItem.plannedDate);
      }
      setScheduledDates(dateMap);
      setSchedulingDraftId(null);
      setSchedulingDate("");
      toast.show({ kind: "success", message: "Brouillon planifié." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.show({ kind: "error", message: `Erreur de planification : ${message}` });
    } finally {
      setBusyDraftId(null);
    }
  }

  async function copyDraftToClipboard(text: string, successMessage: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      toast.show({ kind: "success", message: successMessage });
      return true;
    } catch {
      toast.show({
        kind: "error",
        message: "Impossible de copier dans le presse-papier. Vérifiez les autorisations."
      });
      return false;
    }
  }

  async function handleCopyAndMarkPublished(item: CalendarItem, draft: LibraryEntry) {
    const text = `${draft.headline}\n\n${draft.bodyMarkdown}`;
    const copied = await copyDraftToClipboard(
      text,
      "Post copié dans le presse-papier : collez-le sur LinkedIn."
    );
    if (!copied) return;

    if (item.status !== "planned") return;
    try {
      await window.linkedinPoster.calendar.scheduleDraft({
        draftId: item.draftId,
        plannedDate: item.plannedDate,
        status: "published"
      });
      setCalendarItems((prev) =>
        prev.map((ci) => (ci.id === item.id ? { ...ci, status: "published" as const } : ci))
      );
    } catch {
      toast.show({
        kind: "error",
        message: "Post copié, mais le statut « publié » n'a pas pu être enregistré."
      });
    }
  }

  const visibleEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
        return matchesStatus;
      }),
    [entries, statusFilter]
  );

  const visibleCalendarItems = useMemo(
    () =>
      calendarItems.filter(
        (calItem) => calendarStatusFilter === "all" || calItem.status === calendarStatusFilter
      ),
    [calendarItems, calendarStatusFilter]
  );

  const entryBeingDeleted = deletingDraftId
    ? entries.find((entry) => entry.draftId === deletingDraftId) ?? null
    : null;

  const upcomingCount = visibleCalendarItems.filter((i) => i.status !== "published").length;
  const publishedCount = visibleCalendarItems.filter((i) => i.status === "published").length;

  /**
   * Mesures de la section, en une seule phrase alignee a droite de son titre.
   * Elles portent sur les brouillons AFFICHES, pas sur la totalite : c est la
   * lecture coherente avec « 12 sur 30 », qui decrit deja le sous-ensemble.
   * La moyenne disparait quand il n y a rien a moyenner.
   */
  const draftsCount = useMemo(() => {
    const scope =
      visibleEntries.length === entries.length
        ? `${visibleEntries.length}`
        : `${visibleEntries.length} sur ${entries.length}`;

    if (visibleEntries.length === 0) {
      return scope;
    }

    const totalChars = visibleEntries.reduce(
      (sum, entry) => sum + measurePost(entry.bodyMarkdown).chars,
      0
    );
    const average = Math.round(totalChars / visibleEntries.length);

    return `${scope}, longueur moyenne ${average.toLocaleString("fr-FR")} caractères`;
  }, [visibleEntries, entries.length]);

  // Filtres et bascule de vue : de portee ecran, donc dans la barre de page.
  const pageActions = (
    <div className="library-bar">
      <div className="library-tabs">
        <Tabs
          aria-label="Vues de la bibliothèque"
          value={activeTab}
          onChange={(value) => switchTab(value as TabView)}
          items={[
            { value: "drafts", label: "Brouillons" },
            { value: "planning", label: "Planning" }
          ]}
        />
      </div>

      {activeTab === "drafts" ? (
        <>
          <input
            className="library-bar__search"
            aria-label="Recherche"
            value={query}
            onChange={(event) => void handleSearch(event.target.value)}
            placeholder="Titre, pilier, tag…"
          />
          <select
            className="library-bar__select"
            aria-label="Statut"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as LibraryEntry["status"] | "all")
            }
          >
            <option value="all">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="variant">Variante</option>
            <option value="scheduled">Planifié</option>
          </select>
        </>
      ) : (
        <select
          className="library-bar__select"
          aria-label="Filtrer par statut"
          value={calendarStatusFilter}
          onChange={(event) =>
            setCalendarStatusFilter(event.target.value as CalendarItem["status"] | "all")
          }
        >
          <option value="all">Tous les statuts</option>
          <option value="planned">Planifié</option>
          <option value="ready">Prêt</option>
          <option value="published">Publié</option>
          <option value="missed">Manqué</option>
        </select>
      )}
    </div>
  );

  return (
    <PageFrame eyebrow="Bibliothèque" actions={pageActions}>
      {activeTab === "drafts" && (
        <>
          <div className="library-head">
            <span className="eyebrow library-head__title">Brouillons</span>
            <span className="library-head__count">{loading ? "…" : draftsCount}</span>
          </div>

          {loading ? (
            <LoadingList label="Chargement de la bibliothèque" />
          ) : visibleEntries.length === 0 ? (
            <div className="library-empty">
              {entries.length === 0 ? (
                <EmptyState
                  title="Aucun brouillon pour le moment"
                  description="Vos brouillons capitalisés apparaîtront ici. Commencez par créer une idée pour lancer la rédaction d'un premier post."
                  action={{ label: "Créer une idée", onClick: () => navigate("/creer") }}
                />
              ) : (
                <EmptyState
                  title="Aucun résultat"
                  description="Aucun brouillon ne correspond à votre recherche ou au filtre de statut. Essayez d'élargir les critères."
                  action={{
                    label: "Réinitialiser les filtres",
                    onClick: () => {
                      setStatusFilter("all");
                      void handleSearch("");
                    }
                  }}
                />
              )}
            </div>
          ) : (
            <motion.div
              className="library-list"
              variants={listReveal}
              initial="hidden"
              animate="visible"
            >
              {visibleEntries.map((entry) => {
                const metrics = measurePost(entry.bodyMarkdown);
                const plannedDate = scheduledDates.get(entry.draftId);
                const extraTags = entry.tags.filter(
                  (tag) => tag.trim().toLowerCase() !== entry.pillarLabel.trim().toLowerCase()
                );
                const shownTags = extraTags.slice(0, MAX_VISIBLE_TAGS);
                const hiddenTags = extraTags.slice(MAX_VISIBLE_TAGS);
                const isEditing = editingDraftId === entry.draftId;
                const actionsOpen = expandedActionsId === entry.draftId && !isEditing;
                const actionsPanelId = `library-actions-${entry.draftId}`;
                const actionsLabel = `Autres actions pour « ${entry.headline} »`;

                return (
                  <div
                    className="library-entry"
                    key={entry.draftId}
                    onKeyDown={handleEntryKeyDown}
                  >
                    {isEditing ? (
                      <div className="library-row library-row--editing">
                        <input
                          className="library-input"
                          value={editHeadline}
                          onChange={(e) => setEditHeadline(e.target.value)}
                          aria-label="Titre du post"
                        />
                        <textarea
                          className="library-textarea"
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={12}
                          aria-label="Corps du post"
                        />
                        <div className="library-row__actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyDraftId !== null}
                            onClick={handleCancelEditing}
                          >
                            Annuler
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            loading={busyDraftId === entry.draftId}
                            disabled={
                              busyDraftId !== null || !editHeadline.trim() || !editBody.trim()
                            }
                            onClick={() => void handleSaveEditing(entry.draftId)}
                          >
                            Enregistrer
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <article className="library-row">
                        <div className="library-row__main">
                          <span className="library-row__title">{entry.headline}</span>
                          <MetaLine
                            parts={[
                              <span className="library-row__pillar" key="pillar">
                                <PillarDot />
                                <span className="library-row__pillar-name">
                                  {entry.pillarLabel}
                                </span>
                              </span>,
                              // « Brouillon » repete sur chaque ligne d un onglet
                              // qui s appelle deja Brouillons n apprend rien. Seul
                              // l etat qui sort de l ordinaire est dit.
                              ...(entry.status === "draft"
                                ? []
                                : [
                                    <span className="library-row__status" key="status">
                                      {formatLibraryStatus(entry.status)}
                                    </span>
                                  ]),
                              ...(plannedDate
                                ? [
                                    <span className="library-row__num" key="date">
                                      {plannedDate}
                                    </span>
                                  ]
                                : []),
                              <span
                                key="chars"
                                className={`library-row__num${
                                  metrics.overLimit ? " library-row__num--over" : ""
                                }`}
                              >
                                {formatCharCount(entry.bodyMarkdown)}
                              </span>,
                              ...(shownTags.length > 0
                                ? [
                                    <span className="library-row__tags" key="tags">
                                      <span className="library-row__tag-list">
                                        {shownTags.join(", ")}
                                      </span>
                                      {hiddenTags.length > 0 ? (
                                        <span
                                          className="library-row__more"
                                          title={hiddenTags.join(", ")}
                                        >
                                          +{hiddenTags.length}
                                        </span>
                                      ) : null}
                                    </span>
                                  ]
                                : [])
                            ]}
                          />
                        </div>

                        {/*
                         * Deux etats, comme la maquette. Au repos, « Modifier »
                         * et le revelateur : cinq actions ecrites sur chaque
                         * ligne faisaient de « Supprimer » le motif le plus
                         * repete de l ecran, alors que c est l action la moins
                         * souhaitable. Au survol ou au focus clavier, les quatre
                         * autres se decouvrent par-dessus, sans rien remplacer.
                         *
                         * Le groupe revele n est pas rendu quand le panneau du
                         * revelateur est ouvert : il porterait les memes quatre
                         * actions, en double sur la meme ligne.
                         */}
                        <div className="library-row__actions library-row__actions--compact">
                          {!actionsOpen && (
                            <div className="library-row__actions-extra">
                              {secondaryActions(entry, false)}
                            </div>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyDraftId !== null}
                            onClick={() => handleStartEditing(entry)}
                          >
                            Modifier
                          </Button>
                          <Button
                            className="library-row__disclosure"
                            variant="secondary"
                            size="sm"
                            aria-expanded={actionsOpen}
                            aria-controls={actionsOpen ? actionsPanelId : undefined}
                            aria-label={actionsLabel}
                            title="Autres actions"
                            onClick={() => {
                              if (actionsOpen) {
                                closeRowActions();
                              } else {
                                setExpandedActionsId(entry.draftId);
                              }
                            }}
                          >
                            <MoreHorizontalIcon />
                          </Button>
                        </div>
                      </article>
                    )}

                    {actionsOpen && (
                      <div
                        className="library-actions"
                        id={actionsPanelId}
                        role="group"
                        aria-label={actionsLabel}
                      >
                        {secondaryActions(entry, true)}
                      </div>
                    )}

                    {schedulingDraftId === entry.draftId && (
                      <div className="library-schedule">
                        <input
                          type="date"
                          aria-label="Date de publication"
                          value={schedulingDate}
                          onChange={(e) => setSchedulingDate(e.target.value)}
                          className="library-input library-schedule__input"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          loading={busyDraftId === entry.draftId}
                          disabled={!schedulingDate || busyDraftId !== null}
                          onClick={() => void handleConfirmSchedule(entry.draftId)}
                        >
                          Planifier à cette date
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyDraftId !== null}
                          onClick={() => {
                            setSchedulingDraftId(null);
                            setSchedulingDate("");
                          }}
                        >
                          Annuler
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </>
      )}

      {activeTab === "planning" && (
        <>
          <p className="library-note">
            Le planning est votre calendrier éditorial personnel. Il ne publie rien automatiquement :
            quand la date arrive, ouvrez le post, copiez-le et collez-le sur LinkedIn.
          </p>

          <div className="library-head">
            <span className="eyebrow library-head__title">Planning</span>
            <span className="library-head__count">
              {planningLoading ? "…" : `${upcomingCount} à venir · ${publishedCount} publiés`}
            </span>
          </div>

          {planningLoading ? (
            <LoadingList label="Chargement du planning" />
          ) : visibleCalendarItems.length === 0 ? (
            <div className="library-empty">
              {calendarItems.length === 0 ? (
                <EmptyState
                  title="Aucune publication planifiée"
                  description="Planifiez un brouillon depuis l'onglet Brouillons pour l'ajouter à votre calendrier éditorial."
                  action={{ label: "Voir les brouillons", onClick: () => switchTab("drafts") }}
                />
              ) : (
                <EmptyState
                  title="Aucun résultat"
                  description="Aucune publication ne correspond à ce filtre de statut. Essayez « Tous les statuts »."
                  action={{
                    label: "Tous les statuts",
                    onClick: () => setCalendarStatusFilter("all")
                  }}
                />
              )}
            </div>
          ) : (
            <motion.div
              className="library-list"
              variants={listReveal}
              initial="hidden"
              animate="visible"
            >
              {visibleCalendarItems.map((calItem) => {
                const draft = entries.find((e) => e.draftId === calItem.draftId);
                return (
                  <div className="library-entry" key={calItem.id}>
                    <article className="library-row">
                      <div className="library-row__main">
                        <span className="library-row__title">{calItem.draftHeadline}</span>
                        <MetaLine
                          parts={[
                            <span className="library-row__num" key="date">
                              {calItem.plannedDate}
                            </span>,
                            <span className="library-row__status" key="status">
                              {formatCalendarStatus(calItem.status)}
                            </span>,
                            <span className="library-row__pillar" key="pillar">
                              <PillarDot />
                              <span className="library-row__pillar-name">
                                {calItem.pillarLabel}
                              </span>
                            </span>
                          ]}
                        />
                      </div>

                      <div className="library-row__actions">
                        <Button variant="ghost" size="sm" onClick={() => switchTab("drafts")}>
                          Voir dans les brouillons
                        </Button>
                        {draft && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                void copyDraftToClipboard(
                                  `${draft.headline}\n\n${draft.bodyMarkdown}`,
                                  "Post copié."
                                )
                              }
                            >
                              Copier
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void handleCopyAndMarkPublished(calItem, draft)}
                            >
                              Copier et marquer publié
                            </Button>
                          </>
                        )}
                      </div>
                    </article>
                  </div>
                );
              })}
            </motion.div>
          )}
        </>
      )}

      <ConfirmDialog
        open={entryBeingDeleted !== null}
        destructive
        title="Supprimer ce brouillon ?"
        message={
          entryBeingDeleted
            ? `« ${entryBeingDeleted.headline} » sera définitivement supprimé de votre bibliothèque. Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        confirmLoading={busyDraftId !== null}
        onConfirm={() => {
          if (entryBeingDeleted) {
            void handleDeleteEntry(entryBeingDeleted.draftId);
          }
        }}
        onCancel={() => setDeletingDraftId(null)}
      />
    </PageFrame>
  );
}
