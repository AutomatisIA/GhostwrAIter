import type { StrategyBundleInput } from "@shared/schemas/strategy";
import { Button, EmptyState } from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
import { CompletenessIndicator } from "./CompletenessIndicator";
import { SectionHead } from "./SectionHead";
import { StrategyField } from "./StrategyField";
import { isFilled } from "./completeness-text";

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
  const complete = voiceRules.filter((rule) => isFilled(rule.ruleText)).length;
  const incomplete = voiceRules.length - complete;

  let consequence: string | null = null;
  if (voiceRules.length === 0) {
    consequence =
      "Aucune règle de voix. Les posts prendront un ton par défaut, plus lisse et plus corporate que le vôtre, sans que la génération échoue. Il n'y a pas de nombre imposé.";
  } else if (incomplete > 0) {
    consequence = `${incomplete} règle${incomplete > 1 ? "s" : ""} sans texte. Elle${
      incomplete > 1 ? "s seront ignorées" : " sera ignorée"
    } à la génération, sans que celle-ci échoue.`;
  }

  return (
    <section className="strategy-section" aria-label="Règles de voix">
      <SectionHead
        title="Règles de voix"
        hint={<InfoHint term="voix" />}
        lead="Ces règles évitent les rendus fades, trop corporate ou déconnectés du terrain."
        action={
          <Button variant="secondary" onClick={onAdd}>
            Ajouter une règle de voix
          </Button>
        }
      />

      <CompletenessIndicator
        filled={complete}
        total={voiceRules.length}
        unitOne="règle"
        unitMany="règles"
        emptyLabel="Aucune règle"
        consequence={consequence}
      />

      {voiceRules.length === 0 ? (
        <div className="strategy-surface strategy-empty">
          <EmptyState
            title="Aucune règle de voix"
            description="Posez quelques règles de ton : ce qu'il faut faire, ce qu'il faut éviter et les formats imposés. L'assistant rédigera des posts qui vous ressemblent."
            action={{ label: "Ajouter une règle de voix", onClick: onAdd }}
          />
        </div>
      ) : null}

      {voiceRules.map((rule, index) => (
        <section
          key={`voice-rule-${index}`}
          className="strategy-surface strategy-item"
          aria-label={`Règle ${index + 1}`}
        >
          <div className="strategy-item__head">
            <span className="strategy-item__title">Règle {index + 1}</span>
            <Button variant="danger" size="sm" onClick={() => onRemove(index)}>
              Retirer
            </Button>
          </div>

          <StrategyField
            field="voice-category"
            controlId={`voice-category-${index}`}
            label="Catégorie"
            help="Un regroupement libre pour vous y retrouver."
          >
            <input
              value={rule.category}
              onChange={(event) => onUpdate(index, "category", event.target.value)}
              placeholder="Ex. Anti-style, Format, Ton"
            />
          </StrategyField>

          <StrategyField
            field="voice-type"
            controlId={`voice-type-${index}`}
            label="Type de règle"
            help="Indique comment l'assistant doit traiter cette règle."
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
          </StrategyField>

          <StrategyField
            field="voice-text"
            controlId={`voice-text-${index}`}
            label="Texte de la règle"
            help="La consigne, formulée simplement et sans ambiguïté."
            align="start"
          >
            <textarea
              value={rule.ruleText}
              onChange={(event) => onUpdate(index, "ruleText", event.target.value)}
              placeholder="Ex. Pas de jargon, pas de promesse miracle."
            />
          </StrategyField>
        </section>
      ))}
    </section>
  );
}
