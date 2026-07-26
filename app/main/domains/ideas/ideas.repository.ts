import Database from "better-sqlite3";
import type { IdeaInput, IdeaRecord } from "../../../shared/types/ideas";
import { createId } from "../../shared/create-id";

export function createIdeasTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      angle TEXT NOT NULL,
      pillar_label TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  ensureTargetIcpSegmentColumn(db);
}

/**
 * Ajout idempotent de `target_icp_segment` sur une base existante.
 *
 * `CREATE TABLE IF NOT EXISTS` ne touche pas une table deja creee : sans cet
 * ALTER, la colonne n existerait que sur les espaces de travail neufs et toute
 * lecture echouerait sur les bases installees. Les deux instructions sont des
 * chaines litterales constantes, sans aucune interpolation : aucune surface
 * d injection, et rien a parametrer.
 *
 * Volontairement local au domaine des idees plutot que branche sur le helper
 * `ensureColumn` de l atelier : celui-ci porte une liste blanche de tables
 * (`drafts`, `execution_runs`) et y ajouter `ideas` donnerait au domaine atelier
 * la propriete du schema des idees.
 */
function ensureTargetIcpSegmentColumn(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(ideas)").all() as Array<{ name: string }>;

  if (columns.some((column) => column.name === "target_icp_segment")) {
    return;
  }

  db.prepare("ALTER TABLE ideas ADD COLUMN target_icp_segment TEXT").run();
}

export class IdeasRepository {
  constructor(private readonly db: Database.Database) {}

  createIdea(input: IdeaInput): IdeaRecord {
    const record: IdeaRecord = {
      id: createId("idea"),
      title: input.title,
      angle: input.angle,
      pillarLabel: input.pillarLabel,
      createdAt: new Date().toISOString(),
      // `undefined` n est pas une valeur liable par better-sqlite3 : le champ
      // etant optionnel cote schema, on normalise en `null` a l ecriture comme
      // a la lecture, pour que le contrat expose une seule absence.
      targetIcpSegment: input.targetIcpSegment ?? null
    };

    this.db
      .prepare(`
        INSERT INTO ideas (id, title, angle, pillar_label, created_at, target_icp_segment)
        VALUES (@id, @title, @angle, @pillarLabel, @createdAt, @targetIcpSegment)
      `)
      .run(record);

    return record;
  }

  listIdeas(): IdeaRecord[] {
    return this.db
      .prepare(`
        SELECT
          id,
          title,
          angle,
          pillar_label AS pillarLabel,
          created_at AS createdAt,
          target_icp_segment AS targetIcpSegment
        FROM ideas
        ORDER BY rowid DESC
      `)
      .all() as IdeaRecord[];
  }

  getIdeaById(id: string): IdeaRecord {
    const idea = this.db
      .prepare(`
        SELECT
          id,
          title,
          angle,
          pillar_label AS pillarLabel,
          created_at AS createdAt,
          target_icp_segment AS targetIcpSegment
        FROM ideas
        WHERE id = ?
      `)
      .get(id) as IdeaRecord | undefined;

    if (!idea) {
      throw new Error(`Idea not found: ${id}`);
    }

    return idea;
  }
}
