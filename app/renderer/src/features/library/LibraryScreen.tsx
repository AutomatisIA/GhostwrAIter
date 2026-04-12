import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { LibraryEntry } from "@shared/types/library";
import type { CalendarItem } from "@shared/types/calendar";

function formatLibraryStatus(status: LibraryEntry["status"]) {
  if (status === "scheduled") {
    return "Planifie";
  }

  if (status === "variant") {
    return "Variante";
  }

  return "Draft";
}

function formatCalendarStatus(status: CalendarItem["status"]) {
  if (status === "planned") {
    return "Planifie";
  }

  if (status === "published") {
    return "Publie";
  }

  if (status === "missed") {
    return "Manque";
  }

  return "Pret";
}

type TabView = "drafts" | "planning";

export function LibraryScreen() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialView = (searchParams.get("view") === "planning" ? "planning" : "drafts") as TabView;
  const [activeTab, setActiveTab] = useState<TabView>(initialView);

  // --- Drafts state ---
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LibraryEntry["status"] | "all">("all");
  const [status, setStatus] = useState("Chargement de la bibliotheque...");
  const [loading, setLoading] = useState(true);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
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
  const [planningStatus, setPlanningStatus] = useState("");

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
        setStatus(
          result.length > 0
            ? "Bibliotheque chargee."
            : "Aucun draft capitalise pour le moment."
        );
      })
      .catch(() => {
        setStatus("Impossible de charger la bibliotheque.");
      })
      .finally(() => {
        setLoading(false);
      });

    // Also load calendar items to populate scheduled dates badges
    window.linkedinPoster.calendar.listItems().then((items) => {
      const dateMap = new Map<string, string>();
      for (const item of items) {
        dateMap.set(item.draftId, item.plannedDate);
      }
      setScheduledDates(dateMap);
    }).catch(() => {
      // Non-critical — badges just won't show
    });
  }, []);

  // Load planning items when switching to planning tab
  useEffect(() => {
    if (activeTab !== "planning") return;

    setPlanningLoading(true);
    setPlanningStatus("Chargement du planning...");

    window.linkedinPoster.calendar
      .listItems()
      .then((items) => {
        // Sort chronologically
        const sorted = [...items].sort(
          (a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime()
        );
        setCalendarItems(sorted);
        setPlanningStatus(
          sorted.length > 0
            ? "Planning charge."
            : "Aucune publication planifiee."
        );
      })
      .catch(() => {
        setPlanningStatus("Impossible de charger le planning.");
      })
      .finally(() => {
        setPlanningLoading(false);
      });
  }, [activeTab]);

  async function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    const result = await window.linkedinPoster.library.searchEntries({ query: nextQuery });
    setEntries(result);
    setStatus(
      result.length > 0
        ? "Resultats filtres localement."
        : "Aucun draft ne correspond aux filtres."
    );
  }

  async function handleCreateDivergentVariant(draftId: string) {
    setBusyDraftId(draftId);
    setStatus("Creation de la variante divergente en cours...");
    try {
      await window.linkedinPoster.library.createDivergentVariant(draftId);
      const refreshed = await window.linkedinPoster.library.listEntries();
      setEntries(refreshed);
      setStatus("Variante divergente creee — structure, accroche et angle differents.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setStatus(`Erreur variante divergente : ${message}`);
    } finally {
      setBusyDraftId(null);
    }
  }

  function handleStartEditing(entry: LibraryEntry) {
    setDeletingDraftId(null);
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
      setStatus("Texte enregistre.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setStatus(`Erreur d'enregistrement : ${message}`);
    } finally {
      setBusyDraftId(null);
    }
  }

  async function handleDeleteEntry(draftId: string) {
    setBusyDraftId(draftId);
    setStatus("Suppression en cours...");
    try {
      await window.linkedinPoster.library.deleteEntry(draftId);
      const refreshed = await window.linkedinPoster.library.listEntries();
      setEntries(refreshed);
      setDeletingDraftId(null);
      setStatus("Draft supprime.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setStatus(`Erreur de suppression : ${message}`);
    } finally {
      setBusyDraftId(null);
    }
  }

  async function handleConfirmSchedule(draftId: string) {
    if (!schedulingDate) return;
    setBusyDraftId(draftId);
    setStatus("Planification en cours...");
    try {
      await window.linkedinPoster.calendar.scheduleDraft({
        draftId,
        plannedDate: schedulingDate,
        status: "planned",
      });
      // Refresh entries and scheduled dates
      const [refreshedEntries, refreshedItems] = await Promise.all([
        window.linkedinPoster.library.listEntries(),
        window.linkedinPoster.calendar.listItems(),
      ]);
      setEntries(refreshedEntries);
      const dateMap = new Map<string, string>();
      for (const item of refreshedItems) {
        dateMap.set(item.draftId, item.plannedDate);
      }
      setScheduledDates(dateMap);
      setSchedulingDraftId(null);
      setSchedulingDate("");
      setStatus("Draft planifie.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setStatus(`Erreur de planification : ${message}`);
    } finally {
      setBusyDraftId(null);
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
        (item) => calendarStatusFilter === "all" || item.status === calendarStatusFilter
      ),
    [calendarItems, calendarStatusFilter]
  );

  return (
    <section className="panel page-panel">
      <h1>Bibliotheque locale</h1>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
        <button
          type="button"
          className={activeTab === "drafts" ? "primary-button" : "secondary-button"}
          style={{ padding: "10px 20px", fontSize: "0.92rem" }}
          onClick={() => switchTab("drafts")}
        >
          Drafts
        </button>
        <button
          type="button"
          className={activeTab === "planning" ? "primary-button" : "secondary-button"}
          style={{ padding: "10px 20px", fontSize: "0.92rem" }}
          onClick={() => switchTab("planning")}
        >
          Planning
        </button>
      </div>

      {activeTab === "drafts" && (
        <>
          <div className="insight-strip">
            <article className="insight-card">
              <span className="status-label">Visibles</span>
              <strong>
                {loading
                  ? "..."
                  : `${visibleEntries.length} draft${visibleEntries.length > 1 ? "s" : ""}`}
              </strong>
            </article>
            <article className="insight-card">
              <span className="status-label">Qualite moyenne</span>
              <strong>
                {loading || visibleEntries.length === 0
                  ? "..."
                  : `${Math.round(
                      visibleEntries.reduce((sum, entry) => sum + entry.qualityScore, 0) /
                        visibleEntries.length *
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
                placeholder="Titre, pilier, tag..."
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
                <option value="draft">Draft</option>
                <option value="variant">Variante</option>
                <option value="scheduled">Planifie</option>
              </select>
            </label>
          </div>
          <div className="form-status">{status}</div>

          {loading ? (
            <div className="list-grid" aria-label="Chargement de la bibliotheque">
              <article className="list-card skeleton-card" />
              <article className="list-card skeleton-card" />
            </div>
          ) : null}

          <div className="list-grid">
            {visibleEntries.map((entry) => (
              <article key={entry.draftId} className="lib-card">
                {editingDraftId === entry.draftId ? (
                  <>
                    <input className="draft-edit-headline" value={editHeadline} onChange={(e) => setEditHeadline(e.target.value)} aria-label="Titre du post" />
                    <textarea className="draft-edit-body" value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={12} aria-label="Corps du post" />
                    <div className="form-actions" style={{ marginTop: 8 }}>
                      <button type="button" className="primary-button" style={{ padding: "8px 18px" }} onClick={() => void handleSaveEditing(entry.draftId)} disabled={busyDraftId !== null || !editHeadline.trim() || !editBody.trim()}>Enregistrer</button>
                      <button type="button" className="secondary-button" style={{ padding: "8px 18px" }} onClick={handleCancelEditing} disabled={busyDraftId !== null}>Annuler</button>
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
                        <span className="lib-card-tag" style={{ background: "var(--color-sky-bg)", color: "var(--color-accent-sky)" }}>
                          {scheduledDates.get(entry.draftId)}
                        </span>
                      )}
                      {entry.tags.map((tag) => (
                        <span key={tag} className="lib-card-tag" style={{ background: "var(--color-bg-muted)", color: "var(--color-text-secondary)" }}>{tag}</span>
                      ))}
                      <span className="lib-card-quality">
                        <span className="lib-card-quality-dot" style={{ background: entry.qualityScore >= 0.8 ? "var(--color-accent-sky)" : entry.qualityScore >= 0.6 ? "var(--color-accent)" : "var(--color-warning-text)" }} />
                        {Math.round(entry.qualityScore * 100)}%
                      </span>
                    </div>
                    <div className="lib-card-actions">
                      <button type="button" className="lib-card-action" onClick={() => handleStartEditing(entry)} disabled={busyDraftId !== null}>Modifier</button>
                      <span className="lib-card-action-separator" />
                      <button type="button" className="lib-card-action" disabled={busyDraftId !== null} onClick={() => void handleCreateDivergentVariant(entry.draftId)}>
                        {busyDraftId === entry.draftId ? "En cours..." : "Variante"}
                      </button>
                      <span className="lib-card-action-separator" />
                      <button type="button" className="lib-card-action" disabled={busyDraftId !== null} onClick={() => { if (schedulingDraftId === entry.draftId) { setSchedulingDraftId(null); setSchedulingDate(""); } else { setSchedulingDraftId(entry.draftId); setSchedulingDate(""); } }}>Planifier</button>
                      <span className="lib-card-action-separator" />
                      {deletingDraftId === entry.draftId ? (
                        <button type="button" className="lib-card-action lib-card-action--danger" disabled={busyDraftId !== null} onClick={() => void handleDeleteEntry(entry.draftId)}>Confirmer ?</button>
                      ) : (
                        <button type="button" className="lib-card-action lib-card-action--danger" disabled={busyDraftId !== null} onClick={() => setDeletingDraftId(entry.draftId)}>Supprimer</button>
                      )}
                    </div>
                    {schedulingDraftId === entry.draftId && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 10px", borderRadius: 10, background: "var(--color-bg-muted)", border: "1px solid var(--color-border)" }}>
                        <input type="date" aria-label="Date de publication" value={schedulingDate} onChange={(e) => setSchedulingDate(e.target.value)} style={{ border: "1px solid var(--color-border-medium)", borderRadius: 8, padding: "5px 10px", background: "var(--color-bg-input)", font: "inherit", color: "inherit", fontSize: "0.88rem" }} />
                        <button type="button" className="lib-card-action" style={{ color: "var(--color-accent)", fontWeight: 700 }} disabled={!schedulingDate || busyDraftId !== null} onClick={() => void handleConfirmSchedule(entry.draftId)}>{busyDraftId === entry.draftId ? "..." : "OK"}</button>
                        <button type="button" className="lib-card-action" onClick={() => { setSchedulingDraftId(null); setSchedulingDate(""); }} disabled={busyDraftId !== null}>Annuler</button>
                      </div>
                    )}
                  </>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {activeTab === "planning" && (
        <>
          <div className="insight-strip">
            <article className="insight-card">
              <span className="status-label">Publications</span>
              <strong>
                {planningLoading
                  ? "..."
                  : `${visibleCalendarItems.length} planifiee${visibleCalendarItems.length > 1 ? "s" : ""}`}
              </strong>
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
                <option value="planned">Planifie</option>
                <option value="ready">Pret</option>
                <option value="published">Publie</option>
                <option value="missed">Manque</option>
              </select>
            </label>
          </div>
          <div className="form-status">{planningStatus}</div>

          {planningLoading ? (
            <div className="list-grid" aria-label="Chargement du planning">
              <article className="list-card skeleton-card" />
              <article className="list-card skeleton-card" />
            </div>
          ) : null}

          <div className="list-grid">
            {visibleCalendarItems.map((item) => (
              <article key={item.id} className="list-card">
                <div className="status-label">
                  {item.pillarLabel} · {formatCalendarStatus(item.status)}
                </div>
                <strong>{item.plannedDate}</strong>
                <p>{item.draftHeadline}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
