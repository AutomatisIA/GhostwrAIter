import Database from "better-sqlite3";
import {
  StrategyRepository,
  createStrategyTables
} from "../domains/strategy/strategy.repository";
import { type StrategyBundleInput } from "../../shared/schemas/strategy";

type IpcRegistrar = {
  handle: (
    channel: string,
    handler: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>
  ) => void;
};

export class StrategyService {
  private readonly repository: StrategyRepository;

  constructor(db: Database.Database) {
    createStrategyTables(db);
    this.repository = new StrategyRepository(db);
  }

  saveStrategyBundle(input: StrategyBundleInput) {
    this.repository.saveStrategyBundle(input);
  }

  getActiveStrategyBundle() {
    return this.repository.getActiveStrategyBundle();
  }
}

export function registerStrategyIpcHandlers(
  ipcRegistrar: IpcRegistrar,
  strategyService: StrategyService
) {
  ipcRegistrar.handle("strategy:get-active-bundle", async () =>
    strategyService.getActiveStrategyBundle()
  );

  ipcRegistrar.handle("strategy:save-bundle", async (_event, payload) => {
    strategyService.saveStrategyBundle(payload as StrategyBundleInput);

    return strategyService.getActiveStrategyBundle();
  });
}
