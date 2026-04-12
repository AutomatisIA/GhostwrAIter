import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import type { CalendarItem } from "@shared/types/calendar";
import type { LibraryEntry } from "@shared/types/library";

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

export function CalendarScreen() {
  const [searchParams] = useSearchParams();
  const draftIdFromUrl = searchParams.get("draftId");

  const [items, setItems] = useState<CalendarItem[]>([]);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [form, setForm] = useState({
    draftId: draftIdFromUrl || "",
    plannedDate: ""
  });
  const [statusFilter, setStatusFilter] = useState<CalendarItem["status"] | "all">("all");
  const [loading, setLoading] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);
  const [previousDraftIdFromUrl, setPreviousDraftIdFromUrl] = useState(draftIdFromUrl);

  // Sync the draftId form field with the URL query parameter via the
  // "deriving state from props" pattern documented in React docs:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // This avoids the deprecated useEffect+setState pattern flagged by
  // eslint-plugin-react-hooks 7.x set-state-in-effect rule.
  if (draftIdFromUrl !== previousDraftIdFromUrl) {
    setPreviousDraftIdFromUrl(draftIdFromUrl);
    if (draftIdFromUrl) {
      setForm((f) => ({ ...f, draftId: draftIdFromUrl }));
    }
  }
  const [status, setStatus] = useState("Chargement du calendrier...");

  async function loadAll() {
    const [loadedItems, loadedEntries] = await Promise.all([
      window.linkedinPoster.calendar.listItems(),
      window.linkedinPoster.library.listEntries()
    ]);

    setItems(loadedItems);
    setEntries(loadedEntries);
    setStatus(loadedItems.length > 0 ? "Calendrier charge." : "Aucune publication planifiee.");
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [loadedItems, loadedEntries] = await Promise.all([
          window.linkedinPoster.calendar.listItems(),
          window.linkedinPoster.library.listEntries()
        ]);
        if (cancelled) return;
        setItems(loadedItems);
        setEntries(loadedEntries);
        setStatus(
          loadedItems.length > 0 ? "Calendrier charge." : "Aucune publication planifiee."
        );
      } catch {
        if (cancelled) return;
        setStatus("Impossible de charger le calendrier.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsScheduling(true);
    setStatus("Planification en cours...");
    await window.linkedinPoster.calendar.scheduleDraft({
      draftId: form.draftId,
      plannedDate: form.plannedDate,
      status: "planned"
    });
    setForm({ draftId: "", plannedDate: "" });
    await loadAll();
    setStatus("Draft planifie.");
    setIsScheduling(false);
  }

  const visibleItems = useMemo(
    () => items.filter((item) => statusFilter === "all" || item.status === statusFilter),
    [items, statusFilter]
  );

  return (
    <section className="panel page-panel">
      <h1>Calendrier editorial</h1>

      <div className="insight-strip">
        <article className="insight-card">
          <span className="status-label">A venir</span>
          <strong>
            {loading
              ? "..."
              : `${visibleItems.length} publication${visibleItems.length > 1 ? "s" : ""}`}
          </strong>
        </article>
        <article className="insight-card">
          <span className="status-label">Drafts disponibles</span>
          <strong>{loading ? "..." : entries.length}</strong>
        </article>
      </div>

      <div className="filter-bar">
        <label className="field compact-field">
          <span>Filtrer par statut</span>
          <select
            aria-label="Filtrer par statut"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as CalendarItem["status"] | "all")
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

      <form className="strategy-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Draft a planifier</span>
          <select
            aria-label="Draft a planifier"
            value={form.draftId}
            onChange={(event) => setForm((current) => ({ ...current, draftId: event.target.value }))}
          >
            <option value="">Selectionner un draft</option>
            {entries.map((entry) => (
              <option key={entry.draftId} value={entry.draftId}>
                {entry.headline}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Date prevue</span>
          <input
            aria-label="Date prevue"
            type="date"
            value={form.plannedDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, plannedDate: event.target.value }))
            }
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={isScheduling}>
            Planifier le draft
          </button>
          <span className="form-status">{status}</span>
        </div>
      </form>

      {loading ? (
        <div className="list-grid" aria-label="Chargement du calendrier">
          <article className="list-card skeleton-card" />
          <article className="list-card skeleton-card" />
        </div>
      ) : null}

      <div className="list-grid">
        {visibleItems.map((item) => (
          <article key={item.id} className="list-card">
            <div className="status-label">
              {item.pillarLabel} · {formatCalendarStatus(item.status)}
            </div>
            <strong>{item.plannedDate}</strong>
            <p>{item.draftHeadline}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
