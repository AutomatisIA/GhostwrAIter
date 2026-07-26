import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Selecteur des elements atteignables au clavier dans un dialogue.
 * `[tabindex="-1"]` est exclu : ces elements recoivent le focus par programme
 * (le titre de la visite guidee) mais ne participent pas au cycle de tabulation.
 */
const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Clavier et focus d un dialogue modal.
 *
 * Deux defauts corriges ici, tous deux nes du meme choix : le gestionnaire de
 * touches etait pose sur le `div` du dialogue, via `onKeyDown` de React.
 *
 * 1. UN CLIC SUR LE TEXTE PERCAIT LE PIEGE. Le conteneur n est pas focusable :
 *    cliquer sur le message (« … sera définitivement supprimé de votre
 *    bibliothèque ») renvoie le focus sur `<body>`. Les touches suivantes
 *    partent alors de `body`, hors de l arbre React du dialogue, donc son
 *    `onKeyDown` ne se declenche plus : Echap ne fermait plus rien et Tab
 *    sortait du dialogue vers la page situee DERRIERE le voile, ou le focus
 *    devenait invisible. L ecoute passe donc sur `document`, seul niveau que le
 *    focus ne peut pas quitter.
 *
 * 2. LE FOCUS N ETAIT PAS RENDU. A la fermeture, le dialogue se demonte et le
 *    focus retombe sur `body` : la tabulation suivante repart du haut de
 *    l application. L element qui avait ouvert le dialogue est memorise a
 *    l ouverture et refocalise a la fermeture. La Bibliotheque appliquait deja
 *    ce soin a son panneau d actions secondaires ; les dialogues, plus modaux
 *    encore, ne l avaient pas.
 */
export function useDialogKeyboard(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void
): void {
  /** Element focalise juste avant l ouverture, a qui rendre la main. */
  const declencheur = useRef<Element | null>(null);

  /**
   * Memorisation et restitution du focus, en effet de DISPOSITION et non en
   * effet passif. React joue tous les effets de disposition avant tous les
   * effets passifs : la capture precede donc le focus initial que le dialogue
   * pose lui-meme sur « Annuler », quel que soit l ordre de declaration des
   * hooks dans le composant. Ecrit en `useEffect`, ce bloc memorisait « Annuler »
   * a la place du bouton qui avait ouvert le dialogue, puis renoncait a la
   * restitution parce que ce bouton-la venait d etre demonte : le focus
   * retombait sur `body`, exactement le defaut a corriger, mais silencieusement.
   */
  useLayoutEffect(() => {
    if (!open) return undefined;

    declencheur.current = document.activeElement;

    return () => {
      const cible = declencheur.current;
      // `isConnected` : le declencheur peut avoir disparu avec le contenu que le
      // dialogue vient de modifier (supprimer un brouillon demonte sa ligne).
      // Focaliser un noeud detache ne fait rien et laisse le focus sur `body`,
      // ce qui est l etat qu on cherche a eviter ; on s abstient plutot que de
      // donner l illusion d avoir rendu la main.
      if (cible instanceof HTMLElement && cible.isConnected) cible.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      const premier = focusables[0];
      const dernier = focusables[focusables.length - 1];
      if (!premier || !dernier) return;

      const actif = document.activeElement;
      // Focus hors du dialogue (clic sur le texte, ou premiere tabulation apres
      // un tel clic) : on le ramene dedans plutot que de comparer un element
      // etranger a `premier`/`dernier`.
      if (!actif || !dialog.contains(actif)) {
        event.preventDefault();
        premier.focus();
        return;
      }
      if (event.shiftKey && actif === premier) {
        event.preventDefault();
        dernier.focus();
      } else if (!event.shiftKey && actif === dernier) {
        event.preventDefault();
        premier.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, dialogRef, onClose]);
}
