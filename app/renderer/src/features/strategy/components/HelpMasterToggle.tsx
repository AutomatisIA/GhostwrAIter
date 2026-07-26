import { useHelpDisclosure, type HelpFieldId } from "./strategy-help";

/**
 * Bascule globale des aides, alignee a droite de la barre d onglets.
 *
 * Elle porte sur les aides de l onglet affiche, pas sur les six onglets a la
 * fois : le libelle doit decrire ce que le clic va faire a l ecran que
 * l utilisateur a sous les yeux, sinon « Replier toutes les aides » resterait
 * affiche alors que la page devant lui n en montre aucune.
 */
export function HelpMasterToggle({ fields }: { fields: readonly HelpFieldId[] }) {
  const disclosure = useHelpDisclosure();
  if (fields.length === 0) return null;

  const allOpen = fields.every((field) => disclosure.isOpen(field));

  return (
    <button
      type="button"
      className="strategy-help-master"
      onClick={() => disclosure.setFields(fields, !allOpen)}
    >
      {allOpen ? "Replier toutes les aides" : "Déplier toutes les aides"}
    </button>
  );
}
