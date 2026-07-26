import Database from "better-sqlite3";
import {
  type StrategyBundleInput,
  strategyBundleInputSchema
} from "../../../shared/schemas/strategy";
import { createId } from "../../shared/create-id";

type StrategyBundleRecord = {
  profile: {
    id: string;
    name: string;
    positioning: string;
    bio: string;
    expertiseSummary: string;
  };
  offers: Array<{
    id: string;
    name: string;
    promise: string;
    problems: string;
    proofPoints?: string;
    ctaModes?: string;
  }>;
  icps: Array<{
    id: string;
    segment: string;
    pains: string;
    objections?: string;
    desiredOutcomes?: string;
    languageCues?: string;
    linkedinBehavior?: string;
  }>;
  pillars: Array<{
    id: string;
    label: string;
    description?: string;
    position: number;
    isDefault: boolean;
  }>;
  voiceRules: Array<{
    id: string;
    category: string;
    ruleText: string;
    ruleType: "do" | "dont" | "anti_style" | "format_rule";
  }>;
};

export function createStrategyTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      positioning TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      expertise_summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      promise TEXT NOT NULL,
      problems TEXT NOT NULL,
      proof_points TEXT,
      cta_modes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS icps (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      segment TEXT NOT NULL,
      pains TEXT NOT NULL,
      objections TEXT,
      desired_outcomes TEXT,
      language_cues TEXT,
      linkedin_behavior TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pillars (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT,
      position INTEGER NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS voice_rules (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      rule_text TEXT NOT NULL,
      rule_type TEXT NOT NULL CHECK (rule_type IN ('do', 'dont', 'anti_style', 'format_rule')),
      created_at TEXT NOT NULL
    );
  `);
}

export class StrategyRepository {
  constructor(private readonly db: Database.Database) {}

  saveStrategyBundle(input: StrategyBundleInput) {
    const bundle = strategyBundleInputSchema.parse(input);
    const now = new Date().toISOString();
    const profileId = "profile_active";

    const transaction = this.db.transaction(() => {
      this.db.prepare("DELETE FROM voice_rules").run();
      this.db.prepare("DELETE FROM offers").run();
      this.db.prepare("DELETE FROM icps").run();
      this.db.prepare("DELETE FROM pillars").run();
      this.db.prepare("DELETE FROM profiles").run();

      this.db
        .prepare(`
          INSERT INTO profiles (
            id, name, positioning, bio, expertise_summary, created_at, updated_at, is_active
          ) VALUES (
            @id, @name, @positioning, @bio, @expertiseSummary, @createdAt, @updatedAt, 1
          )
        `)
        .run({
          id: profileId,
          name: bundle.profile.name,
          positioning: bundle.profile.positioning,
          bio: bundle.profile.bio ?? "",
          expertiseSummary: bundle.profile.expertiseSummary ?? "",
          createdAt: now,
          updatedAt: now
        });

      const insertOffer = this.db.prepare(`
        INSERT INTO offers (
          id, profile_id, name, promise, problems, proof_points, cta_modes, created_at, updated_at
        ) VALUES (
          @id, @profileId, @name, @promise, @problems, @proofPoints, @ctaModes, @createdAt, @updatedAt
        )
      `);

      bundle.offers.forEach((offer, index) => {
        insertOffer.run({
          id: createId("offer", index),
          profileId,
          name: offer.name,
          promise: offer.promise,
          problems: offer.problems,
          proofPoints: offer.proofPoints ?? null,
          ctaModes: offer.ctaModes ?? null,
          createdAt: now,
          updatedAt: now
        });
      });

      const insertIcp = this.db.prepare(`
        INSERT INTO icps (
          id, profile_id, segment, pains, objections, desired_outcomes, language_cues, linkedin_behavior, created_at, updated_at
        ) VALUES (
          @id, @profileId, @segment, @pains, @objections, @desiredOutcomes, @languageCues, @linkedinBehavior, @createdAt, @updatedAt
        )
      `);

      bundle.icps.forEach((icp, index) => {
        insertIcp.run({
          id: createId("icp", index),
          profileId,
          segment: icp.segment,
          pains: icp.pains,
          objections: icp.objections ?? null,
          desiredOutcomes: icp.desiredOutcomes ?? null,
          languageCues: icp.languageCues ?? null,
          linkedinBehavior: icp.linkedinBehavior ?? null,
          createdAt: now,
          updatedAt: now
        });
      });

      const insertPillar = this.db.prepare(`
        INSERT INTO pillars (
          id, label, description, position, is_default
        ) VALUES (
          @id, @label, @description, @position, @isDefault
        )
      `);

      bundle.pillars.forEach((pillar, index) => {
        insertPillar.run({
          id: createId("pillar", index),
          label: pillar.label,
          description: pillar.description ?? null,
          position: pillar.position,
          isDefault: pillar.isDefault ? 1 : 0
        });
      });

      const insertVoiceRule = this.db.prepare(`
        INSERT INTO voice_rules (
          id, profile_id, category, rule_text, rule_type, created_at
        ) VALUES (
          @id, @profileId, @category, @ruleText, @ruleType, @createdAt
        )
      `);

      bundle.voiceRules.forEach((rule, index) => {
        insertVoiceRule.run({
          id: createId("voice_rule", index),
          profileId,
          category: rule.category,
          ruleText: rule.ruleText,
          ruleType: rule.ruleType,
          createdAt: now
        });
      });
    });

    transaction();
  }

  /**
   * The strategy as it stands, empty included.
   *
   * A fresh install has no active profile. That is not a failure, it is the
   * normal first state, and the previous version could only say so by throwing:
   * `getActiveStrategyBundle` raised "No active strategy profile found", and
   * every caller had to decide for itself whether that meant "empty" or
   * "broken". They did not agree. `App.tsx` read it as empty, and the Create
   * screen rendered it as « La stratégie n'a pas pu être lue », so the very
   * first screen of a new install announced a failure that had not happened.
   *
   * An empty bundle says the same thing without the ambiguity, and a real read
   * error still throws, from SQLite, where it belongs.
   */
  findActiveStrategyBundle(): StrategyBundleRecord {
    const profile = this.db
      .prepare(`
        SELECT id, name, positioning, bio, expertise_summary AS expertiseSummary
        FROM profiles
        WHERE is_active = 1
        LIMIT 1
      `)
      .get() as StrategyBundleRecord["profile"] | undefined;

    if (!profile) {
      return {
        profile: { id: "", name: "", positioning: "", bio: "", expertiseSummary: "" },
        offers: [],
        icps: [],
        pillars: [],
        voiceRules: []
      };
    }

    return this.readBundleFor(profile);
  }

  /**
   * Same as above, but demands that a profile exists.
   *
   * Kept for the callers that cannot do anything useful without one, such as
   * generating the editorial foundation: failing there names the cause, where
   * an empty bundle would produce a foundation about nobody.
   */
  getActiveStrategyBundle(): StrategyBundleRecord {
    const bundle = this.findActiveStrategyBundle();
    if (!bundle.profile.id) {
      throw new Error("No active strategy profile found");
    }
    return bundle;
  }

  private readBundleFor(profile: StrategyBundleRecord["profile"]): StrategyBundleRecord {

    const offers = this.db
      .prepare(`
        SELECT id, name, promise, problems, proof_points AS proofPoints, cta_modes AS ctaModes
        FROM offers
        WHERE profile_id = ?
        ORDER BY created_at ASC
      `)
      .all(profile.id) as StrategyBundleRecord["offers"];

    const icps = this.db
      .prepare(`
        SELECT
          id,
          segment,
          pains,
          objections,
          desired_outcomes AS desiredOutcomes,
          language_cues AS languageCues,
          linkedin_behavior AS linkedinBehavior
        FROM icps
        WHERE profile_id = ?
        ORDER BY created_at ASC
      `)
      .all(profile.id) as StrategyBundleRecord["icps"];

    const pillars = this.db
      .prepare(`
        SELECT id, label, description, position, is_default AS isDefault
        FROM pillars
        ORDER BY position ASC
      `)
      .all()
      .map((pillar) => ({
        ...(pillar as Omit<StrategyBundleRecord["pillars"][number], "isDefault"> & {
          isDefault: number;
        }),
        isDefault: Boolean((pillar as { isDefault: number }).isDefault)
      }));

    const voiceRules = this.db
      .prepare(`
        SELECT id, category, rule_text AS ruleText, rule_type AS ruleType
        FROM voice_rules
        WHERE profile_id = ?
        ORDER BY created_at ASC
      `)
      .all(profile.id) as StrategyBundleRecord["voiceRules"];

    return {
      profile,
      offers,
      icps,
      pillars,
      voiceRules
    };
  }
}
