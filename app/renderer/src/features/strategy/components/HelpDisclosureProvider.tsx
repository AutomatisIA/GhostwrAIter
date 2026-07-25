import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  HelpDisclosureContext,
  STRATEGY_HELP_PREFERENCE_KEY,
  parseHelpDisclosurePreference,
  type HelpDisclosureApi,
  type HelpFieldId
} from "./strategy-help";

/**
 * Porte l etat de repli des aides et sa persistance.
 *
 * Deux gardes, toutes deux nees d un defaut classique de ce montage :
 *   - aucune ecriture avant que la lecture initiale ait resolu, sinon le
 *     premier rendu ecraserait l etat enregistre par un objet vide ;
 *   - la valeur lue n est appliquee que si l utilisateur n a encore rien
 *     bascule, sinon une lecture lente annulerait son premier clic.
 * L echec de lecture comme d ecriture est absorbe : le repli est un confort
 * d affichage, il ne doit jamais empecher la saisie de la strategie.
 */
export function HelpDisclosureProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const loadedRef = useRef(false);
  const touchedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    window.linkedinPoster.settings
      .getPreference(STRATEGY_HELP_PREFERENCE_KEY)
      .then(({ value }: { value: string | null }) => {
        if (!isMounted || touchedRef.current) return;
        const parsed = parseHelpDisclosurePreference(value);
        if (parsed) setExpanded(parsed);
      })
      .catch(() => {})
      .finally(() => {
        loadedRef.current = true;
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loadedRef.current || !touchedRef.current) return;
    window.linkedinPoster.settings
      .setPreference(STRATEGY_HELP_PREFERENCE_KEY, JSON.stringify(expanded))
      .catch(() => {});
  }, [expanded]);

  const toggle = useCallback((field: HelpFieldId) => {
    touchedRef.current = true;
    setExpanded((current) => {
      const next = { ...current };
      if (next[field]) delete next[field];
      else next[field] = true;
      return next;
    });
  }, []);

  const setFields = useCallback((fields: readonly HelpFieldId[], open: boolean) => {
    touchedRef.current = true;
    setExpanded((current) => {
      const next = { ...current };
      for (const field of fields) {
        if (open) next[field] = true;
        else delete next[field];
      }
      return next;
    });
  }, []);

  const api = useMemo<HelpDisclosureApi>(
    () => ({
      isOpen: (field) => expanded[field] === true,
      toggle,
      setFields
    }),
    [expanded, toggle, setFields]
  );

  return <HelpDisclosureContext.Provider value={api}>{children}</HelpDisclosureContext.Provider>;
}
