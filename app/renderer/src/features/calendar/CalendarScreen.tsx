import { useEffect, useState, type FormEvent } from "react";
import type { CalendarItem } from "@shared/types/calendar";
import type { LibraryEntry } from "@shared/types/library";

export function CalendarScreen() {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [form, setForm] = useState({
    draftId: "",
    plannedDate: ""
  });
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
    loadAll().catch(() => {
      setStatus("Impossible de charger le calendrier.");
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await window.linkedinPoster.calendar.scheduleDraft({
      draftId: form.draftId,
      plannedDate: form.plannedDate,
      status: "planned"
    });
    setForm({ draftId: "", plannedDate: "" });
    await loadAll();
    setStatus("Draft planifie.");
  }

  return (
    <section className="panel page-panel">
      <div className="eyebrow">Planification</div>
      <h1>Calendrier editorial</h1>
      <p>Planifie les drafts valides pour leur donner une cadence de publication simple et visible.</p>

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
          <button type="submit" className="primary-button">
            Planifier le draft
          </button>
          <span className="form-status">{status}</span>
        </div>
      </form>

      <div className="list-grid">
        {items.map((item) => (
          <article key={item.id} className="list-card">
            <strong>{item.plannedDate}</strong>
            <p>{item.draftId}</p>
            <div className="status-label">{item.status}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
