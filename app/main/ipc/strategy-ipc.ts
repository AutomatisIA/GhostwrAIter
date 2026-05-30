import type { WebContents } from "electron";
import Database from "better-sqlite3";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import {
  emitPhaseSettled,
  emitPhaseStarted
} from "../domains/execution/execution-progress-emitter";
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

  async generateFoundation(sender?: WebContents) {
    const bundle = this.repository.getActiveStrategyBundle();
    const runId = `run_${Date.now()}`;
    emitPhaseStarted(sender, { runId, phase: "foundation", engine: "codex" });
    let result;
    try {
      result = await this.skillRunnerService.executeAsync({
        runId,
        skillName: "linkedin-strategy-foundation",
        skillVersion: "1.0.0",
        context: {},
        payload: bundle,
        attachments: []
      });
    } catch (err) {
      emitPhaseSettled(sender, {
        runId,
        phase: "foundation",
        engine: "codex",
        status: "failed",
        errorCode: err instanceof Error ? err.name : undefined
      });
      throw err;
    }

    if (result.status !== "succeeded" || !result.artifacts?.[0]?.content) {
      emitPhaseSettled(sender, {
        runId,
        phase: "foundation",
        engine: "codex",
        status: "failed",
        errorCode: result.error?.code
      });
      throw new Error(result.error?.message ?? result.summary);
    }

    emitPhaseSettled(sender, {
      runId,
      phase: "foundation",
      engine: "codex",
      status: "completed"
    });

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
    (_input, sender) => strategyService.generateFoundation(sender)
  );
}
