/**
 * Extraction des mots-cles d un brouillon.
 *
 * La version d origine retenait tout mot d au moins cinq lettres, ce qui
 * produisait surtout du bruit : sur la base reelle, 51 tags pour 15 brouillons,
 * dont « donner », « aujourd », « envisagent », « laisse », « desormais ».
 * Melanges aux tags utiles sans hierarchie visuelle, ils rendaient la recherche
 * inutilisable (cf. docs/audit-2026-07-ui-ux.md et audit-2026-07-fonctionnel.md).
 *
 * Le filtrage ci-dessous ne cherche pas a etre linguistiquement exact. Il vise
 * un objectif simple et verifiable : qu un tag affiche apprenne quelque chose
 * sur le contenu du post.
 */

/**
 * Mots vides du francais, plus les verbes et adverbes passe-partout qui
 * dominaient les tags observes. Un mot de cette liste ne distingue jamais un
 * post d un autre.
 */
const STOPWORDS = new Set([
  // determinants, pronoms, conjonctions longs
  "leurs", "leur", "cette", "cettes", "celui", "celle", "ceux", "celles",
  "notre", "votre", "nos", "vos", "dont", "lequel", "laquelle", "quelle",
  "quels", "quelles", "chaque", "certains", "certaines", "plusieurs", "meme",
  "memes", "autre", "autres", "tous", "toutes", "toute", "aucun", "aucune",
  // adverbes et connecteurs
  "aujourd", "hui", "ensuite", "alors", "aussi", "encore", "toujours",
  "jamais", "souvent", "parfois", "surtout", "vraiment", "simplement",
  "seulement", "notamment", "cependant", "pourtant", "ainsi", "donc",
  "quand", "comme", "pendant", "avant", "apres", "depuis", "entre", "sans",
  "avec", "pour", "dans", "chez", "selon", "vers", "moins", "plus",
  "beaucoup", "trop", "assez", "bien", "tres", "peut", "peuvent",
  // verbes passe-partout, formes frequentes
  "etre", "avoir", "faire", "faites", "faisant", "donner", "donne", "donnent",
  "prendre", "prend", "prennent", "mettre", "mettent", "aller", "vient",
  "viennent", "devient", "deviennent", "permet", "permettent", "permettre",
  "laisse", "laissent", "laisser", "reste", "restent", "rester", "passe",
  "passent", "devoir", "doivent", "voulez", "veulent", "savoir", "savent",
  "existe", "existent", "trouve", "trouvent", "utilise", "utilisent",
  "utiliser", "envisage", "envisagent", "envisager", "demande", "demandent",
  "demander", "generer", "genere", "generent", "creer", "cree", "creent",
  "ameliorer", "ameliore", "commence", "commencent", "commencer",
  "arrive", "arrivent", "montre", "montrent", "produit", "produisent",
  // mots de structure editoriale, sans valeur descriptive
  "exemple", "exemples", "point", "points", "cas", "chose", "choses",
  "maniere", "facon", "sorte", "partie", "moment", "moments", "fois",
  "temps", "jour", "jours", "annee", "annees", "niveau", "place",
  "desormais", "quotidien", "quotidiens", "quotidiennes"
]);

/**
 * Forme de comparaison d un token : sans accents ni signes diacritiques.
 *
 * La liste des mots vides est ecrite sans accents, comme le reste du depot,
 * alors que les tokens les conservent. La comparaison directe laissait donc
 * passer toute forme accentuee de mot vide : sur la base reelle, `desormais`
 * etait rejete et `desormais` accentue etait retenu comme mot-cle. Le test qui
 * couvrait cette regle utilisait la forme non accentuee, donc il restait vert.
 *
 * L accent est retire pour DECIDER, jamais pour restituer : le tag affiche
 * garde son orthographe.
 */
function normalizeForLookup(token: string): string {
  return token.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Un mot-cle utile est assez long pour porter du sens, n est pas un mot vide,
 * et n est pas un nombre. Le seuil est monte de 5 a 6 lettres : en francais,
 * la tranche de 5 lettres est massivement occupee par des formes verbales et
 * des connecteurs.
 */
function isMeaningful(token: string): boolean {
  if (token.length < 6) return false;
  if (STOPWORDS.has(normalizeForLookup(token))) return false;
  if (/^\d+$/.test(token)) return false;
  return true;
}

export function tokenizeTags(input: string): string[] {
  return Array.from(
    new Set(
      (input ?? "")
        .toLowerCase()
        .split(/[^a-z0-9à-ÿ]+/i)
        .filter(isMeaningful)
    )
  ).slice(0, 6);
}
