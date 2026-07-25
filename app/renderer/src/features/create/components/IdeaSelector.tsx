import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { IdeaInput, IdeaRecord, NewsSourceInput } from "@shared/types/ideas";
import {
  Button,
  EmptyState,
  Skeleton,
  Tabs,
  Tooltip,
  useToast
} from "../../../design-system/primitives";
import { useAiProgress } from "../../../feedback/useAiProgress";
import { InfoHint } from "../../../help";
import { GenerationPulse } from "../../workshop/components/GenerationPulse";
import { useEngineSignal } from "../useGenerationTelemetry";

const emptyIdea: IdeaInput = {
  title: "",
  angle: "",
  pillarLabel: ""
};

const emptyNewsSource: NewsSourceInput = {
  sourceTitle: "",
  sourceSummary: ""
};

type CreateMode = "idea" | "news" | "strategy";

const MODES: { key: CreateMode; label: string }[] = [
  { key: "idea", label: "Saisir une idée" },
  { key: "news", label: "Transformer une veille" },
  { key: "strategy", label: "Depuis la stratégie" }
];

type IdeaSelectorProps = {
  onSelect: (ideaId: string) => void;
};

function describeError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : "";
  return raw ? `${fallback} (${raw})` : fallback;
}

/**
 * Aide de champ.
 *
 * Deux motifs d aide coexistaient sur cet ecran : « Titre du sujet » et
 * « Angle » posaient leur phrase d aide dans le flux, sous le champ, en
 * permanence, pendant que « Pilier editorial » la cachait derriere un point
 * d interrogation. Une phrase lue une fois qui reste ensuite affichee pour
 * toujours occupe la place du champ suivant sans plus rien apprendre.
 *
 * Le motif est donc unique : libelle, bouton d aide, champ. Rien dans le flux
 * tant que l aide n est pas demandee.
 *
 * `InfoHint` ne convient que pour un terme du glossaire, et « Titre du sujet »
 * n est pas du jargon a definir mais un champ a renseigner. Ce composant reprend
 * donc la meme forme et le meme geste (`Tooltip`, survol et focus clavier,
 * `aria-describedby`, fermeture par Echap) avec la classe `ds-info-hint`, pour
 * que les deux aides restent indiscernables a l oeil et a l usage. Le nom
 * accessible reprend celui d `InfoHint` : « Aide : <libelle du champ> ».
 */
function FieldHelp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip content={children}>
      <button type="button" className="ds-info-hint" aria-label={`Aide : ${label}`}>
        <span aria-hidden="true">?</span>
      </button>
    </Tooltip>
  );
}

const DAY_MONTH_FR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

/**
 * Ligne de provenance d une idee sans titre.
 *
 * La generation depuis la strategie et la transformation de veille produisent
 * des idees dont le titre peut rester vide : la ligne du backlog n affichait
 * alors que son pilier, « Veille » ou « General », soit une ligne cliquable
 * sans contenu lisible. Le repli nomme ce qui manque et date la provenance,
 * ce qui suffit a decider d ouvrir la ligne ou de la laisser.
 */
function describeProvenance(idea: IdeaRecord): string {
  const source = idea.pillarLabel.trim() || "Idée";
  const created = new Date(idea.createdAt);
  if (Number.isNaN(created.getTime())) return `${source}, à nommer`;
  return `${source} du ${DAY_MONTH_FR.format(created)}, à nommer`;
}

/**
 * Ecran « Creer ».
 *
 * Trois portes d entree occupaient auparavant trois colonnes egales, dont la
 * troisieme ne portait qu un bouton, et le backlog des idees se trouvait
 * repousse sous le pli. Les trois modes sont devenus trois onglets d une meme
 * carte de 700 px, et la colonne recuperee sert la liste des idees en attente,
 * qui est la raison pour laquelle on revient sur cet ecran.
 *
 * La carte s arrete a la hauteur de son contenu : la barre d action suit le
 * dernier champ au lieu d etre plaquee au bas d une carte pleine hauteur, qui
 * laissait quatre cents pixels de vide entre les deux. Quand le contenu depasse
 * la fenetre, la carte se borne et c est son corps qui defile, l action primaire
 * restant visible.
 */
