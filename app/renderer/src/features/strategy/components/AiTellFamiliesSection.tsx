import { useEffect, useState } from "react";
import { ALL_TELL_FAMILIES, TELL_FAMILIES, type TellFamilyId } from "../../../../../shared/ai-tells";
import { useToast } from "../../../design-system/primitives";
import { SectionHead } from "./SectionHead";
import {
  AI_TELL_FAMILIES_PREFERENCE_KEY,
  parseTellFamiliesPreference
} from "../../ai-tells/tellsPreference";

/**
 * Section « Marqueurs d'écriture IA » de l'onglet Voix. Les neuf familles
 * viennent du moteur partagé `ai-tells.ts` (libellés et descriptions rédigés
 * une seule fois dans `TELL_FAMILIES`, jamais réécrits ici). Cocher une
 * famille l'interdit à la génération via la préférence `ai_tell_families`,
 * lue au montage et écrite à chaque bascule : même mécanisme que
 * `ThemeSelector`, avec la même limite (un changement ne se propage pas tout
 * seul ailleurs dans l'application). Une écriture qui échoue est en revanche
 * annulée à l'écran, pas ignorée : voir `toggle`.
 */
export function AiTellFamiliesSection() {
  const toast = useToast();
  const [enabled, setEnabled] = useState<TellFamilyId[]>([...ALL_TELL_FAMILIES]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    window.linkedinPoster.settings
      .getPreference(AI_TELL_FAMILIES_PREFERENCE_KEY)
      .then(({ value }: { value: string | null }) => {
        const parsed = parseTellFamiliesPreference(value);
        if (parsed) setEnabled(parsed);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function toggle(id: TellFamilyId) {
    const previous = enabled;
    const next = enabled.includes(id)
      ? enabled.filter((familyId) => familyId !== id)
      : [...enabled, id];
    setEnabled(next);
    window.linkedinPoster.settings
      .setPreference(AI_TELL_FAMILIES_PREFERENCE_KEY, JSON.stringify(next))
      // Base en lecture seule, disque plein : l ecriture echoue et la case
      // restait cochee. L interface affirmait alors qu une famille etait
      // interdite pendant que la generation continuait d appliquer l ancienne
      // preference. On revient a l etat reellement enregistre et on le dit.
      .catch(() => {
        setEnabled(previous);
        toast.show({
          kind: "error",
          message:
            "Impossible d'enregistrer ce réglage. La génération garde la préférence précédente."
        });
      });
  }

  return (
    <section className="strategy-section" aria-label="Marqueurs d'écriture IA">
      <SectionHead
        title="Marqueurs d'écriture IA"
        lead="Cocher une famille l'interdit à la génération. Toutes sont cochées par défaut : décochez celles que vous tolérez dans vos posts."
      />

      <div className="strategy-tells">
        {TELL_FAMILIES.map((family) => (
          <div key={family.id} className="strategy-surface strategy-tell">
            <label className="strategy-check">
              <input
                type="checkbox"
                checked={enabled.includes(family.id)}
                disabled={!loaded}
                onChange={() => toggle(family.id)}
              />
              <span>{family.label}</span>
            </label>
            <p className="strategy-tell__description">{family.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
