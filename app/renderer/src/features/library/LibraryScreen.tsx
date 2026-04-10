import { useEffect, useState } from "react";
import type { LibraryEntry } from "@shared/types/library";

export function LibraryScreen() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Chargement de la bibliotheque...");

  useEffect(() => {
    window.linkedinPoster.library
      .listEntries()
      .then((result) => {
        setEntries(result);
        setStatus(result.length > 0 ? "Bibliotheque chargee." : "Aucun draft capitalise pour le moment.");
      })
      .catch(() => {
        setStatus("Impossible de charger la bibliotheque.");
      });
  }, []);

  async function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    const result = await window.linkedinPoster.library.searchEntries({ query: nextQuery });
    setEntries(result);
    setStatus(result.length > 0 ? "Resultats filtres localement." : "Aucun draft ne correspond aux filtres.");
  }

  async function handleCreateVariant(draftId: string) {
    await window.linkedinPoster.library.createVariantFromDraft(draftId);
    const refreshed = await window.linkedinPoster.library.listEntries();
    setEntries(refreshed);
    setStatus("Variante creee et capitalisee.");
  }

  return (
    <section className="panel page-panel">
      <div className="eyebrow">Capitalisation</div>
      <h1>Bibliotheque locale</h1>
      <p>Retrouve les drafts deja produits pour les reutiliser, les comparer et les planifier.</p>
      <label className="field">
        <span>Recherche</span>
        <input value={query} onChange={(event) => void handleSearch(event.target.value)} />
      </label>
      <div className="form-status">{status}</div>

      <div className="list-grid">
        {entries.map((entry) => (
          <article key={entry.draftId} className="list-card">
            <div className="status-label">
              {entry.pillarLabel} · {entry.status}
            </div>
            <strong>{entry.headline}</strong>
            <p>{entry.bodyPreview}</p>
            <p>{entry.tags.join(", ")}</p>
            <div className="quality-row">
              <span>Qualite</span>
              <strong>{Math.round(entry.qualityScore * 100)}%</strong>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleCreateVariant(entry.draftId)}
            >
              Creer une variante
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
