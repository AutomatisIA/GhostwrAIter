import { useEffect, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import type { IdeaInput, IdeaRecord, NewsSourceInput } from "@shared/types/ideas";
import {
  AiProgress,
  Button,
  Card,
  EmptyState,
  Field,
  Skeleton,
  useToast
} from "../../../design-system/primitives";
import { useAiProgress } from "../../../feedback/useAiProgress";
import { InfoHint } from "../../../help";
import {
  fadeInUp,
  staggerContainer,
  useMotionVariants
} from "../../../design-system/motion/variants";

const emptyIdea: IdeaInput = {
  title: "",
  angle: "",
  pillarLabel: ""
};

const emptyNewsSource: NewsSourceInput = {
  sourceTitle: "",
  sourceSummary: ""
};

type IdeaSelectorProps = {
  onSelect: (ideaId: string) => void;
};

function describeError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : "";
  return raw ? `${fallback} (${raw})` : fallback;
}

export function IdeaSelector({ onSelect }: IdeaSelectorProps) {
  const toast = useToast();
  const [ideas, setIdeas] = useState<IdeaRecord[]>([]);
  const [form, setForm] = useState<IdeaInput>(emptyIdea);
  const [newsSource, setNewsSource] = useState<NewsSourceInput>(emptyNewsSource);
  const [loading, setLoading] = useState(true);
  const [isCreatingIdea, setIsCreatingIdea] = useState(false);
  const [isCreatingFromNews, setIsCreatingFromNews] = useState(false);
  const [isGeneratingFromStrategy, setIsGeneratingFromStrategy] = useState(false);
  const [query, setQuery] = useState("");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [strategyPillars, setStrategyPillars] = useState<string[]>([]);

  const container = useMotionVariants(staggerContainer);
  const item = useMotionVariants(fadeInUp);

  // Feedback IA continu sur les operations composites longues (feature 010,
  // T032) : « Transformer une veille » (phase `news`) et « Generer des sujets »
  // (phase `idees`). La creation manuelle d'idee (`isCreatingIdea`) est un
  // simple insert SQLite, pas une operation IA : on ne l'inclut pas. Les deux
  // operations IA s'excluent mutuellement, d'ou un pipeline mono-phase derive
  // de la phase active (position honnete 1 / 1). Le ressenti de continuite est
  // porte par les flags locaux (bascule synchrone), pas par le canal qui
  // n'emet la phase qu'au retour de l'appel (spawnSync, research D3). Les toasts
  // existants gardent le resultat terminal : pas de double annonce ici.
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingIdea(true);
    try {
      const created = await window.linkedinPoster.ideas.createIdea(form);
      setForm(emptyIdea);
      await loadIdeas();
      toast.show({ kind: "success", message: "Idée ajoutée au backlog." });
      onSelect(created.id);
    } catch (error) {
      toast.show({
        kind: "error",
        message: describeError(error, "La création de l'idée a échoué. Réessaie.")
      });
    } finally {
      setIsCreatingIdea(false);
    }
  }

  async function handleNewsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingFromNews(true);
    try {
      const result = await window.linkedinPoster.ideas.createFromNewsSource(newsSource);
      setNewsSource(emptyNewsSource);
      await loadIdeas();
      toast.show({ kind: "success", message: "Draft créé depuis la veille." });
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
    const matchesQuery =
      query.trim().length === 0 ||
      `${idea.title} ${idea.angle} ${idea.pillarLabel}`
        .toLowerCase()
        .includes(query.toLowerCase());
    const matchesPillar = pillarFilter === "all" || idea.pillarLabel === pillarFilter;
    return matchesQuery && matchesPillar;
  });

  const pillarOptions = Array.from(new Set(ideas.map((idea) => idea.pillarLabel))).sort();
  const hasIdeas = ideas.length > 0;
  const filteredEmpty = hasIdeas && visibleIdeas.length === 0;

  return (
    <>
      <div className="ideas-modes">
        <Card elevation={2} className="ideas-mode-card" as="article">
          <div className="ideas-mode-icon" aria-hidden="true">
            Idée
          </div>
          <h2>Saisir une idée</h2>
          <p className="ideas-mode-description">
            Quand tu as déjà un sujet en tête. Remplis le titre, l'angle et
            le pilier éditorial pour l'envoyer dans le backlog.
          </p>
          <form className="ideas-mode-form" onSubmit={handleSubmit}>
            <Field
              label="Titre du sujet"
              htmlFor="idea-title"
              hint="Le sujet en une phrase, tel que tu le présenterais à voix haute."
              example="Pourquoi déléguer trop tôt freine la croissance d'une PME."
            >
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </Field>
            <Field
              label="Angle"
              htmlFor="idea-angle"
              hint="Le point de vue ou la promesse : ce qui rend le post différent."
              example="Un retour d'expérience chiffré plutôt qu'un conseil générique."
            >
              <textarea
                rows={3}
                value={form.angle}
                onChange={(event) =>
                  setForm((current) => ({ ...current, angle: event.target.value }))
                }
              />
            </Field>
            <Field
              label="Pilier éditorial"
              htmlFor="idea-pillar"
              hint="Le grand thème auquel rattacher cette idée pour garder une ligne cohérente."
            >
              {strategyPillars.length > 0 ? (
                <select
                  value={form.pillarLabel}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, pillarLabel: event.target.value }))
                  }
                >
                  {strategyPillars.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.pillarLabel}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, pillarLabel: event.target.value }))
                  }
                  placeholder="Aucun pilier défini : remplis la stratégie d'abord"
                />
              )}
            </Field>
            <div className="ideas-mode-actions">
              <Button
                type="submit"
                variant="primary"
                className="full-width"
                loading={isCreatingIdea}
                disabled={isCreatingIdea}
              >
                Ajouter l'idée
              </Button>
            </div>
          </form>
        </Card>

        <Card elevation={2} className="ideas-mode-card" as="article">
          <div className="ideas-mode-icon" aria-hidden="true">
            Veille
          </div>
          <h2>Transformer une veille</h2>
          <p className="ideas-mode-description">
            Quand tu veux réagir à un article externe. Colle le titre et le
            résumé de la source pour obtenir un draft initial.
          </p>
          <form className="ideas-mode-form" onSubmit={handleNewsSubmit}>
            <Field
              label="Titre source"
              htmlFor="news-title"
              hint="Le titre de l'article ou de la publication que tu veux commenter."
            >
              <input
                value={newsSource.sourceTitle}
                onChange={(event) =>
                  setNewsSource((current) => ({ ...current, sourceTitle: event.target.value }))
                }
              />
            </Field>
            <Field
              label="Résumé source"
              htmlFor="news-summary"
              hint="Les points clés de la source, pour que l'IA sache à quoi réagir."
              example="Un rapport annonce que 60% des PME freinent leur adoption de l'IA."
            >
              <textarea
                rows={3}
                value={newsSource.sourceSummary}
                onChange={(event) =>
                  setNewsSource((current) => ({ ...current, sourceSummary: event.target.value }))
                }
              />
            </Field>
            <div className="ideas-mode-actions">
              <Button
                type="submit"
                variant="primary"
                className="full-width"
                loading={isCreatingFromNews}
                disabled={isCreatingFromNews}
              >
                Transformer en draft
              </Button>
            </div>
          </form>
        </Card>

        <Card elevation={2} className="ideas-mode-card" as="article">
          <div className="ideas-mode-icon" aria-hidden="true">
            Stratégie
          </div>
          <h2>Générer depuis la stratégie</h2>
          <p className="ideas-mode-description">
            Quand tu veux que l'app propose des sujets à partir des piliers
            éditoriaux, des ICPs et des offres de ta stratégie active.
          </p>
          <div className="ideas-mode-actions">
            <Button
              variant="primary"
              className="full-width"
              loading={isGeneratingFromStrategy}
              disabled={isGeneratingFromStrategy}
              onClick={handleGenerateFromStrategy}
            >
              Générer des sujets
            </Button>
          </div>
        </Card>
      </div>

      {aiActive ? (
        <AiProgress
          phase={aiProgress.phase}
          intentLabel={aiProgress.intentLabel || "Génération en cours…"}
          elapsedMs={aiProgress.elapsedMs}
          currentIndex={aiProgress.currentIndex}
          totalSteps={aiProgress.totalSteps}
          state={aiProgress.state === "idle" ? "running" : aiProgress.state}
        />
      ) : null}

      {hasIdeas ? (
        <div className="filter-bar">
          <Field label="Filtrer les idées" htmlFor="ideas-query">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Sujet, angle, pilier…"
            />
          </Field>
          <Field
            label="Filtrer par pilier"
            htmlFor="ideas-pillar-filter"
          >
            <select
              value={pillarFilter}
              onChange={(event) => setPillarFilter(event.target.value)}
            >
              <option value="all">Tous les piliers</option>
              {pillarOptions.map((pillar) => (
                <option key={pillar} value={pillar}>
                  {pillar}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      {loading ? (
        <div className="list-grid" aria-label="Chargement des idées" aria-busy="true">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      ) : null}

      {!loading && !hasIdeas ? (
        <Card elevation={1}>
          <EmptyState
            title="Aucune idée pour le moment"
            description="Capture un premier sujet avec l'un des trois modes ci-dessus : saisis une idée, transforme une veille, ou laisse l'app en générer depuis ta stratégie."
          />
        </Card>
      ) : null}

      {filteredEmpty ? (
        <Card elevation={1}>
          <EmptyState
            title="Aucune idée ne correspond au filtre"
            description="Élargis ta recherche ou réinitialise le pilier sélectionné pour revoir toutes tes idées."
            action={{
              label: "Réinitialiser les filtres",
              onClick: () => {
                setQuery("");
                setPillarFilter("all");
              }
            }}
          />
        </Card>
      ) : null}

      {!loading && visibleIdeas.length > 0 ? (
        <motion.div
          className="list-grid"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {visibleIdeas.map((idea) => (
            <motion.div key={idea.id} variants={item}>
              <Card elevation={1} className="idea-backlog-card" as="article">
                <div className="status-label">
                  {idea.pillarLabel} <InfoHint term="pilier" />
                </div>
                <strong>{idea.title}</strong>
                <p>{idea.angle}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="idea-backlog-card-action"
                  onClick={() => onSelect(idea.id)}
                >
                  Sélectionner
                </Button>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      ) : null}
    </>
  );
}
