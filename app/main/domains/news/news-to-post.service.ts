import type { WebContents } from "electron";
import Database from "better-sqlite3";
import { IdeasRepository } from "../ideas/ideas.repository";
import {
  SkillRunnerService,
  type SkillRunnerInvocation,
  type SkillRunnerResult
} from "../execution/skill-runner.service";
import {
  emitPhaseSettled,
  emitPhaseStarted
} from "../execution/execution-progress-emitter";
// Le type vient du schema zod qui valide deja cette entree a la frontiere IPC.
// La forme etait recopiee a la main dans la signature : deux declarations pour
// un seul contrat, dont une seule est verifiee a l execution.
import type { NewsSourceInput } from "../../../shared/schemas/ideas";
import type { WorkshopSession } from "../../../shared/types/workshop";
import type { StrategyBundle } from "../../../shared/types/strategy";
import { createId } from "../../shared/create-id";
import { recordExecutionRun } from "../execution/execution-runs.repository";
import { SkillRunError, skillRunError } from "../execution/skill-run-error";
import { buildStrategyContext } from "../strategy/strategy-context";
import { resolveAnnouncedEngine } from "../execution/announced-engine";

export class NewsToPostService {
  constructor(
    private readonly db: Database.Database,
    private readonly ideasRepository: IdeasRepository,
    private readonly skillRunnerService: SkillRunnerService = new SkillRunnerService(),
    private readonly getActiveStrategy?: () => StrategyBundle | null,
    private readonly getFoundationSummary?: () => string | null
  ) {}

  async createDraftFromSource(
    input: NewsSourceInput,
    sender?: WebContents
  ): Promise<WorkshopSession> {
    const { targetIcpSegment, ...source } = input;
    // Le pilier est resolu UNE fois, AVANT la creation de l idee, et la meme
    // valeur part vers l idee et vers le contexte de generation. Le libelle
    // "Veille" etait code en dur ici alors que le contexte retenait le pilier
    // reellement declare : l idee etait donc enregistree sous un pilier qui
    // n existe pas dans la strategie de l utilisateur. La passe de correction
    // ulterieure repartait de ce libelle introuvable et perdait la description
    // du pilier, et le filtre par pilier de la Bibliotheque ne rattachait le
    // post a aucun pilier reel.
    const strategy = this.requireActiveStrategy();
    const pillarLabel = this.resolveNewsPillarLabel(strategy);
    const idea = this.ideasRepository.createIdea({
      title: source.sourceTitle,
      angle: source.sourceSummary,
      pillarLabel,
      targetIcpSegment
    });
    const draftId = createId("draft");
    const runId = createId("run");
    const createdAt = new Date().toISOString();
    const runnerContext = this.buildRunnerContext(
      strategy,
      pillarLabel,
      idea.targetIcpSegment
    );

    const invocation: SkillRunnerInvocation = {
      runId,
      skillName: "linkedin-news-to-post",
      skillVersion: "1.0.0",
      context: runnerContext,
      // La cible ne descend PAS dans la charge utile : elle appartient au
      // contexte de strategie, ou le resume des cibles la porte deja. L y
      // remettre la ferait arriver deux fois au modele, sous deux formes.
      payload: source,
      attachments: []
    };

    // Le moteur annonce est celui qui SERA utilise, pas le seul choix explicite :
    // sans preference enregistree, ce parcours annoncait « Codex » alors que la
    // resolution active pouvait retenir Claude ou Antigravity. Cf.
    // announced-engine.ts pour le cout de cette resolution.
    const announced = await resolveAnnouncedEngine(this.skillRunnerService);
    emitPhaseStarted(sender, { runId, phase: "news", engine: announced });

    let result: SkillRunnerResult;
    try {
      result = await this.skillRunnerService.executeAsync(invocation);
    } catch (error) {
      // Meme defaut que dans l atelier : `started` est emis juste au-dessus, et
      // un moteur qui LEVE laissait ce parcours sans borne terminale. La garde
      // couvre le SEUL appel moteur, sinon le chemin d echec traite plus bas
      // (qui emet `failed` puis throw) produirait deux bornes terminales.
      emitPhaseSettled(sender, {
        runId,
        phase: "news",
        engine: announced,
        status: "failed",
        // Toujours renseigne : l emetteur omet la cle quand la valeur est
        // absente, ce que le contrat interdit sur un `failed`.
        errorCode: error instanceof SkillRunError ? error.code : "SKILL_RUN_FAILED"
      });
      throw error;
    }

    const usedEngine = result.engine ?? announced;

    if (result.status !== "succeeded" || !result.data?.draft) {
      emitPhaseSettled(sender, {
        runId,
        phase: "news",
        engine: usedEngine,
        status: "failed",
        errorCode: result.error?.code
      });
      throw skillRunError(result);
    }

    // Le skill linkedin-news-to-post ne renvoie PAS de hooks (contrat
    // {data:{draft, qualitySignals}}) : l accroche est dans le corps. On tolere
    // donc l absence de `hooks` (defaut tableau vide) au lieu de planter sur une
    // iteration de `undefined`. Bug revele par l eval (fixtures B), corrige ici.
    const skillHooks = result.data.hooks ?? [];

    this.db
      .prepare(`
        INSERT INTO drafts (id, idea_id, headline, body_markdown, quality_score, created_at, status, source_draft_id)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL)
      `)
      .run(
        draftId,
        idea.id,
        result.data.draft.headline,
        result.data.draft.bodyMarkdown,
        result.data.qualitySignals.clarity,
        createdAt
      );

    for (const hook of skillHooks) {
      this.db
        .prepare("INSERT INTO hooks (id, draft_id, text) VALUES (?, ?, ?)")
        .run(createId("hook"), draftId, hook.text);
    }

    this.db
      .prepare(`
        INSERT INTO draft_versions (id, draft_id, body_markdown, quality_score, reason, created_at)
        VALUES (?, ?, ?, ?, 'generation', ?)
      `)
      .run(
        createId("version"),
        draftId,
        result.data.draft.bodyMarkdown,
        result.data.qualitySignals.clarity,
        createdAt
      );

    recordExecutionRun(this.db, {
      invocation,
      result,
      ideaId: idea.id,
      draftId,
      createdAt
    });

    // "completed" emis apres la persistance reussie : si une ecriture echoue,
    // l'utilisateur ne voit pas un faux signal de succes.
    emitPhaseSettled(sender, {
      runId,
      phase: "news",
      engine: usedEngine,
      status: "completed"
    });

    return {
      idea,
      draft: {
        id: draftId,
        headline: result.data.draft.headline,
        bodyMarkdown: result.data.draft.bodyMarkdown,
        qualityScore: result.data.qualitySignals.clarity
      },
      hooks: skillHooks.map((hook, index) => ({
        id: `hook_${index}`,
        text: hook.text
      })),
      run: {
        id: runId,
        skillName: invocation.skillName,
        status: result.status,
        summary: result.summary
      },
      versions: [
        {
          id: "version_1",
          bodyMarkdown: result.data.draft.bodyMarkdown,
          qualityScore: result.data.qualitySignals.clarity,
          reason: "generation",
          createdAt
        }
      ],
      contextUsed: {
        pillarLabel: runnerContext.pillarLabel,
        voiceGuardrail: runnerContext.voiceRules
          .map((rule) => `[${rule.ruleType}] ${rule.ruleText}`)
          .join(" | "),
        activeSkills: [invocation.skillName]
      }
    };
  }

