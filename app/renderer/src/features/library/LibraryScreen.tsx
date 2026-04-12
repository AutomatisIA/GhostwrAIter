import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LibraryEntry } from "@shared/types/library";

function formatLibraryStatus(status: LibraryEntry["status"]) {
  if (status === "scheduled") {
    return "Planifie";
  }

  if (status === "variant") {
    return "Variante";
  }

  return "Draft";
}

export function LibraryScreen() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LibraryEntry["status"] | "all">("all");
  const [status, setStatus] = useState("Chargement de la bibliotheque...");
  const [loading, setLoading] = useState(true);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editHeadline, setEditHeadline] = useState("");
  const [editBody, setEditBody] = useState("");

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
  }, []);

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

  const visibleEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
        return matchesStatus;
      }),
    [entries, statusFilter]
  );

  return (
    <section className="panel page-panel">
      <div className="eyebrow">Capitalisation</div>
      <h1>Bibliotheque locale</h1>
      <p>
        Retrouve ici les drafts deja produits pour les comparer, les modifier,
        les transformer en variantes divergentes et les envoyer au calendrier.
      </p>

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
          <article key={entry.draftId} className="list-card">
            <div className="status-label">
              {entry.pillarLabel} · {formatLibraryStatus(entry.status)}
            </div>

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
                <div className="form-actions" style={{ marginTop: "0.75rem" }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleSaveEditing(entry.draftId)}
                    disabled={busyDraftId !== null || !editHeadline.trim() || !editBody.trim()}
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleCancelEditing}
                    disabled={busyDraftId !== null}
                  >
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <>
                <strong>{entry.headline}</strong>
                <p>{entry.bodyPreview}</p>
                <p>{entry.tags.join(", ")}</p>
                <div className="quality-row">
                  <span>Qualite</span>
                  <strong>{Math.round(entry.qualityScore * 100)}%</strong>
                </div>
                <div className="form-actions" style={{ marginTop: "1rem" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleStartEditing(entry)}
                    disabled={busyDraftId !== null}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busyDraftId !== null}
                    onClick={() => void handleCreateDivergentVariant(entry.draftId)}
                  >
                    {busyDraftId === entry.draftId
                      ? "Generation en cours..."
                      : "Variante divergente"}
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busyDraftId !== null}
                    onClick={() => navigate(`/calendrier?draftId=${entry.draftId}`)}
                  >
                    Planifier
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
