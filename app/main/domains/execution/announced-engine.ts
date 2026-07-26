import type { ExecutionEngine } from "../../../shared/types/execution-progress";
import type { EngineRegistry } from "./engine-registry";

/**
 * Moteur ANNONCE par la borne `started`, avant que l execution ne commence.
 *
 * LE DEFAUT CORRIGE. Les quatre parcours de generation lisaient
 * `getSelectedEngineName() ?? "codex"`. Cette lecture ne rend que le choix
 * EXPLICITE de l utilisateur : tant qu il n est jamais passe par les
 * Parametres, elle rend `null` et le repli annoncait « Codex ». Or dans ce
 * meme cas `getActiveEngine` retient le premier moteur AUTHENTIFIE par ordre
 * de priorite, qui peut etre Claude ou Antigravity. L interface affichait donc
 * un moteur faux pendant toute la generation, jusqu a ce que la borne terminale
 * le corrige.
 *
 * CE QUE COUTE LA RESOLUTION, ET POURQUOI ELLE EST MEMORISEE. Resoudre le
 * moteur actif appelle `getStatus()` sur les moteurs candidats, et chaque
 * controle d authentification est un `spawnSync` : `codex login status`,
 * `claude auth status`, chacun borne a dix secondes. Mesure du 26 juillet 2026
 * sur le poste de reference : environ 0,07 a 0,36 seconde quand la CLI repond,
 * mais jusqu a dix secondes par moteur quand elle ne repond pas, et le
 * caractere synchrone de l appel GELE le processus principal pendant ce
 * temps-la. L atelier appelle `runPhase` quatre fois par generation : resoudre
 * naivement avant chaque borne `started` aurait rajoute quatre gels, soit
 * exactement la panne que cette branche corrige par ailleurs.
 *
 * D ou les trois etages, du moins cher au plus cher :
 *
 *   1. Un choix explicite en base rend la reponse SANS aucun appel systeme.
 *      C est le cas courant des qu un utilisateur a ouvert les Parametres une
 *      fois, et son cout est identique a celui d avant ce correctif.
 *   2. Sinon, une resolution deja faite recemment est reutilisee : une sonde
 *      par generation au lieu de quatre.
 *   3. Sinon seulement, on resout reellement.
 *
 * Le memo est porte par le registre lui-meme, pas par le module : deux
 * registres distincts (l application, un test) ne peuvent pas se contaminer.
 */

const MOTEUR_PAR_DEFAUT: ExecutionEngine = "codex";

/**
 * Duree de validite du moteur resolu.
 *
 * Ce memo ne sert QUE le cas « aucun choix enregistre ». Le seul ecart qu il
 * peut produire est d annoncer l ancien moteur a un utilisateur qui vient
 * d authentifier un moteur plus prioritaire sans rien choisir dans les
 * Parametres ; la borne terminale porte de toute facon le moteur reellement
 * utilise. Cinq minutes bornent cet ecart sans rendre la sonde a chaque etape.
 */
const MEMO_TTL_MS = 5 * 60_000;

/**
 * Contrat minimal attendu du runner. Volontairement plus petit que
 * `SkillRunnerService` : les montages de test qui n exposent qu une partie de
 * la surface restent acceptes, et l annonce retombe alors sur le defaut, qui
 * est aussi le moteur que le runner utilise quand il n a pas de registre.
 */
type RunnerAnnonceur = {
  getSelectedEngineName?: () => ExecutionEngine | null;
  getEngineRegistry?: () => EngineRegistry | undefined;
};

let memo = new WeakMap<EngineRegistry, { engine: ExecutionEngine; at: number }>();

/** Vide le memo. Reserve aux tests, pour qu ils ne dependent pas de leur ordre. */
export function resetAnnouncedEngineMemo(): void {
  memo = new WeakMap();
}

export async function resolveAnnouncedEngine(
  runner: RunnerAnnonceur
): Promise<ExecutionEngine> {
  const choixExplicite = runner.getSelectedEngineName?.() ?? null;
  if (choixExplicite) {
    return choixExplicite;
  }

  const registry = runner.getEngineRegistry?.();
  if (!registry) {
    // Sans registre, le runner execute sur Codex et estampille « codex » : le
    // defaut n est pas un pis-aller ici, c est le fait.
    return MOTEUR_PAR_DEFAUT;
  }

  const connu = memo.get(registry);
  if (connu && Date.now() - connu.at < MEMO_TTL_MS) {
    return connu.engine;
  }

  try {
    const selection = await registry.getActiveEngine();
    const engine = selection.engine as ExecutionEngine;
    memo.set(registry, { engine, at: Date.now() });
    return engine;
  } catch {
    // Une annonce est un affichage. Elle ne doit JAMAIS faire echouer une
    // generation : si la resolution tombe, l execution qui suit rendra le vrai
    // diagnostic, et la borne terminale le vrai moteur.
    return MOTEUR_PAR_DEFAUT;
  }
}
