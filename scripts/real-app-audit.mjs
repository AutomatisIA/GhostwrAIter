import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron } from "playwright";

function createAuditHome() {
  return process.env.AUDIT_HOME || mkdtempSync(join(tmpdir(), "linkedin-poster-audit-"));
}

function logStep(step, data) {
  console.log(`STEP ${step}: ${JSON.stringify(data)}`);
}

const auditHome = createAuditHome();
const uniqueSuffix = Date.now().toString();
const manualIdeaTitle = `Automatisation VS Agent IA autonome ${uniqueSuffix}`;
const newsTitle = `OpenAI lance une nouvelle capacite agentique ${uniqueSuffix}`;
const plannedDate = "2026-04-18";

const app = await electron.launch({
  args: ["dist-electron/main/index.js"],
  env: {
    ...process.env,
    LINKEDIN_POSTER_WORKSPACE_ROOT: join(auditHome, "workspace")
  }
});

const page = await app.firstWindow();
page.setDefaultTimeout(30000);
await page.waitForTimeout(1500);

try {
  logStep("environment", {
    auditHome,
    url: page.url()
  });

  logStep("dashboard", {
    nav: await page.locator("nav a").allTextContents()
  });

  await page.getByRole("link", { name: "Strategie" }).click();
  await page.getByLabel("Nom").fill("Philippe");
  await page.getByLabel("Positionnement").fill("Consultant IA generative pour PME");
  await page
    .locator("textarea")
    .nth(0)
    .fill("J aide les PME a deployer l IA sans theatre ni promesse vide.");
  await page
    .locator("textarea")
    .nth(1)
    .fill("Adoption IA, cadrage, ROI, gouvernance et execution terrain.");
  await page.getByRole("button", { name: "Ajouter une offre" }).click();
  await page.getByLabel("Nom de l'offre 1").fill("Audit IA PME");
  await page
    .getByLabel("Promesse de l'offre 1")
    .fill("Prioriser les cas d'usage utiles et deployables sans theatre.");
  await page
    .getByLabel("Problemes traites par l'offre 1")
    .fill("Trop d'idees, pas de priorisation, pas de sponsor, pas de garde-fous.");
  await page.getByRole("button", { name: "Ajouter un pilier" }).click();
  await page.getByLabel("Label du pilier 1").fill("Adoption IA");
  await page
    .getByPlaceholder("Ex. Comment cadrer, embarquer l'equipe et deployer sans friction.")
    .first()
    .fill("Comment deployer l IA avec cadrage, roles et responsabilites claires.");
  await page.getByRole("button", { name: "Ajouter un pilier" }).click();
  await page.getByLabel("Label du pilier 2").fill("ROI IA");
  await page
    .getByPlaceholder("Ex. Comment cadrer, embarquer l'equipe et deployer sans friction.")
    .nth(1)
    .fill("Comment arbitrer entre promesse, cout, risque et impact operationnel.");
  await page.getByRole("button", { name: "Ajouter une regle de voix" }).click();
  await page.getByPlaceholder("Ex. Anti-style").fill("Anti-style");
  await page
    .getByLabel("Texte de la regle 1")
    .fill("Interdire les formulations creuses, les slogans IA et les phrases qui sonnent consultant hors-sol.");
  await page.getByRole("button", { name: "Enregistrer la strategie" }).click();
  await page.waitForTimeout(1000);

  const strategyBundle = await page.evaluate(() =>
    globalThis.window.linkedinPoster.strategy.getActiveBundle()
  );

  logStep("strategie-save", {
    status: await page.locator(".form-status").first().textContent(),
    counts: {
      offers: strategyBundle.offers.length,
      icps: strategyBundle.icps.length,
      pillars: strategyBundle.pillars.length,
      voiceRules: strategyBundle.voiceRules.length
    }
  });

  await page
    .getByRole("button", { name: "Generer le socle editorial" })
    .evaluate((element) => element.click());
  await page.waitForFunction(() => {
    const status = globalThis.document.querySelector(".form-status")?.textContent ?? "";
    return status.includes("Socle editorial genere.") || status.includes("Erreur lors de la generation du socle editorial");
  }, { timeout: 60000 });

  const foundationStatus = await page.locator(".form-status").first().textContent();
  const foundationSummary =
    (await page.locator("pre").count()) > 0
      ? (await page.locator("pre").textContent())?.slice(0, 600)
      : null;

  logStep("strategie-foundation", {
    status: foundationStatus,
    summary: foundationSummary
  });

  await page.getByRole("link", { name: "Idees" }).click();
  await page.getByLabel("Titre du sujet").fill(manualIdeaTitle);
  await page
    .getByLabel("Angle")
    .fill(
      "Automatisation = fiable, predicible, faible cout. Agents = plus souples, mais plus couteux a cadrer, superviser et fiabiliser."
    );
  await page.getByLabel("Pilier editorial").fill("ROI IA");
  await page.getByRole("button", { name: "Ajouter l'idee" }).click();
  await page.waitForTimeout(1200);

  await page.getByLabel("Titre source").fill(newsTitle);
  await page
    .getByLabel("Resume source")
    .fill(
      "Une nouvelle capacite met l accent sur les workflows, les outils et la supervision humaine."
    );
  await page.getByRole("button", { name: "Transformer la veille en draft" }).click();
  await page.waitForTimeout(3000);

  logStep("idees", {
    status: await page.locator(".form-status").first().textContent(),
    cards: await page.locator(".list-card").count()
  });

  const manualIdeaCard = page.locator(".list-card").filter({ hasText: manualIdeaTitle }).first();
  await manualIdeaCard.getByRole("link", { name: "Ouvrir dans l'atelier" }).click();
  await page.waitForTimeout(1200);

  logStep("atelier-open", {
    url: page.url(),
    status: await page.locator(".form-status").first().textContent(),
    stepTitleCount: await page.locator("h3").count(),
    finalCardCount: await page.locator(".workshop-draft").count()
  });

  await page.locator(".workshop-stage .selection-card").filter({ hasText: "Expertise" }).first().click();
  await page
    .getByRole("button", { name: /Suivant : Structure/i })
    .evaluate((element) => element.click());
  await page.waitForTimeout(2500);

  logStep("atelier-structures", {
    status: await page.locator(".form-status").first().textContent(),
    structures: await page.locator(".selection-card").allTextContents()
  });

  await page
    .getByRole("button", { name: /Suivant : Accroche/i })
    .evaluate((element) => element.click());
  await page.waitForTimeout(2500);

  logStep("atelier-hooks", {
    status: await page.locator(".form-status").first().textContent(),
    hooks: await page.locator(".selection-card").allTextContents()
  });

  await page
    .getByRole("button", { name: /Generer le draft final/i })
    .evaluate((element) => element.click());
  await page.waitForSelector(".workshop-draft", { timeout: 90000 });

  logStep("atelier-draft", {
    status: await page.locator(".form-status").first().textContent(),
    finalCard: (await page.locator(".workshop-draft").textContent())?.slice(0, 1400)
  });

  await page.getByRole("link", { name: "Bibliotheque" }).click();
  await page.waitForTimeout(1200);

  logStep("bibliotheque-load", {
    status: await page.locator(".form-status").first().textContent(),
    entries: await page.locator(".list-card").count()
  });

  await page.getByLabel("Recherche").fill("PME");
  await page.waitForTimeout(1200);
  await page
    .getByRole("button", { name: "Creer une variante" })
    .first()
    .evaluate((element) => element.click());
  await page.waitForTimeout(3000);

  logStep("bibliotheque-variant", {
    status: await page.locator(".form-status").first().textContent(),
    entries: await page.locator(".list-card").count()
  });

  await page.getByRole("button", { name: "Planifier" }).first().click();
  await page.waitForTimeout(1000);
  await page.getByLabel("Date prevue").fill(plannedDate);
  await page.getByRole("button", { name: "Planifier le draft" }).click();
  await page.waitForTimeout(1500);

  logStep("calendrier", {
    status: await page.locator(".form-status").first().textContent(),
    items: await page.locator(".list-card").allTextContents()
  });

  await page.getByRole("link", { name: "Runner" }).click();
  await page.waitForTimeout(1200);

  logStep("runner", {
    cards: await page.locator(".list-card").allTextContents()
  });

  await page.getByRole("link", { name: "Parametres" }).click();
  await page.getByRole("button", { name: "Exporter le workspace" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Purger les logs" }).click();
  await page.waitForTimeout(1200);

  logStep("parametres", {
    text: (await page.locator("body").innerText()).slice(0, 1200)
  });
} catch (error) {
  logStep("error", { message: String(error) });
} finally {
  await app.evaluate(async ({ app }) => app.quit());
}
