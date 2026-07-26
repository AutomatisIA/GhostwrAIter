import type { WebContents } from "electron";
import Database from "better-sqlite3";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import {
  emitPhaseSettled,
  emitPhaseStarted
} from "../domains/execution/execution-progress-emitter";
import { SkillRunError } from "../domains/execution/skill-run-error";
import { createStrategyTables, StrategyRepository } from "../domains/strategy/strategy.repository";
import { selectIcps } from "../domains/strategy/strategy-context";
import { createIdeasTables, IdeasRepository } from "../domains/ideas/ideas.repository";
import { NewsToPostService } from "../domains/news/news-to-post.service";
import {
  emptyInputSchema,
  generateFromStrategySchema,
  ideaInputSchema,
  newsSourceInputSchema,
  type GenerateFromStrategyInput,
  type IdeaInput,
  type NewsSourceInput
} from "../../shared/schemas/ideas";
import {
  registerValidatedHandler,
  type IpcRegistrar
} from "./register-validated-handler";

export class IdeasService {
  private readonly repository: IdeasRepository;
  private readonly newsToPostService: NewsToPostService;
  private readonly strategyRepository: StrategyRepository;
  private readonly skillRunnerService: SkillRunnerService;

  constructor(db: Database.Database, skillRunnerService?: SkillRunnerService, getFoundationSummary?: () => string | null) {
    createIdeasTables(db);
    createStrategyTables(db);
    this.repository = new IdeasRepository(db);
    this.skillRunnerService = skillRunnerService ?? new SkillRunnerService();
    this.newsToPostService = new NewsToPostService(
      db,
      this.repository,
      this.skillRunnerService,
      () => this.strategyRepository.getActiveStrategyBundle(),
      getFoundationSummary
    );
    this.strategyRepository = new StrategyRepository(db);
  }

  listIdeas() {
    return this.repository.listIdeas();
  }

  createIdea(input: IdeaInput) {
    return this.repository.createIdea(input);
  }

  createFromNewsSource(input: NewsSourceInput, sender?: WebContents) {
    return this.newsToPostService.createDraftFromSource(input, sender);
  }

  /**
   * Genere des sujets a partir de la strategie.
   *
   * `targetIcpSegment` agit a deux endroits, et les deux comptent. Le
   * generateur ne recoit que la cible demandee, donc il propose des sujets qui
   * parlent a quelqu un plutot que la moyenne de toutes les cibles ; et chaque
   * idee creee la porte, donc le post redige plus tard depuis cette idee vise
   * la meme personne. Sans le second, le choix serait perdu des la fin de la
   * generation : cette porte d entree est la seule ou l utilisateur n a aucun
   * moment ulterieur pour designer une cible.
   */
  async generateFromStrategy(input?: GenerateFromStrategyInput, sender?: WebContents) {
    const bundle = this.strategyRepository.getActiveStrategyBundle();
    const targetIcpSegment = input?.targetIcpSegment;
    // Meme regle que pour la redaction, et le MEME code : la selection vit dans
    // `strategy-context.ts`. Elle y etait recopiee, ce qui aurait laisse le
    // generateur de sujets en arriere a la premiere correction.
    const icps = selectIcps(bundle, targetIcpSegment);
    // Validation fail-fast : on refuse de lancer l'IA (et donc d'émettre un
    // évènement `started` sur le canal de progression) si la stratégie n'a
    // aucun pilier. Placée AVANT toute émission, cette garde évite un faux
    // signal de succès sur le canal de progression.
    if (bundle.pillars.length === 0) {
      throw new Error("Strategy must define at least one pillar before generating ideas.");
    }
    const runId = `run_${Date.now()}`;
    // Meme correction que sur le socle editorial : le moteur annonce vient de
    // la preference, pas d un litteral. Un utilisateur ayant choisi Antigravity
    // voyait « Codex » pendant la generation de ses sujets.
    const announced = this.skillRunnerService.getSelectedEngineName?.() ?? "codex";
    emitPhaseStarted(sender, { runId, phase: "idees", engine: announced });
    let result;
    try {
      result = await this.skillRunnerService.executeAsync({
        runId,
        skillName: "linkedin-topic-generator",
        skillVersion: "1.0.0",
        context: {},
        payload: {
          profileName: bundle.profile.name,
          positioning: bundle.profile.positioning,
          pillars: bundle.pillars,
          icps,
          offers: bundle.offers
        },
        attachments: []
      });
    } catch (err) {
      emitPhaseSettled(sender, {
        runId,
        phase: "idees",
        engine: announced,
        status: "failed",
        // Un `errorCode` absent disparait de l evenement (l emetteur omet la
        // cle) alors que le contrat le veut present sur tout `failed`, et
        // `err.name` vaut « Error » sur une erreur nue, ce qui n appartient a
        // aucune taxonomie. Meme repli que `runPhase`.
        errorCode: err instanceof SkillRunError ? err.code : "SKILL_RUN_FAILED"
      });
      throw err;
    }

    const usedEngine = result.engine ?? announced;

    if (result.status !== "succeeded" || !result.artifacts?.[0]?.content) {
      emitPhaseSettled(sender, {
        runId,
        phase: "idees",
        engine: usedEngine,
        status: "failed",
        errorCode: result.error?.code
      });
      throw new Error(result.error?.message ?? result.summary);
    }

    emitPhaseSettled(sender, {
      runId,
      phase: "idees",
      engine: usedEngine,
      status: "completed"
    });

    const lines = (result.artifacts?.[0]?.content ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.map((line, index) => {
      const cleaned = line.replace(/^\d+\.\s*/, "");
      const pillarLabel =
        bundle.pillars[index % bundle.pillars.length]?.label ?? "General";

      const angleMatch = cleaned.split("| angle: ");
      if (angleMatch.length >= 2 && angleMatch[1]) {
        const title = (angleMatch[0] ?? "").split(" - ")[0]?.trim() || (angleMatch[0] ?? "").trim();
        const angle = angleMatch[1].split("| score:")[0]?.trim() ?? "";
        if (title && angle) {
          return this.repository.createIdea({ title, angle, pillarLabel, targetIcpSegment });
        }
      }

      const dashParts = cleaned.split(" - ");
      const title = (dashParts[0] ?? cleaned).trim();
      const angle = dashParts.length > 1 ? dashParts.slice(1).join(" - ").trim() : "";

      return this.repository.createIdea({ title, angle, pillarLabel, targetIcpSegment });
    });
  }

  getRepository() {
    return this.repository;
  }
}

export function registerIdeasIpcHandlers(
  ipcRegistrar: IpcRegistrar,
  ideasService: IdeasService
) {
  registerValidatedHandler(ipcRegistrar, "ideas:list", emptyInputSchema, () =>
    ideasService.listIdeas()
  );
  registerValidatedHandler(
    ipcRegistrar,
    "ideas:create",
    ideaInputSchema,
    (input) => ideasService.createIdea(input)
  );
  registerValidatedHandler(
    ipcRegistrar,
    "ideas:create-from-news-source",
    newsSourceInputSchema,
    (input, sender) => ideasService.createFromNewsSource(input, sender)
  );
  registerValidatedHandler(
    ipcRegistrar,
    "ideas:generate-from-strategy",
    generateFromStrategySchema,
    (input, sender) => ideasService.generateFromStrategy(input, sender)
  );
}
