import type { WebContents } from "electron";
import Database from "better-sqlite3";
import { SkillRunnerService } from "../domains/execution/skill-runner.service";
import {
  emitPhaseSettled,
  emitPhaseStarted
} from "../domains/execution/execution-progress-emitter";
import { SkillRunError } from "../domains/execution/skill-run-error";
import { resolveAnnouncedEngine } from "../domains/execution/announced-engine";
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
    // Le moteur annonce n est plus code en dur. `runPhase` de l atelier a cesse
    // de le faire au commit e794e11 ; ce parcours-ci et celui des sujets
    // etaient restes en arriere, et annoncaient « Codex » a un utilisateur qui
    // a choisi un autre moteur. Le nom vient donc du moteur qui SERA utilise,
    // resolu avant l appel, puis du moteur reellement utilise tel que le runner
    // l a estampille.
    const announced = await resolveAnnouncedEngine(this.skillRunnerService);
    emitPhaseStarted(sender, { runId, phase: "foundation", engine: announced });
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
        phase: "foundation",
        engine: usedEngine,
        status: "failed",
        errorCode: result.error?.code
      });
      throw new Error(result.error?.message ?? result.summary);
    }

    emitPhaseSettled(sender, {
      runId,
      phase: "foundation",
      engine: usedEngine,
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
