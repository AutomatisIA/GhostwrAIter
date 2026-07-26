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
 * Rangee « Cible visee ».
 *
 * La doctrine editoriale exige une cible unique par post. Sans ce champ, le
 * moteur recevait TOUTES les cibles de la strategie et ecrivait pour personne :
 * c est le choix qui change le plus la qualite du texte produit.
 *
 * La rangee est partagee par les TROIS portes d entree qui creent des idees :
 * saisie manuelle, transformation de veille, et generation depuis la strategie.
 * La doctrine ne distingue pas selon la provenance du sujet, et la troisieme
 * est la plus critique : c est la seule ou l utilisateur n a aucun moment
 * ulterieur pour designer une cible, donc une idee generee sans cible le
 * resterait pour toujours.
 *
 * Le segment est retenu, jamais l identifiant de la cible : les identifiants
 * sont regeneres a chaque enregistrement de la strategie (cf. `IdeaRecord`).
 *
 * Une liste deroulante, et non les etiquettes du dessin. Le dessin supposait des
 * segments courts, « Dirigeant de PME, 20 a 100 salaries ». Les segments reels
 * sont des phrases de 60 a 95 caracteres qui se ressemblent par leur debut :
 * en etiquettes elles passaient a deux lignes, se posaient une par ligne et
 * faisaient de ce champ le plus gros bloc de l ecran, et les tronquer rendait
 * trois cibles sur quatre indiscernables. Le pilier garde ses etiquettes, sa
 * taxonomie etant courte et fermee. Ce n est pas la meme donnee.
 */
