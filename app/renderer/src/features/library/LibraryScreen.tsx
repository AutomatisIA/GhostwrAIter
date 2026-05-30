import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import type { LibraryEntry } from "@shared/types/library";
import type { CalendarItem } from "@shared/types/calendar";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  Tabs,
  useToast
} from "../../design-system/primitives";
import {
  fadeInUp,
  staggerContainer,
  useMotionVariants
} from "../../design-system/motion/variants";
import { InfoHint } from "../../help";

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

type TabView = "drafts" | "planning";

export function LibraryScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const container = useMotionVariants(staggerContainer);
  const item = useMotionVariants(fadeInUp);

  const initialView = (searchParams.get("view") === "planning" ? "planning" : "drafts") as TabView;
  const [activeTab, setActiveTab] = useState<TabView>(initialView);

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
    setActiveTab(tab);
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
        // Non-critique : les badges de date ne s'affichent simplement pas.
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

  return (
    <section className="panel page-panel">
      <h1>Bibliothèque</h1>

      <Tabs
        aria-label="Vues de la bibliothèque"
        value={activeTab}
        onChange={(value) => switchTab(value as TabView)}
        items={[
          { value: "drafts", label: "Brouillons" },
          { value: "planning", label: "Planning" }
        ]}
      />

      {activeTab === "drafts" && (
        <>
          <div className="insight-strip">
            <article className="insight-card">
              <span className="status-label">
                Brouillons visibles <InfoHint term="draft" />
              </span>
              <strong>
                {loading
                  ? "…"
                  : `${visibleEntries.length} brouillon${visibleEntries.length > 1 ? "s" : ""}`}
              </strong>
            </article>
            <article className="insight-card">
              <span className="status-label">
                Qualité moyenne <InfoHint term="score-qualite" />
              </span>
              <strong>
                {loading || visibleEntries.length === 0
                  ? "…"
                  : `${Math.round(
                      (visibleEntries.reduce((sum, entry) => sum + entry.qualityScore, 0) /
                        visibleEntries.length) *
                        100
                    )}%`}
              </strong>
            </article>
          </div>

          <div className="filter-bar">
            <label className="field compact-field">
              <span>Recherche</span>
              <input
                aria-label="Recherche"
                value={query}
                onChange={(event) => void handleSearch(event.target.value)}
                placeholder="Titre, pilier, tag…"
              />
            </label>
            <label className="field compact-field">
              <span>Statut</span>
              <select
                aria-label="Statut"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as LibraryEntry["status"] | "all")
                }
              >
                <option value="all">Tous</option>
                <option value="draft">Brouillon</option>
                <option value="variant">Variante</option>
                <option value="scheduled">Planifié</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="list-grid" aria-label="Chargement de la bibliothèque">
              <Skeleton variant="card" />
              <Skeleton variant="card" />
            </div>
          ) : visibleEntries.length === 0 ? (
            <Card elevation={1} className="library-empty-card">
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
            </Card>
          ) : (
            <motion.div
              className="list-grid"
              variants={container}
              initial="hidden"
              animate="visible"
            >
              {visibleEntries.map((entry) => (
                <motion.div key={entry.draftId} variants={item}>
                  <Card elevation={2} interactive={false} className="lib-card">
                    {editingDraftId === entry.draftId ? (
                      <>
                        <input
                          className="draft-edit-headline"
                          value={editHeadline}
                          onChange={(e) => setEditHeadline(e.target.value)}
                          aria-label="Titre du post"
                        />
                        <textarea
                          className="draft-edit-body"
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={12}
                          aria-label="Corps du post"
                        />
                        <div className="lib-card-toolbar lib-card-toolbar--edit">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyDraftId !== null}
                            onClick={handleCancelEditing}
                          >
                            Annuler
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <strong className="lib-card-headline">{entry.headline}</strong>
                        <p className="lib-card-preview">{entry.bodyPreview}</p>
                        <div className="lib-card-meta">
                          <span className="lib-card-tag">{entry.pillarLabel}</span>
                          <span className="lib-card-tag">{formatLibraryStatus(entry.status)}</span>
                          {scheduledDates.has(entry.draftId) && (
                            <span className="lib-card-tag lib-card-tag--scheduled">
                              {scheduledDates.get(entry.draftId)}
                            </span>
                          )}
                          {entry.tags.map((tag) => (
                            <span key={tag} className="lib-card-tag lib-card-tag--muted">
                              {tag}
                            </span>
                          ))}
                          <span className="lib-card-quality">
                            <span
                              className="lib-card-quality-dot"
                              style={{
                                background:
                                  entry.qualityScore >= 0.8
                                    ? "var(--color-accent-sky)"
                                    : entry.qualityScore >= 0.6
                                      ? "var(--color-accent)"
                                      : "var(--color-warning-text)"
                              }}
                            />
                            {Math.round(entry.qualityScore * 100)}%
                          </span>
                        </div>
                        <div className="lib-card-toolbar">
                          <div className="lib-card-toolbar-primary">
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
                                variant="secondary"
                                size="sm"
                                disabled={busyDraftId !== null}
                                onClick={() => setConfirmingVariantId(entry.draftId)}
                              >
                                Variante
                              </Button>
                            )}
                            <Button
                              variant="secondary"
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
                          </div>
                          <div className="lib-card-toolbar-secondary">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyDraftId !== null}
                              onClick={() => handleStartEditing(entry)}
                            >
                              Modifier
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/creer?ideaId=${entry.ideaId}`)}
                            >
                              Retravailler
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="lib-card-action-danger"
                              disabled={busyDraftId !== null}
                              onClick={() => setDeletingDraftId(entry.draftId)}
                            >
                              Supprimer
                            </Button>
                          </div>
                        </div>
                        {schedulingDraftId === entry.draftId && (
                          <div className="lib-card-schedule">
                            <input
                              type="date"
                              aria-label="Date de publication"
                              value={schedulingDate}
                              onChange={(e) => setSchedulingDate(e.target.value)}
                              className="lib-card-schedule-input"
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
                      </>
                    )}
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </>
      )}

      {activeTab === "planning" && (
        <>
          <p className="library-planning-intro">
            Le planning est votre calendrier éditorial personnel. Il ne publie rien automatiquement :
            quand la date arrive, ouvrez le post, copiez-le et collez-le sur LinkedIn.
          </p>

          <div className="insight-strip">
            <article className="insight-card">
              <span className="status-label">À venir</span>
              <strong>
                {planningLoading
                  ? "…"
                  : `${upcomingCount} post${upcomingCount > 1 ? "s" : ""}`}
              </strong>
            </article>
            <article className="insight-card">
              <span className="status-label">Publiés</span>
              <strong>{planningLoading ? "…" : `${publishedCount}`}</strong>
            </article>
          </div>

          <div className="filter-bar" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
            <label className="field compact-field">
              <span>Statut</span>
              <select
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
            </label>
          </div>

          {planningLoading ? (
            <div className="list-grid" aria-label="Chargement du planning">
              <Skeleton variant="card" />
              <Skeleton variant="card" />
            </div>
          ) : visibleCalendarItems.length === 0 ? (
            <Card elevation={1} className="library-empty-card">
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
            </Card>
          ) : (
            <motion.div
              className="list-grid"
              variants={container}
              initial="hidden"
              animate="visible"
            >
              {visibleCalendarItems.map((calItem) => {
                const draft = entries.find((e) => e.draftId === calItem.draftId);
                return (
                  <motion.div key={calItem.id} variants={item}>
                    <Card elevation={2} interactive={false} className="lib-card">
                      <div className="lib-card-meta">
                        <span className="lib-card-tag">{calItem.pillarLabel}</span>
                        <span className="lib-card-tag">{formatCalendarStatus(calItem.status)}</span>
                        <span className="lib-card-planned-date">{calItem.plannedDate}</span>
                      </div>
                      <strong className="lib-card-headline">{calItem.draftHeadline}</strong>
                      {draft && (
                        <p className="lib-card-preview lib-card-preview--planning">
                          {draft.bodyPreview}
                        </p>
                      )}
                      <div className="lib-card-toolbar">
                        <div className="lib-card-toolbar-primary">
                          {draft && (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => void handleCopyAndMarkPublished(calItem, draft)}
                              >
                                Copier et marquer publié
                              </Button>
                              <Button
                                variant="secondary"
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
                            </>
                          )}
                        </div>
                        <div className="lib-card-toolbar-secondary">
                          <Button variant="ghost" size="sm" onClick={() => switchTab("drafts")}>
                            Voir dans les brouillons
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
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
        onConfirm={() => {
          if (entryBeingDeleted) {
            void handleDeleteEntry(entryBeingDeleted.draftId);
          }
        }}
        onCancel={() => setDeletingDraftId(null)}
      />
    </section>
  );
}
