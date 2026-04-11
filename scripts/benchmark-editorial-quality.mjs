import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron } from "playwright";

function createBenchmarkHome() {
  return process.env.BENCHMARK_HOME || mkdtempSync(join(tmpdir(), "linkedin-poster-benchmark-"));
}

function logStep(step, data) {
  console.log(`STEP ${step}: ${JSON.stringify(data)}`);
}

const benchmarkHome = createBenchmarkHome();

const strategyBundle = {
  profile: {
    name: "Philippe",
    positioning: "Consultant IA generative pour PME",
    bio: "J aide les PME a deployer l IA sans theatre ni promesse vide.",
    expertiseSummary: "Adoption IA, cadrage, ROI, gouvernance et execution terrain."
  },
  offers: [
    {
      name: "Audit IA PME",
      promise: "Prioriser les cas d usage utiles et deployables sans theatre.",
      problems: "Trop d idees, pas de priorisation, pas de sponsor, pas de garde-fous.",
      proofPoints: "",
      ctaModes: ""
    }
  ],
  icps: [
    {
      segment: "Dirigeants de PME",
      pains: "Trop d idees IA, pas de priorisation, peu de ROI lisible et une equipe deja sous tension.",
      objections: "Peur du cout, du flou, de la complexite et du temps de supervision.",
      desiredOutcomes: "Des cas d usage deployables, utiles et defendables devant l equipe et la direction.",
      languageCues: "Deployable, concret, ROI, equipe, process, pilotage.",
      linkedinBehavior: "S arrete sur les arbitrages concrets, les erreurs a eviter et les retours terrain."
    }
  ],
  pillars: [
    {
      label: "Adoption IA",
      description: "Comment deployer l IA avec roles, process et responsabilites claires.",
      position: 0,
      isDefault: true
    },
    {
      label: "ROI IA",
      description: "Comment arbitrer entre promesse, cout, risque et impact operationnel.",
      position: 1,
      isDefault: false
    },
    {
      label: "Cadrage",
      description: "Comment prioriser les cas d usage et eviter le theatre technologique.",
      position: 2,
      isDefault: false
    }
  ],
  voiceRules: [
    {
      category: "Anti-style",
      ruleText:
        "Interdire les formulations creuses, les slogans IA, les phrases hors-sol et les effets de manche qui pourraient s appliquer a n importe quel consultant.",
      ruleType: "anti_style"
    }
  ]
};

const topics = [
  {
    title: "On parle beaucoup de prompts. Pas assez de process.",
    angle:
      "En PME, le blocage vient souvent du workflow, des validations et des droits, pas du prompt lui-meme.",
    pillarLabel: "Cadrage"
  },
  {
    title: "Une PME n a pas besoin de 20 cas d usage IA. Elle a besoin des 3 bons.",
    angle:
      "Multiplier les idees donne une impression de mouvement, mais sans priorisation on ajoute surtout du bruit, des attentes et du travail de coordination.",
    pillarLabel: "ROI IA"
  },
  {
    title: "Automatisation VS Agent IA autonome",
    angle:
      "Automatisation = fiable, predicible, faible cout. Agents = plus souples, mais plus couteux a cadrer, superviser et fiabiliser.",
    pillarLabel: "ROI IA"
  }
];

const app = await electron.launch({
  args: ["dist-electron/main/index.js"],
  env: {
    ...process.env,
    LINKEDIN_POSTER_WORKSPACE_ROOT: join(benchmarkHome, "workspace")
  }
});

const page = await app.firstWindow();
page.setDefaultTimeout(60000);
await page.waitForTimeout(1500);

try {
  await page.evaluate(async (bundle) => {
    await globalThis.window.linkedinPoster.strategy.saveBundle(bundle);
  }, strategyBundle);

  logStep("environment", {
    benchmarkHome,
    topicCount: topics.length
  });

  for (const topic of topics) {
    const result = await page.evaluate(async (input) => {
      const idea = await globalThis.window.linkedinPoster.ideas.createIdea(input);
      const structures = await globalThis.window.linkedinPoster.workshop.getSuggestedStructures(
        idea.id,
        "expertise",
        "awareness"
      );
      const hooks = await globalThis.window.linkedinPoster.workshop.generateHooks(
        idea.id,
        "expertise",
        structures[0].key
      );
      const draft = await globalThis.window.linkedinPoster.workshop.generateFinalDraft(
        idea.id,
        "expertise",
        "awareness",
        structures[0].key,
        structures[0].label,
        hooks[0].id,
        hooks[0].text,
        hooks
      );
      const variant = await globalThis.window.linkedinPoster.workshop.createVariant(
        draft.draft.id,
        "angle_shift"
      );

      return {
        idea,
        structures,
        hooks,
        draft: draft.draft,
        variant: variant.draft
      };
    }, topic);

    logStep("topic-result", {
      title: topic.title,
      pillarLabel: topic.pillarLabel,
      structure: result.structures[0],
      hook: result.hooks[0],
      draftHeadline: result.draft.headline,
      draftScore: result.draft.qualityScore,
      draftOpening: result.draft.bodyMarkdown.split("\n").slice(0, 2).join(" "),
      variantHeadline: result.variant.headline,
      variantOpening: result.variant.bodyMarkdown.split("\n").slice(0, 2).join(" ")
    });
  }
} catch (error) {
  logStep("error", { message: String(error) });
} finally {
  await app.evaluate(async ({ app }) => app.quit());
}
