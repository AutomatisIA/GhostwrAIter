import type { StrategyBundleInput } from "@shared/schemas/strategy";
import { CompletenessIndicator } from "./CompletenessIndicator";

type VoiceRulesSectionProps = {
  voiceRules: StrategyBundleInput["voiceRules"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    field: keyof StrategyBundleInput["voiceRules"][number],
    value: string
  ) => void;
};

export function VoiceRulesSection({
  voiceRules,
  onAdd,
  onRemove,
  onUpdate
}: VoiceRulesSectionProps) {
  return (
    <section className="editor-section">
      <div className="section-heading">
        <div>
          <h2>Regles de voix</h2>
          <p>Ces regles evitent les rendus fades, trop corporate ou deconnectes du terrain.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onAdd}>
          Ajouter une regle de voix
        </button>
      </div>

      <CompletenessIndicator
        filled={Math.min(voiceRules.length, 5)}
        total={5}
        critical={voiceRules.length === 0}
        impactedSkill="post-writer"
      />

      {voiceRules.map((rule, index) => (
        <article key={`voice-rule-${index}`} className="editor-card">
          <div className="section-heading compact">
            <strong>Regle {index + 1}</strong>
            <button
              type="button"
              className="secondary-button danger-button"
              onClick={() => onRemove(index)}
            >
              Retirer
            </button>
          </div>

          <label className="field">
            <span>Categorie</span>
            <input
              value={rule.category}
              onChange={(event) => onUpdate(index, "category", event.target.value)}
              placeholder="Ex. Anti-style"
            />
          </label>

          <label className="field">
            <span>Type de regle</span>
            <select
              value={rule.ruleType}
              onChange={(event) => onUpdate(index, "ruleType", event.target.value)}
            >
              <option value="do">A faire</option>
              <option value="dont">A eviter</option>
              <option value="anti_style">Anti-style</option>
              <option value="format_rule">Regle de format</option>
            </select>
          </label>

          <label className="field">
            <span>Texte de la regle {index + 1}</span>
            <textarea
              aria-label={`Texte de la regle ${index + 1}`}
              rows={2}
              value={rule.ruleText}
              onChange={(event) => onUpdate(index, "ruleText", event.target.value)}
              placeholder="Ex. Pas de jargon, pas de promesse miracle"
            />
          </label>
        </article>
      ))}
    </section>
  );
}
