import Database from "better-sqlite3";
import { createIdeasTables, IdeasRepository } from "../domains/ideas/ideas.repository";
import type { IdeaInput } from "../../shared/types/ideas";

type IpcRegistrar = {
  handle: (
    channel: string,
    handler: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>
  ) => void;
};

export class IdeasService {
  private readonly repository: IdeasRepository;

  constructor(db: Database.Database) {
    createIdeasTables(db);
    this.repository = new IdeasRepository(db);
  }

  listIdeas() {
    return this.repository.listIdeas();
  }

  createIdea(input: IdeaInput) {
    return this.repository.createIdea(input);
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
}
