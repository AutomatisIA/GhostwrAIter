import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import type { LibraryEntry, LibraryTriage } from "@shared/types/library";
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
import { MetaLine, PillarDot } from "./meta-line";
import { PostReader } from "./PostReader";
import { TriageList } from "./TriageList";
import {
  TRIAGE_BUCKETS,
  countByTriage,
  flattenGroups,
  groupBySubject
} from "./triage";

import "./library.css";

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
 * Trois points du revelateur d actions secondaires. Le jeu d icones partage
 * (`design-system/primitives/icons`) appartient au chantier commun : ce trace
 * reste confine a l ecran Bibliotheque plutot que d y etre ajoute.
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

  // --- Brouillons ---
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);

  // --- Triage ---
  // Entree choisie A LA MAIN. Tant qu'elle vaut `null`, l'entree active est
  // deduite des comptes : arriver sur « À relire 0 » alors que cinq brouillons
  // sont prets ferait ouvrir l'ecran sur un vide.
  const [pickedBucket, setPickedBucket] = useState<LibraryTriage | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmingVariant, setConfirmingVariant] = useState(false);

  // --- Edition et planification, portees par le brouillon selectionne ---
  // Les deux etats retiennent un identifiant et non un booleen : la selection
  // peut changer sous eux (suppression, changement d'entree de triage), et un
  // tampon d'edition applique au brouillon suivant ecraserait un texte au
  // hasard.
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editHeadline, setEditHeadline] = useState("");
  const [editBody, setEditBody] = useState("");
  const [schedulingDraftId, setSchedulingDraftId] = useState<string | null>(null);
  const [schedulingDate, setSchedulingDate] = useState("");

  // --- Planning ---
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [calendarStatusFilter, setCalendarStatusFilter] = useState<CalendarItem["status"] | "all">(
    "all"
  );
  const [planningLoading, setPlanningLoading] = useState(false);

  // --- Dates planifiees (draftId -> plannedDate) ---
  const [scheduledDates, setScheduledDates] = useState<Map<string, string>>(new Map());

  function switchTab(tab: TabView) {
    // `activeTab` etant derive de l'URL, il suffit de mettre a jour la query :
    // le changement de `searchParams` re-rend et re-derive l'onglet actif.
    setSearchParams(tab === "drafts" ? {} : { view: "planning" });
  }

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

  useEffect(() => {
    if (activeTab !== "planning") return;

    setPlanningLoading(true);

    window.linkedinPoster.calendar
      .listItems()
      .then((items) => {
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

  // ---------------------------------------------------------------------------
  // Triage : comptes reels, entree active, regroupement par sujet, selection.
  // ---------------------------------------------------------------------------

  const counts = useMemo(() => countByTriage(entries), [entries]);

  const activeBucket: LibraryTriage =
    pickedBucket ?? TRIAGE_BUCKETS.find((bucket) => counts[bucket.id] > 0)?.id ?? "a-relire";

  const bucketEntries = useMemo(
    () => entries.filter((entry) => entry.triage === activeBucket),
    [entries, activeBucket]
  );

  const groups = useMemo(() => groupBySubject(bucketEntries), [bucketEntries]);
  const orderedEntries = useMemo(() => flattenGroups(groups), [groups]);

  // La selection est DERIVEE, jamais synchronisee par un effet : supprimer le
  // brouillon lu, changer d'entree de triage ou lancer une recherche ferait
  // sinon pointer la selection sur une ligne qui n'existe plus. Le repli est le
  // premier de la liste, c'est-a-dire le plus abouti du sujet le plus prolifique.
  const selectedEntry =
    orderedEntries.find((entry) => entry.draftId === selectedDraftId) ?? orderedEntries[0] ?? null;

  const isEditing = editingDraftId !== null && editingDraftId === selectedEntry?.draftId;
  const isScheduling = schedulingDraftId !== null && schedulingDraftId === selectedEntry?.draftId;

  function selectDraft(draftId: string) {
    setSelectedDraftId(draftId);
    setActionsOpen(false);
    setConfirmingVariant(false);
  }

  function toggleGroup(key: string) {
    setExpandedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function closeActions() {
    setActionsOpen(false);
    setConfirmingVariant(false);
  }

  /**
   * Echap referme le panneau d actions secondaires et rend le focus a son
   * declencheur. Sans ce rappel, refermer depuis le panneau demonte l element
   * focalise et renvoie le focus sur `body` : la navigation au clavier repart du
   * haut de la page.
   */
  function handleReaderKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
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
    closeActions();
    disclosure.focus();
  }

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

  function handleStartEditing(entry: LibraryEntry) {
    closeActions();
    setEditingDraftId(entry.draftId);
    setEditHeadline(entry.headline);
    setEditBody(entry.bodyMarkdown);
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
      closeActions();
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
   * Effectif de la colonne, aligne a droite des entrees de triage. Une recherche
   * active REMPLACE le jeu d entrees : ecrire « 30 au total » alors que la
   * recherche n en a ramene trois serait faux, le libelle dit donc laquelle des
   * deux portees il decrit.
   */
  const totalLabel = query.trim()
    ? `${entries.length} résultat${entries.length > 1 ? "s" : ""}`
    : `${entries.length} au total`;

  const activeBucketDescriptor =
    TRIAGE_BUCKETS.find((bucket) => bucket.id === activeBucket) ?? TRIAGE_BUCKETS[0]!;

  /** Premiere entree non vide autre que celle qui est affichee, pour l etat vide. */
  const fallbackBucket = TRIAGE_BUCKETS.find(
    (bucket) => bucket.id !== activeBucket && counts[bucket.id] > 0
  );

  const actionsPanelId = "library-reader-actions";
  const actionsLabel = selectedEntry
    ? `Autres actions pour « ${selectedEntry.headline} »`
    : "Autres actions";

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
        <input
          className="library-bar__search"
          aria-label="Recherche"
          value={query}
          onChange={(event) => void handleSearch(event.target.value)}
          placeholder="Titre, pilier, tag…"
        />
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
      {activeTab === "drafts" &&
        (loading ? (
          <LoadingList label="Chargement de la bibliothèque" />
        ) : entries.length === 0 ? (
          <div className="library-empty">
            {query.trim() ? (
              <EmptyState
                title="Aucun résultat"
                description="Aucun brouillon ne correspond à votre recherche. Essayez un autre mot, ou effacez la recherche pour retrouver toute la bibliothèque."
                action={{ label: "Effacer la recherche", onClick: () => void handleSearch("") }}
              />
            ) : (
              <EmptyState
                title="Aucun brouillon pour le moment"
                description="Vos brouillons capitalisés apparaîtront ici. Commencez par créer une idée pour lancer la rédaction d'un premier post."
                action={{ label: "Créer une idée", onClick: () => navigate("/creer") }}
              />
            )}
          </div>
        ) : (
          <div className="library-triage">
            {/* Volet de gauche : ce qu'il reste a faire, puis les sujets. */}
            <div className="library-triage__side">
              <div className="library-buckets" role="group" aria-label="Ce qu'il reste à faire">
                {TRIAGE_BUCKETS.map((bucket) => (
                  <button
                    key={bucket.id}
                    type="button"
                    className="library-bucket"
                    aria-pressed={bucket.id === activeBucket}
                    onClick={() => {
                      setPickedBucket(bucket.id);
                      closeActions();
                    }}
                  >
                    {bucket.label} <span className="library-bucket__count">{counts[bucket.id]}</span>
                  </button>
                ))}
                <span className="library-buckets__total">{totalLabel}</span>
              </div>

              <div className="library-triage__scroll">
                {orderedEntries.length === 0 ? (
                  <div className="library-triage__empty">
                    <EmptyState
                      title={activeBucketDescriptor.emptyTitle}
                      description={activeBucketDescriptor.emptyDescription}
                      action={
                        fallbackBucket
                          ? {
                              label: `Voir ${counts[fallbackBucket.id]} « ${fallbackBucket.label.toLowerCase()} »`,
                              onClick: () => setPickedBucket(fallbackBucket.id)
                            }
                          : undefined
                      }
                    />
                  </div>
                ) : (
                  <motion.div variants={listReveal} initial="hidden" animate="visible">
                    <TriageList
                      groups={groups}
                      selectedDraftId={selectedEntry?.draftId ?? null}
                      onSelect={selectDraft}
                      expandedKeys={expandedKeys}
                      onToggleGroup={toggleGroup}
                    />
                  </motion.div>
                )}
              </div>
            </div>

            {/* Volet de droite : le post, lisible, et ses actions. */}
            <div className="library-reader" onKeyDown={handleReaderKeyDown}>
              {selectedEntry === null ? (
                <p className="library-reader__blank">
                  Choisissez une entrée qui contient des brouillons pour en lire un ici.
                </p>
              ) : isEditing ? (
                <>
                  <div className="library-reader__edit">
                    <input
                      className="library-input"
                      value={editHeadline}
                      onChange={(event) => setEditHeadline(event.target.value)}
                      aria-label="Titre du post"
                    />
                    <textarea
                      className="library-textarea library-reader__textarea"
                      value={editBody}
                      onChange={(event) => setEditBody(event.target.value)}
                      aria-label="Corps du post"
                    />
                  </div>
                  <footer className="library-reader__bar">
                    <div className="library-reader__buttons">
                      <Button
                        variant="primary"
                        loading={busyDraftId === selectedEntry.draftId}
                        disabled={busyDraftId !== null || !editHeadline.trim() || !editBody.trim()}
                        onClick={() => void handleSaveEditing(selectedEntry.draftId)}
                      >
                        Enregistrer
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busyDraftId !== null}
                        onClick={() => setEditingDraftId(null)}
                      >
                        Annuler
                      </Button>
                    </div>
                  </footer>
                </>
              ) : (
                <>
                  <PostReader
                    entry={selectedEntry}
                    plannedDate={scheduledDates.get(selectedEntry.draftId)}
                  />

                  <footer className="library-reader__bar">
                    {actionsOpen ? (
                      <div
                        className="library-actions"
                        id={actionsPanelId}
                        role="group"
                        aria-label={actionsLabel}
                      >
                        {confirmingVariant ? (
                          <Button
                            variant="primary"
                            size="sm"
                            loading={busyDraftId === selectedEntry.draftId}
                            disabled={busyDraftId !== null}
                            onClick={() => {
                              setConfirmingVariant(false);
                              void handleCreateDivergentVariant(selectedEntry.draftId);
                            }}
                          >
                            Confirmer ?
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyDraftId !== null}
                            onClick={() => setConfirmingVariant(true)}
                          >
                            Variante
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busyDraftId !== null}
                          onClick={() => setDeletingDraftId(selectedEntry.draftId)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    ) : null}

                    {isScheduling ? (
                      <div className="library-schedule">
                        <input
                          type="date"
                          aria-label="Date de publication"
                          value={schedulingDate}
                          onChange={(event) => setSchedulingDate(event.target.value)}
                          className="library-input library-schedule__input"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          loading={busyDraftId === selectedEntry.draftId}
                          disabled={!schedulingDate || busyDraftId !== null}
                          onClick={() => void handleConfirmSchedule(selectedEntry.draftId)}
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
                    ) : null}

                    <div className="library-reader__buttons">
                      <Button
                        variant="primary"
                        onClick={() =>
                          void copyDraftToClipboard(
                            `${selectedEntry.headline}\n\n${selectedEntry.bodyMarkdown}`,
                            "Post copié dans le presse-papier : collez-le sur LinkedIn."
                          )
                        }
                      >
                        Copier le post
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busyDraftId !== null}
                        onClick={() => {
                          setSchedulingDraftId(isScheduling ? null : selectedEntry.draftId);
                          setSchedulingDate("");
                          closeActions();
                        }}
                      >
                        Planifier
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busyDraftId !== null}
                        onClick={() => handleStartEditing(selectedEntry)}
                      >
                        Modifier
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => navigate(`/creer?ideaId=${selectedEntry.ideaId}`)}
                      >
                        Retravailler
                      </Button>
                      <Button
                        className="library-reader__disclosure"
                        variant="secondary"
                        aria-expanded={actionsOpen}
                        aria-controls={actionsOpen ? actionsPanelId : undefined}
                        aria-label={actionsLabel}
                        title="Autres actions"
                        onClick={() => {
                          if (actionsOpen) {
                            closeActions();
                          } else {
                            setActionsOpen(true);
                          }
                        }}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </div>
                  </footer>
                </>
              )}
            </div>
          </div>
        ))}

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
