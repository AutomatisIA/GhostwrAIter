/*
 * Annonce d un changement de moteur actif, a l interieur du renderer.
 *
 * Le pied de la barre laterale et le panneau des Parametres lisent le meme fait
 * par deux appels IPC independants, et vivent dans deux branches de l arbre que
 * rien ne relie : le pied est monte par la coque, qui ne se remonte jamais. Sans
 * ce signal, selectionner Antigravity affichait le toast « Antigravity est
 * maintenant votre moteur IA actif » pendant que le pied continuait d annoncer
 * « Codex (ChatGPT), connecté » jusqu au redemarrage. Le pied existe precisement
 * pour dire quel moteur travaille : le laisser mentir lui retire sa seule raison
 * d etre.
 *
 * Un evenement de fenetre plutot qu un contexte React : les deux lecteurs n ont
 * pas d ancetre commun autre que la racine, et y poser un fournisseur pour un
 * seul fait ferait passer tout l arbre par un rendu a chaque changement. Le
 * canal reste strictement interne au renderer, aucun contrat IPC n est touche.
 */

/*
 * Le fait annonce est « le moteur actif, tel qu il sera utilise » : son nom
 * comme son etat d authentification. Une detection fraiche compte donc autant
 * qu une selection. L utilisateur se connecte a son moteur dans un terminal,
 * hors de l application ; en revenant aux Parametres, le panneau redetecte et
 * affiche « Connecté » pendant que le pied, faute d annonce, continue d annoncer
 * « non authentifié ». Deux affirmations contradictoires a deux centimetres
 * l une de l autre, et c est la plus discrete qui est fausse.
 */

export const ACTIVE_ENGINE_CHANGED = "ghostwraiter:active-engine-changed";

/**
 * A appeler APRES que le processus principal a confirme le changement, ou
 * apres une detection qui vient de rafraichir l etat des moteurs.
 */
export function annoncerChangementDeMoteur(): void {
  window.dispatchEvent(new CustomEvent(ACTIVE_ENGINE_CHANGED));
}

/** Abonne `ecouteur` au changement. Rend la fonction de desabonnement. */
export function surChangementDeMoteur(ecouteur: () => void): () => void {
  window.addEventListener(ACTIVE_ENGINE_CHANGED, ecouteur);
  return () => window.removeEventListener(ACTIVE_ENGINE_CHANGED, ecouteur);
}
