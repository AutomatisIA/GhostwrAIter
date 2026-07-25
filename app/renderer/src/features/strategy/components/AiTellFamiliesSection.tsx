import { useEffect, useState } from "react";
import { ALL_TELL_FAMILIES, TELL_FAMILIES, type TellFamilyId } from "../../../../../shared/ai-tells";
import { Card } from "../../../design-system/primitives";
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
    <section className="editor-section">
      <div className="section-heading">
        <div>
          <h2>Marqueurs d'écriture IA</h2>
          <p>
            Cocher une famille l'interdit à la génération. Toutes sont cochées par défaut :
            décochez celles que vous tolérez dans vos posts.
          </p>
        </div>
      </div>

      <div className="ai-tell-families-grid">
        {TELL_FAMILIES.map((family) => (
          <Card key={family.id} elevation={1} className="ai-tell-family-card">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={enabled.includes(family.id)}
                disabled={!loaded}
                onChange={() => toggle(family.id)}
              />
              {family.label}
            </label>
            <p className="ai-tell-family-description">{family.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
