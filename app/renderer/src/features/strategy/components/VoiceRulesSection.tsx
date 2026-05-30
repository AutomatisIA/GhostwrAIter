import type { StrategyBundleInput } from "@shared/schemas/strategy";
import { Button, Card, EmptyState, Field } from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
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
          <h2 className="section-title-with-hint">
            Règles de voix
            <InfoHint term="voix" />
          </h2>
          <p>Ces règles évitent les rendus fades, trop corporate ou déconnectés du terrain.</p>
        </div>
        <Button variant="secondary" onClick={onAdd}>
          Ajouter une règle de voix
        </Button>
      </div>

      <CompletenessIndicator
        filled={Math.min(voiceRules.length, 5)}
        total={5}
        critical={voiceRules.length === 0}
        impactedSkill="post-writer"
      />

      {voiceRules.length === 0 ? (
        <Card elevation={1}>
          <EmptyState
            title="Aucune règle de voix"
            description="Posez quelques règles de ton : ce qu'il faut faire, ce qu'il faut éviter et les formats imposés. L'assistant rédigera des posts qui vous ressemblent."
            action={{ label: "Ajouter une règle de voix", onClick: onAdd }}
          />
        </Card>
      ) : null}

      {voiceRules.map((rule, index) => (
        <Card key={`voice-rule-${index}`} elevation={1} className="editor-card">
          <div className="section-heading compact">
            <strong>Règle {index + 1}</strong>
            <Button variant="danger" size="sm" onClick={() => onRemove(index)}>
              Retirer
            </Button>
          </div>

          <div className="strategy-fields">
            <Field
              label="Catégorie"
              htmlFor={`voice-category-${index}`}
              hint="Un regroupement libre pour vous y retrouver."
              example="Anti-style, Format, Ton."
            >
              <input
                value={rule.category}
                onChange={(event) => onUpdate(index, "category", event.target.value)}
                placeholder="Ex. Anti-style"
              />
            </Field>

            <Field
              label="Type de règle"
              htmlFor={`voice-type-${index}`}
              hint="Indique comment l'assistant doit traiter cette règle."
            >
              <select
                value={rule.ruleType}
                onChange={(event) => onUpdate(index, "ruleType", event.target.value)}
              >
                <option value="do">À faire</option>
                <option value="dont">À éviter</option>
                <option value="anti_style">Anti-style</option>
                <option value="format_rule">Règle de format</option>
              </select>
            </Field>

            <Field
              label={`Texte de la règle ${index + 1}`}
              htmlFor={`voice-text-${index}`}
              hint="La consigne, formulée simplement et sans ambiguïté."
              example="Pas de jargon, pas de promesse miracle."
            >
              <textarea
                rows={2}
                value={rule.ruleText}
                onChange={(event) => onUpdate(index, "ruleText", event.target.value)}
                placeholder="Ex. Pas de jargon, pas de promesse miracle"
              />
            </Field>
          </div>
        </Card>
      ))}
    </section>
  );
}
