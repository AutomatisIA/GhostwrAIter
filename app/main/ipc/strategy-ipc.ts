import Database from "better-sqlite3";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import {
  StrategyRepository,
  createStrategyTables
} from "../domains/strategy/strategy.repository";
import {
  strategyBundleInputSchema,
  type StrategyBundleInput
} from "../../shared/schemas/strategy";
import { emptyInputSchema } from "../../shared/schemas/common";
import {
  registerValidatedHandler,
  type IpcRegistrar
} from "./register-validated-handler";

export class StrategyService {
  private readonly repository: StrategyRepository;

  constructor(
    db: Database.Database,
    private readonly skillRunnerService: SkillRunnerService = new SkillRunnerService()
  ) {
    createStrategyTables(db);
    this.repository = new StrategyRepository(db);
  }

  saveStrategyBundle(input: StrategyBundleInput) {
    this.repository.saveStrategyBundle(input);
  }

  getActiveStrategyBundle() {
    return this.repository.getActiveStrategyBundle();
  }

  async generateFoundation() {
    const bundle = this.repository.getActiveStrategyBundle();
    const result = await this.skillRunnerService.executeAsync({
      runId: `run_${Date.now()}`,
      skillName: "linkedin-strategy-foundation",
      skillVersion: "1.0.0",
      context: {},
      payload: bundle,
      attachments: []
    });

    if (result.status !== "succeeded" || !result.artifacts?.[0]?.content) {
      throw new Error(result.error?.message ?? result.summary);
    }

    return {
      summaryMarkdown: result.artifacts[0].content
    };
  }
}

export function registerStrategyIpcHandlers(
  ipcRegistrar: IpcRegistrar,
  strategyService: StrategyService
) {
  registerValidatedHandler(
    ipcRegistrar,
    "strategy:get-active-bundle",
    emptyInputSchema,
    () => strategyService.getActiveStrategyBundle()
  );
  registerValidatedHandler(
    ipcRegistrar,
    "strategy:save-bundle",
    strategyBundleInputSchema,
    (input) => {
      strategyService.saveStrategyBundle(input);
      return strategyService.getActiveStrategyBundle();
    }
  );
  registerValidatedHandler(
    ipcRegistrar,
    "strategy:generate-foundation",
    emptyInputSchema,
    () => strategyService.generateFoundation()
  );
}
