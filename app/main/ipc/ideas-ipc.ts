import Database from "better-sqlite3";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import { createStrategyTables, StrategyRepository } from "../domains/strategy/strategy.repository";
import { createIdeasTables, IdeasRepository } from "../domains/ideas/ideas.repository";
import { NewsToPostService } from "../domains/news/news-to-post.service";
import type { IdeaInput, NewsSourceInput } from "../../shared/types/ideas";

type IpcRegistrar = {
  handle: (
    channel: string,
    handler: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>
  ) => void;
};

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
    this.newsToPostService = new NewsToPostService(db, this.repository, this.skillRunnerService);
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
    const lines = (result.artifacts?.[0]?.content ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.map((line, index) => {
      const [titlePart, anglePart] = line
        .replace(/^\d+\.\s*/, "")
        .split("| angle: ");
      const pillarLabel = bundle.pillars[index % Math.max(bundle.pillars.length, 1)]?.label ?? "General";

      return this.repository.createIdea({
        title: titlePart.split(" - ")[0]?.trim() ?? titlePart.trim(),
        angle: anglePart?.split("| score:")[0]?.trim() ?? "Angle genere depuis la strategie",
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
  ipcRegistrar.handle("ideas:list", async () => ideasService.listIdeas());
  ipcRegistrar.handle("ideas:create", async (_event, payload) =>
    ideasService.createIdea(payload as IdeaInput)
  );
  ipcRegistrar.handle("ideas:create-from-news-source", async (_event, payload) =>
    ideasService.createFromNewsSource(payload as NewsSourceInput)
  );
  ipcRegistrar.handle("ideas:generate-from-strategy", async () =>
    ideasService.generateFromStrategy()
  );
}
