/**
 * Extrait le contrat JSON d une skill de la sortie brute d un CLI.
 *
 * Les trois CLI ne rendent pas la meme chose. Codex ecrit le contrat tel quel,
 * mais `claude --print --output-format json` encadre la
 * reponse du modele dans leur PROPRE enveloppe : le contrat de la skill s y
 * trouve sous forme de chaine, dans `result` pour Claude. Sans deballage,
 * `JSON.parse` reussit sur l enveloppe et le contrat parait invalide, ce qui
 * rendait Claude inutilisable.
 *
 * La cle `response` est conservee bien que le moteur qui l employait, Gemini
 * CLI, ait ete remplace par Antigravity le 25 juillet 2026. Antigravity rend la
 * reponse brute, sans enveloppe : ce deballage ne lui sert pas. Il est garde
 * parce qu il ne coute rien, qu il est couvert par un test, et qu un moteur
 * futur employant cette forme tres repandue serait sinon inutilisable pour la
 * meme raison exactement, et diagnostique aussi difficilement.
 *
 * Un modele peut en outre encadrer sa reponse de delimiteurs markdown malgre la
 * consigne contraire du preambule. On les retire donc aussi, a chaque niveau.
 */

const FENCE = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/;

function stripFence(value: string): string {
  const trimmed = value.trim();
  const match = FENCE.exec(trimmed);
  return match?.[1]?.trim() ?? trimmed;
}

function parseObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Un objet est une enveloppe de CLI, et non un contrat de skill, uniquement s il
 * ne porte PAS `status` en premier niveau. Ce garde-fou evite de deballer par
 * erreur un contrat de skill qui contiendrait lui-meme une cle `result`.
 */
function unwrapOnce(value: string): string | null {
  const parsed = parseObject(value);
  if (!parsed || typeof parsed.status === "string") {
    return null;
  }

  const inner = parsed.result ?? parsed.response;
  return typeof inner === "string" ? stripFence(inner) : null;
}

export function extractSkillPayload(raw: string): string {
  let current = stripFence(raw);

  // Deballage borne : une enveloppe de CLI n en contient jamais dix. La borne
  // protege d une sortie construite pour boucler.
  for (let depth = 0; depth < 5; depth += 1) {
    const unwrapped = unwrapOnce(current);
    if (unwrapped === null) break;
    current = unwrapped;
  }

  return current;
}