function TargetRow({
  labelId,
  segments,
  value,
  onChange,
  enEchec
}: {
  labelId: string;
  segments: string[];
  value?: string;
  onChange: (segment: string) => void;
  enEchec: boolean;
}) {
  return (
    <div className="create-row">
      <div className="create-label">
        <label htmlFor={labelId}>Cible visée</label>
        <FieldHelp label="Cible visée">
          La doctrine éditoriale exige une cible unique par post. Sans ce choix, le
          modèle reçoit toutes vos cibles et écrit pour personne.
        </FieldHelp>
      </div>
      <div className="create-control">
        {segments.length > 0 ? (
          <>
            <select
              id={labelId}
              className="create-select"
              value={value ?? ""}
              onChange={(event) => onChange(event.target.value)}
            >
              {segments.map((segment) => (
                <option key={segment} value={segment}>
                  {segment}
                </option>
              ))}
            </select>
            <span className="create-field-note">Une seule, jamais toutes</span>
          </>
        ) : enEchec ? (
          /* Une strategie illisible et une strategie vide donnent la meme liste
             vide. Envoyer creer une cible quelqu un qui en a six, parce que la
             base etait verrouillee, le ferait chercher un probleme qui n existe
             pas. */
          <p className="create-field-note">
            La stratégie n&apos;a pas pu être lue. Vos cibles existent peut-être
            déjà : rouvrez l&apos;écran Stratégie pour vérifier.
          </p>
        ) : (
          /* Aucune liste fantome : un menu vide se lirait comme un chargement.
             La phrase nomme l endroit ou creer la premiere cible. */
          <p className="create-field-note">
            Aucune cible définie. Créez-en une dans l&apos;écran Stratégie, onglet
            Cibles.
          </p>
        )}
      </div>
    </div>
  );
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
  // Segments des cibles de la strategie active, et non leurs identifiants :
  // `saveBundle` vide la table `icps` puis la reinsere a chaque enregistrement
  // de la strategie, donc un identifiant retenu ici serait orphelin des la
  // prochaine visite de l ecran Strategie.
  const [strategyTargets, setStrategyTargets] = useState<string[]>([]);
  // Cible du mode « Depuis la strategie ». Etat propre plutot que champ d un
  // formulaire : ce mode n en a pas, il ne porte qu un bouton.
  const [targetIcpSegment, setTargetIcpSegment] = useState<string | undefined>();
  // Distingue « la strategie n a aucune cible » de « la strategie n a pas pu
  // etre lue ». Les deux donnent une liste vide, les deux ne disent pas la
  // meme chose a l utilisateur.
  const [strategieEnEchec, setStrategieEnEchec] = useState(false);

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

  /**
   * Recharge le backlog apres une creation.
   *
   * Elle absorbe son propre echec, et c est le geste central de cette fonction.
   * Elle etait appelee DANS le `try` qui decide du verdict de la creation : une
   * idee pourtant enregistree se voyait alors annoncer « La création de l'idée a
   * échoué. Réessaie. », `createIdea` rendait `null`, et l atelier ne s ouvrait
   * pas. Le geste suivant est de reessayer, ce qui cree un doublon.
   *
   * Un rafraichissement rate n est pas une creation ratee. Il se dit quand meme,
   * mais sous son vrai nom : la liste affichee est perimee, et rien d autre a
   * l ecran ne le signalerait.
   */
  async function loadIdeas() {
    try {
      setIdeas(await window.linkedinPoster.ideas.listIdeas());
    } catch (error) {
      toast.show({
        kind: "error",
        message: describeError(error, "La liste des idées n'a pas pu être rafraîchie.")
      });
    }
  }

  useEffect(() => {
    Promise.all([
      window.linkedinPoster.ideas.listIdeas(),
      // L echec de chargement est CONSERVE, jamais replie sur `null`. Le
      // repliait sur `null` faisait dire aux trois onglets « Aucune cible
      // definie, creez-en une dans l ecran Strategie » a un utilisateur qui en
      // a six : une base verrouillee ou une erreur IPC l envoyait creer ce
      // qu il possede deja. Un ecran vide et un ecran en panne ne disent pas la
      // meme chose.
      window.linkedinPoster.strategy
        .getActiveBundle()
        .then((valeur) => ({ ok: true as const, valeur }))
        .catch(() => ({ ok: false as const, valeur: null }))
    ])
      .then(([loadedIdeas, resultatStrategie]) => {
        setIdeas(loadedIdeas);
        setStrategieEnEchec(!resultatStrategie.ok);
        const bundle = resultatStrategie.valeur;
        if (bundle) {
          const labels = bundle.pillars.map((p) => p.label).filter(Boolean);
          setStrategyPillars(labels);
          if (labels.length > 0) {
            setForm((current) =>
              current.pillarLabel ? current : { ...current, pillarLabel: labels[0] ?? "" }
            );
          }

          const segments = bundle.icps.map((icp) => icp.segment).filter(Boolean);
          setStrategyTargets(segments);
          if (segments.length > 0) {
            setForm((current) =>
              current.targetIcpSegment
                ? current
                : { ...current, targetIcpSegment: segments[0] }
            );
            setNewsSource((current) =>
              current.targetIcpSegment
                ? current
                : { ...current, targetIcpSegment: segments[0] }
            );
            setTargetIcpSegment((current) => current ?? segments[0]);
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
      // Le pilier et la cible survivent a la creation : on enchaine en general
      // plusieurs idees dans le meme cadrage, et les redemander a chaque fois
      // ferait repartir le formulaire d un cran en arriere.
      setForm((current) => ({
        ...emptyIdea,
        pillarLabel: current.pillarLabel,
        targetIcpSegment: current.targetIcpSegment
      }));
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
      const result = await window.linkedinPoster.ideas.createFromNewsSource(
        newsSource
      );
      // La cible survit a la creation, comme sur la saisie manuelle : on
      // enchaine plusieurs veilles pour le meme public.
      setNewsSource((current) => ({
        ...emptyNewsSource,
        targetIcpSegment: current.targetIcpSegment
      }));
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
      // La cible part au generateur ET se pose sur chaque idee produite. C est
      // la seule porte d entree ou l utilisateur n aura plus aucun moment pour
      // la designer : une idee generee sans cible le resterait pour toujours.
      await window.linkedinPoster.ideas.generateFromStrategy(targetIcpSegment ? { targetIcpSegment } : undefined);
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

              <TargetRow
                labelId="idea-target-label"
                segments={strategyTargets}
                value={form.targetIcpSegment}
                onChange={(segment) =>
                  setForm((current) => ({ ...current, targetIcpSegment: segment }))
                }
                enEchec={strategieEnEchec}
              />
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

              <TargetRow
                labelId="news-target-label"
                segments={strategyTargets}
                value={newsSource.targetIcpSegment}
                onChange={(segment) =>
                  setNewsSource((current) => ({ ...current, targetIcpSegment: segment }))
                }
                enEchec={strategieEnEchec}
              />
            </form>
          ) : null}

          {mode === "strategy" ? (
            <>
              {/* La phrase n est pas une aide posee a cote d une saisie, c est
                  le contenu du panneau. */}
              <p className="create-strategy-note">
                L&apos;application propose des sujets à partir de vos piliers éditoriaux,
                de la cible choisie ci-dessous et de vos offres, et les dépose dans le
                backlog. Si votre stratégie est vide, remplissez-la d&apos;abord, la
                génération n&apos;aurait rien sur quoi s&apos;appuyer.
              </p>
              <TargetRow
                labelId="strategy-target-label"
                segments={strategyTargets}
                value={targetIcpSegment}
                onChange={setTargetIcpSegment}
                enEchec={strategieEnEchec}
              />
            </>
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
