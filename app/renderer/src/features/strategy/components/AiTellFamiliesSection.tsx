import { useEffect, useState } from "react";
import { ALL_TELL_FAMILIES, TELL_FAMILIES, type TellFamilyId } from "../../../../../shared/ai-tells";
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
 * seul ailleurs dans l'application).
 */
export function AiTellFamiliesSection() {
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
    const next = enabled.includes(id)
      ? enabled.filter((familyId) => familyId !== id)
      : [...enabled, id];
    setEnabled(next);
    window.linkedinPoster.settings
      .setPreference(AI_TELL_FAMILIES_PREFERENCE_KEY, JSON.stringify(next))
      .catch(() => {});
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
