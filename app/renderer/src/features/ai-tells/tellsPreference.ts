import { ALL_TELL_FAMILIES, type TellFamilyId } from "../../../../shared/ai-tells";

/**
 * Cle de preference partagee par les deux points d'entree renderer du module
 * anti-IA : la section de reglage dans l'onglet Voix (ecrit) et le rapport de
 * detection affiche sur le brouillon dans DraftPanel (lit). Le processus
 * principal lit la meme cle pour construire les contraintes de prompt
 * (`buildTellConstraints`), donc ce nom ne doit pas changer sans coordination.
 */
export const AI_TELL_FAMILIES_PREFERENCE_KEY = "ai_tell_families";

/**
 * Decode la valeur brute stockee par `settings.getPreference`. Cette
 * preference n'est lue qu'au montage de chaque composant, jamais propagee en
 * direct entre eux : chaque lecteur refait l'appel lui-meme (meme mecanisme
 * que le theme, cf. ThemeSelector).
 *
 * `null` (aucune preference enregistree) ou une valeur illisible renvoient
 * `undefined` : l'appelant applique alors son propre defaut. `detectTells` et
 * `buildTellConstraints` considerent tous deux "toutes les familles actives"
 * quand aucune liste n'est fournie, donc `undefined` reproduit ce defaut sans
 * qu'il faille le redupliquer ici. Un tableau vide stocke explicitement est en
 * revanche respecte tel quel : il signifie que l'utilisateur a decoche toutes
 * les familles, ce qui est un choix valide, pas une absence de reglage.
 */
export function parseTellFamiliesPreference(raw: string | null): TellFamilyId[] | undefined {
  if (raw === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const valid = new Set<string>(ALL_TELL_FAMILIES);
    return parsed.filter((id): id is TellFamilyId => typeof id === "string" && valid.has(id));
  } catch {
    return undefined;
  }
}