  private requireActiveStrategy(): StrategyBundle {
    const strategy = this.getActiveStrategy?.();

    if (!strategy) {
      throw new Error("No active strategy bundle is available.");
    }

    return strategy;
  }

  /**
   * Pilier du parcours veille, resolu en un seul endroit.
   *
   * Le libelle "Veille" reste la valeur par defaut, mais on prefere le pilier
   * reellement declare par l utilisateur s il existe, pour que sa description
   * parte dans le contexte ET que l idee soit rangee sous un pilier qui existe.
   * Le repli est intentionnel : une strategie sans pilier de veille produit des
   * idees sous "Veille", ce qui reste correct puisqu aucun pilier declare ne
   * peut les accueillir.
   */
  private resolveNewsPillarLabel(strategy: StrategyBundle): string {
    return (
      strategy.pillars.find((pillar) => /veille|actualit/i.test(pillar.label))?.label ?? "Veille"
    );
  }

  /**
   * Contexte du parcours veille.
   *
   * Il divergeait des deux autres services : une seule regle de voix sur dix
   * (la premiere de type anti_style), un pilier code en dur, et ni offres ni
   * cibles ni bio. Cette porte d entree produisait donc structurellement des
   * posts moins alignes que les autres, sans que rien ne le signale
   * (cf. docs/audit-2026-07-editorial.md section 8). Elle utilise desormais le
   * meme contexte que l atelier et la bibliotheque.
   *
   * La strategie et le pilier arrivent en parametres : ils sont resolus par
   * l appelant, qui les emploie aussi pour creer l idee. Les resoudre ici une
   * seconde fois reintroduirait les deux valeurs divergentes pour un seul fait.
   *
   * `targetIcpSegment` suit la meme regle que partout ailleurs : une cible
   * choisie restreint le resume a celle-la, aucune cible le laisse entier.
   */
  private buildRunnerContext(
    strategy: StrategyBundle,
    pillarLabel: string,
    targetIcpSegment?: string | null
  ) {
    return buildStrategyContext(
      strategy,
      pillarLabel,
      this.getFoundationSummary?.() ?? null,
      { requireVoiceRules: true, targetIcpSegment }
    );
  }

}