export function IdeaSelector({ onSelect }: IdeaSelectorProps) {
  const toast = useToast();
  const [mode, setMode] = useState<CreateMode>("idea");
  const [ideas, setIdeas] = useState<IdeaRecord[]>([]);
  const [form, setForm] = useState<IdeaInput>(emptyIdea);
  const [newsSource, setNewsSource] = useState<NewsSourceInput>(emptyNewsSource);
  const [loading, setLoading] = useState(true);
  const [isCreatingIdea, setIsCreatingIdea] = useState(false);
  const [isCreatingFromNews, setIsCreatingFromNews] = useState(false);
  const [isGeneratingFromStrategy, setIsGeneratingFromStrategy] = useState(false);
  const [query, setQuery] = useState("");
  const [strategyPillars, setStrategyPillars] = useState<string[]>([]);

  // Feedback IA continu sur les operations composites longues (feature 010,
  // T032) : « Transformer une veille » (phase `news`) et « Generer des sujets »
  // (phase `idees`). La creation manuelle d'idee (`isCreatingIdea`) est un
  // simple insert SQLite, pas une operation IA : on ne l'inclut pas. Les deux
  // operations IA s'excluent mutuellement, d'ou un pipeline mono-phase derive
  // de la phase active. Les toasts existants gardent le resultat terminal :
  // pas de double annonce ici.
  const aiActive = isCreatingFromNews || isGeneratingFromStrategy;
  const aiActivePhase = isCreatingFromNews
    ? "news"
    : isGeneratingFromStrategy
      ? "idees"
      : null;
  const aiProgress = useAiProgress({
    active: aiActive,
    activePhase: aiActivePhase,
    pipeline: aiActivePhase ? [aiActivePhase] : undefined
  });
  const engineSignal = useEngineSignal(aiActive);

  async function loadIdeas() {
    const result = await window.linkedinPoster.ideas.listIdeas();
    setIdeas(result);
  }

  useEffect(() => {
    Promise.all([
      window.linkedinPoster.ideas.listIdeas(),
      window.linkedinPoster.strategy.getActiveBundle().catch(() => null)
    ])
      .then(([loadedIdeas, bundle]) => {
        setIdeas(loadedIdeas);
        if (bundle) {
          const labels = bundle.pillars.map((p) => p.label).filter(Boolean);
          setStrategyPillars(labels);
          if (labels.length > 0) {
            setForm((current) =>
              current.pillarLabel ? current : { ...current, pillarLabel: labels[0] ?? "" }
            );
          }
        }
      })
      .catch((error) => {
        toast.show({
          kind: "error",
          message: describeError(error, "Impossible de charger les idées.")
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [toast]);

  async function createIdea(): Promise<IdeaRecord | null> {
    setIsCreatingIdea(true);
    try {
      const created = await window.linkedinPoster.ideas.createIdea(form);
      setForm((current) => ({ ...emptyIdea, pillarLabel: current.pillarLabel }));
      await loadIdeas();
      return created;
    } catch (error) {
      toast.show({
        kind: "error",
        message: describeError(error, "La création de l'idée a échoué. Réessaie.")
      });
      return null;
    } finally {
      setIsCreatingIdea(false);
    }
  }

  async function handleOpenInWorkshop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await createIdea();
    if (created) onSelect(created.id);
  }

  async function handleAddToBacklog() {
    const created = await createIdea();
    if (created) toast.show({ kind: "success", message: "Idée ajoutée au backlog." });
  }

  async function handleNewsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingFromNews(true);
    try {
      const result = await window.linkedinPoster.ideas.createFromNewsSource(newsSource);
      setNewsSource(emptyNewsSource);
      await loadIdeas();
      toast.show({ kind: "success", message: "Brouillon créé depuis la veille." });
      onSelect(result.idea.id);
    } catch (error) {
      toast.show({
        kind: "error",
        message: describeError(error, "La transformation de la veille a échoué. Réessaie.")
      });
    } finally {
      setIsCreatingFromNews(false);
    }
  }

  async function handleGenerateFromStrategy() {
    setIsGeneratingFromStrategy(true);
    try {
      await window.linkedinPoster.ideas.generateFromStrategy();
      await loadIdeas();
      toast.show({ kind: "success", message: "Sujets générés depuis la stratégie." });
    } catch (error) {
      toast.show({
        kind: "error",
        message: describeError(
          error,
          "La génération depuis la stratégie a échoué. Vérifie que ta stratégie est définie."
        )
      });
    } finally {
      setIsGeneratingFromStrategy(false);
    }
  }

  const visibleIdeas = ideas.filter((idea) => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return true;
    return `${idea.title} ${idea.angle} ${idea.pillarLabel}`.toLowerCase().includes(needle);
  });

  const hasIdeas = ideas.length > 0;
  const filteredEmpty = hasIdeas && visibleIdeas.length === 0;
  const ideaComplete =
    form.title.trim().length > 0 &&
    form.angle.trim().length > 0 &&
    form.pillarLabel.trim().length > 0;
  const newsComplete =
    newsSource.sourceTitle.trim().length > 0 && newsSource.sourceSummary.trim().length > 0;

  const pulsePhaseLabel = isCreatingFromNews
    ? "Transformation de la veille"
    : "Génération des sujets";

  return (
    <div className="create-screen">
      <section className="create-card">
        <Tabs
          items={MODES.map((item) => ({ value: item.key, label: item.label }))}
          value={mode}
          onChange={(value) => setMode(value as CreateMode)}
          aria-label="Modes de création"
        />

        <div
          className="create-card__body"
          role="tabpanel"
          id="create-panel"
          aria-labelledby={`tab-${mode}`}
        >
          {aiActive ? (
            <GenerationPulse
              phaseLabel={pulsePhaseLabel}
              elapsedMs={aiProgress.elapsedMs}
              signal={engineSignal}
            />
          ) : null}

          {mode === "idea" ? (
            <form id="create-idea-form" className="create-form" onSubmit={handleOpenInWorkshop}>
              <div className="create-row">
                <div className="create-label">
                  <label htmlFor="idea-title">Titre du sujet</label>
                  <FieldHelp label="Titre du sujet">
                    Le sujet en une phrase, tel que vous le présenteriez à voix haute.
                  </FieldHelp>
                </div>
                <div className="create-control">
                  <input
                    id="idea-title"
                    className="create-input"
                    value={form.title}
                    placeholder="Pourquoi déléguer trop tôt freine la croissance d'une PME"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="create-row create-row--top">
                <div className="create-label">
                  <label htmlFor="idea-angle">Angle</label>
                  <FieldHelp label="Angle">
                    Le point de vue ou la promesse : ce qui rend le post différent d&apos;un
                    autre sur le même sujet.
                  </FieldHelp>
                </div>
                <div className="create-control">
                  <textarea
                    id="idea-angle"
                    className="create-textarea"
                    rows={3}
                    value={form.angle}
                    placeholder="Un retour d'expérience chiffré plutôt qu'un conseil générique"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, angle: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="create-row create-row--top">
                <div className="create-label">
                  <span id="idea-pillar-label">Pilier éditorial</span>
                  <InfoHint term="pilier" />
                </div>
                <div className="create-control">
                  {strategyPillars.length > 0 ? (
                    <div
                      className="create-chips"
                      role="group"
                      aria-labelledby="idea-pillar-label"
                    >
                      {strategyPillars.map((label) => {
                        const selected = form.pillarLabel === label;
                        return (
                          <button
                            key={label}
                            type="button"
                            className="create-chip"
                            aria-pressed={selected}
                            onClick={() =>
                              setForm((current) => ({ ...current, pillarLabel: label }))
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      id="idea-pillar"
                      className="create-input"
                      aria-labelledby="idea-pillar-label"
                      value={form.pillarLabel}
                      placeholder="Aucun pilier défini : remplissez la stratégie d'abord"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, pillarLabel: event.target.value }))
                      }
                    />
                  )}
                </div>
              </div>
            </form>
          ) : null}

          {mode === "news" ? (
            <form id="create-news-form" className="create-form" onSubmit={handleNewsSubmit}>
              <div className="create-row">
                <div className="create-label">
                  <label htmlFor="news-title">Titre source</label>
                  <FieldHelp label="Titre source">
                    Le titre de l&apos;article ou de la publication à laquelle vous réagissez.
                  </FieldHelp>
                </div>
                <div className="create-control">
                  <input
                    id="news-title"
                    className="create-input"
                    value={newsSource.sourceTitle}
                    placeholder="Le titre de l'article que vous commentez"
                    onChange={(event) =>
                      setNewsSource((current) => ({
                        ...current,
                        sourceTitle: event.target.value
                      }))
                    }
                  />
                </div>
              </div>

              <div className="create-row create-row--top">
                <div className="create-label">
                  <label htmlFor="news-summary">Résumé source</label>
                  <FieldHelp label="Résumé source">
                    Les points clés de la source, pour que le moteur sache à quoi réagir.
                  </FieldHelp>
                </div>
                <div className="create-control">
                  <textarea
                    id="news-summary"
                    className="create-textarea"
                    rows={4}
                    value={newsSource.sourceSummary}
                    placeholder="Un rapport annonce que 60 % des PME freinent leur adoption de l'IA"
                    onChange={(event) =>
                      setNewsSource((current) => ({
                        ...current,
                        sourceSummary: event.target.value
                      }))
                    }
                  />
                </div>
              </div>
            </form>
          ) : null}

          {/* Seul mode sans champ : la phrase n est pas une aide posee a cote
              d une saisie, c est le contenu du panneau. */}
          {mode === "strategy" ? (
            <p className="create-strategy-note">
              L&apos;application propose des sujets à partir de vos piliers éditoriaux, de vos
              clients visés et de vos offres, et les dépose dans le backlog. Rien à saisir
              ici : si votre stratégie est vide, remplissez-la d&apos;abord, la génération
              n&apos;aurait rien sur quoi s&apos;appuyer.
            </p>
          ) : null}
        </div>

        <div className="create-actions">
          {mode === "idea" ? (
            <>
              <Button
                type="submit"
                form="create-idea-form"
                variant="primary"
                size="lg"
                loading={isCreatingIdea}
                disabled={!ideaComplete || isCreatingIdea}
              >
                Ouvrir dans l&apos;atelier
              </Button>
              <Button
                variant="secondary"
                onClick={handleAddToBacklog}
                disabled={!ideaComplete || isCreatingIdea}
              >
                Ajouter au backlog
              </Button>
            </>
          ) : null}

          {mode === "news" ? (
            <Button
              type="submit"
              form="create-news-form"
              variant="primary"
              size="lg"
              loading={isCreatingFromNews}
              disabled={!newsComplete || isCreatingFromNews}
            >
              Transformer en brouillon
            </Button>
          ) : null}

          {mode === "strategy" ? (
            <Button
              variant="primary"
              size="lg"
              loading={isGeneratingFromStrategy}
              disabled={isGeneratingFromStrategy}
              onClick={handleGenerateFromStrategy}
            >
              Générer des sujets
            </Button>
          ) : null}
        </div>
      </section>

      <section className="create-backlog">
        <div className="create-backlog__head">
          <span className="eyebrow">Idées en attente</span>
          <span className="create-backlog__count tabular">{visibleIdeas.length}</span>
        </div>

        {hasIdeas ? (
          <input
            className="create-backlog__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrer par sujet, angle ou pilier"
            aria-label="Filtrer les idées en attente"
          />
        ) : null}

        {loading ? (
          <div className="create-backlog__list" aria-label="Chargement des idées" aria-busy="true">
            <Skeleton variant="text" />
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </div>
        ) : null}

        {!loading && !hasIdeas ? (
          <div className="create-backlog__list">
            <EmptyState
              title="Aucune idée pour le moment"
              description="Capturez un premier sujet avec l'un des trois modes à gauche : saisissez une idée, transformez une veille, ou laissez l'application en générer depuis votre stratégie."
            />
          </div>
        ) : null}

        {filteredEmpty ? (
          <div className="create-backlog__list">
            <EmptyState
              title="Aucune idée ne correspond au filtre"
              description="Élargissez votre recherche pour revoir toutes vos idées."
              action={{ label: "Effacer le filtre", onClick: () => setQuery("") }}
            />
          </div>
        ) : null}

        {!loading && visibleIdeas.length > 0 ? (
          <ul className="create-backlog__list">
            {visibleIdeas.map((idea) => {
              const title = idea.title.trim();
              return (
                <li key={idea.id}>
                  <button
                    type="button"
                    className="create-backlog__row"
                    onClick={() => onSelect(idea.id)}
                  >
                    <span
                      className={
                        title
                          ? "create-backlog__title"
                          : "create-backlog__title create-backlog__title--untitled"
                      }
                    >
                      {title || "Idée sans titre"}
                    </span>
                    <span className="create-backlog__pillar">
                      {title ? idea.pillarLabel : describeProvenance(idea)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
