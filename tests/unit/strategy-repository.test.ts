import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  StrategyRepository,
  createStrategyTables
} from "../../app/main/domains/strategy/strategy.repository";

describe("strategy repository", () => {
  let db: Database.Database;
  let repository: StrategyRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    createStrategyTables(db);
    repository = new StrategyRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it("persists and reloads the active strategy bundle", () => {
    repository.saveStrategyBundle({
      profile: {
        name: "Philippe",
        positioning: "Consultant IA PME",
        bio: "Approche anti-hype",
        expertiseSummary: "Cas d'usage, ROI, gouvernance"
      },
      offers: [
        {
          name: "Accompagnement IA",
          promise: "Transformer l'IA en gains operationnels",
          problems: "Pas de priorisation des cas d'usage",
          proofPoints: "Mission terrain"
        }
      ],
      icps: [
        {
          segment: "Responsables operationnels",
          pains: "Trop d'outils, pas de methode",
          objections: "Equipe pas prete",
          desiredOutcomes: "Gains visibles rapidement",
          languageCues: "Concret, simple, rentable"
        }
      ],
      pillars: [
        {
          label: "ROI",
          description: "Ce qui produit un resultat mesurable",
          position: 1,
          isDefault: true
        }
      ],
      voiceRules: [
        {
          category: "do",
          ruleText: "Parler terrain avant outil",
          ruleType: "do"
        }
      ]
    });

    const bundle = repository.getActiveStrategyBundle();

    expect(bundle.profile.name).toBe("Philippe");
    expect(bundle.offers).toHaveLength(1);
    expect(bundle.icps[0]?.segment).toBe("Responsables operationnels");
    expect(bundle.pillars[0]?.label).toBe("ROI");
    expect(bundle.voiceRules[0]?.ruleText).toContain("terrain");
  });

  it("replaces previous related strategy records on save while keeping one active profile", () => {
    repository.saveStrategyBundle({
      profile: {
        name: "Version 1",
        positioning: "Consultant IA PME",
        bio: "",
        expertiseSummary: ""
      },
      offers: [{ name: "Offre 1", promise: "Promesse 1", problems: "Probleme 1" }],
      icps: [],
      pillars: [{ label: "Pilier 1", position: 1, isDefault: false }],
      voiceRules: []
    });

    repository.saveStrategyBundle({
      profile: {
        name: "Version 2",
        positioning: "Consultant IA pour PME",
        bio: "Nouveau positionnement",
        expertiseSummary: "Methode"
      },
      offers: [{ name: "Offre 2", promise: "Promesse 2", problems: "Probleme 2" }],
      icps: [],
      pillars: [{ label: "Pilier 2", position: 1, isDefault: false }],
      voiceRules: []
    });

    const bundle = repository.getActiveStrategyBundle();
    const profilesCount = db.prepare("SELECT COUNT(*) AS count FROM profiles").get() as {
      count: number;
    };
    const offersCount = db.prepare("SELECT COUNT(*) AS count FROM offers").get() as {
      count: number;
    };

    expect(bundle.profile.name).toBe("Version 2");
    expect(bundle.offers[0]?.name).toBe("Offre 2");
    expect(profilesCount.count).toBe(1);
    expect(offersCount.count).toBe(1);
  });
});
