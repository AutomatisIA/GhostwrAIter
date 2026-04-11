import Database from "better-sqlite3";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import { createStrategyTables, StrategyRepository } from "../domains/strategy/strategy.repository";
import { createIdeasTables, IdeasRepository } from "../domains/ideas/ideas.repository";
import { NewsToPostService } from "../domains/news/news-to-post.service";
import {
  emptyInputSchema,
  ideaInputSchema,
  newsSourceInputSchema,
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

  constructor(db: Database.Database, skillRunnerService?: SkillRunnerService) {
    createIdeasTables(db);
    createStrategyTables(db);
    this.repository = new IdeasRepository(db);
    this.skillRunnerService = skillRunnerService ?? new SkillRunnerService();
    this.newsToPostService = new NewsToPostService(
      db,
      this.repository,
      this.skillRunnerService,
      () => this.strategyRepository.getActiveStrategyBundle()
    );
    this.strategyRepository = new StrategyRepository(db);
  }

  listIdeas() {
    return this.repository.listIdeas();
  }

  createIdea(input: IdeaInput) {
    return this.repository.createIdea(input);
  }

  createFromNewsSource(input: NewsSourceInput) {
    return this.newsToPostService.createDraftFromSource(input);
  }

  generateFromStrategy() {
    const bundle = this.strategyRepository.getActiveStrategyBundle();
    const result = this.skillRunnerService.execute({
      runId: `run_${Date.now()}`,
      skillName: "linkedin-topic-generator",
      skillVersion: "1.0.0",
      context: {},
      payload: {
        profileName: bundle.profile.name,
        positioning: bundle.profile.positioning,
        pillars: bundle.pillars,
        icps: bundle.icps,
        offers: bundle.offers
      },
      attachments: []
    });

    if (result.status !== "succeeded" || !result.artifacts?.[0]?.content) {
      throw new Error(result.error?.message ?? result.summary);
    }

    if (bundle.pillars.length === 0) {
      throw new Error("Strategy must define at least one pillar before generating ideas.");
    }

    const lines = (result.artifacts?.[0]?.content ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.map((line, index) => {
      const [titlePart, anglePart] = line
        .replace(/^\d+\.\s*/, "")
        .split("| angle: ");
      const pillarLabel = bundle.pillars[index % bundle.pillars.length]?.label;

      if (!titlePart?.trim() || !anglePart?.split("| score:")[0]?.trim() || !pillarLabel) {
        throw new Error("Codex returned malformed topic lines.");
      }

      return this.repository.createIdea({
        title: titlePart.split(" - ")[0]?.trim() || titlePart.trim(),
        angle: anglePart.split("| score:")[0].trim(),
        pillarLabel
      });
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
    (input) => ideasService.createFromNewsSource(input)
  );
  registerValidatedHandler(
    ipcRegistrar,
    "ideas:generate-from-strategy",
    emptyInputSchema,
    () => ideasService.generateFromStrategy()
  );
}
