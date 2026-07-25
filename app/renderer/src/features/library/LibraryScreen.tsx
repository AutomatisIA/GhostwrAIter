import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { InfoHint } from "../../help";

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
 * Ligne de metadonnees du modele de liste : une pastille, puis des fragments
 * separes par des points medians. Le separateur est purement typographique,
 * d ou `aria-hidden` : lu a voix haute il n ajoute rien au fragment qu il suit.
 */
function MetaLine({ parts }: { parts: ReactNode[] }) {
  return (
    <span className="library-row__meta">
      <span className="library-row__dot" aria-hidden="true" />
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

  function handleStartEditing(entry: LibraryEntry) {
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

  const draftsCount =
    visibleEntries.length === entries.length
      ? `${visibleEntries.length} brouillon${visibleEntries.length > 1 ? "s" : ""}`
      : `${visibleEntries.length} sur ${entries.length}`;

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
            <span className="eyebrow library-head__title">
              Brouillons <InfoHint term="draft" />
            </span>
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

                return (
                  <div className="library-entry" key={entry.draftId}>
                    {editingDraftId === entry.draftId ? (
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
                                {entry.pillarLabel}
                              </span>,
                              <span key="status">{formatLibraryStatus(entry.status)}</span>,
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
                              ...extraTags.map((tag) => <span key={`tag-${tag}`}>{tag}</span>)
                            ]}
                          />
                        </div>

                        <div className="library-row__actions">
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
                            onClick={() => {
                              if (schedulingDraftId === entry.draftId) {
                                setSchedulingDraftId(null);
                                setSchedulingDate("");
                              } else {
                                setSchedulingDraftId(entry.draftId);
                                setSchedulingDate("");
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
                            variant="secondary"
                            size="sm"
                            disabled={busyDraftId !== null}
                            onClick={() => handleStartEditing(entry)}
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={busyDraftId !== null}
                            onClick={() => setDeletingDraftId(entry.draftId)}
                          >
                            Supprimer
                          </Button>
                        </div>
                      </article>
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
                            <span key="status">{formatCalendarStatus(calItem.status)}</span>,
                            <span className="library-row__pillar" key="pillar">
                              {calItem.pillarLabel}
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
