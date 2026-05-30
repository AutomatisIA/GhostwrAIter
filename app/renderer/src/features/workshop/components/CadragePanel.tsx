import { motion } from "motion/react";
import type { PostObjective, PostTypology } from "@shared/types/workshop";
import { Button, Card } from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
import { fadeInUp, staggerContainer, useMotionVariants } from "../../../design-system/motion/variants";
import { OBJECTIVES, TYPOLOGIES } from "../constants";

type CadragePanelProps = {
  typology: PostTypology;
  onTypologyChange: (typology: PostTypology) => void;
  objective: PostObjective;
  onObjectiveChange: (objective: PostObjective) => void;
  onNext: () => void;
  isLoading: boolean;
};

export function CadragePanel({
  typology,
  onTypologyChange,
  objective,
  onObjectiveChange,
  onNext,
  isLoading
}: CadragePanelProps) {
  const container = useMotionVariants(staggerContainer);
  const item = useMotionVariants(fadeInUp);

  return (
    <div className="workshop-step">
      <h3>
        Choisis le cadrage <InfoHint term="cadrage" />
      </h3>
      <p className="step-description">
        Commence par définir le type de post et son objectif prioritaire.
        Cela sert à orienter la structure et le niveau de tension du draft.
      </p>

      <div className="input-group">
        <label className="ds-field__label">
          Typologie <InfoHint term="typologie" />
        </label>
        <motion.div
          className="grid-selection"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {TYPOLOGIES.map((t) => {
            const selected = typology === t.value;
            return (
              <motion.div key={t.value} variants={item}>
                <Card
                  interactive
                  elevation={selected ? 2 : 1}
                  className={`selection-card ${selected ? "selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onTypologyChange(t.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onTypologyChange(t.value);
                    }
                  }}
                >
                  <strong>{t.label}</strong>
                  <p>{t.description}</p>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <div className="input-group">
        <label htmlFor="cadrage-objective" className="ds-field__label">
          Objectif prioritaire <InfoHint term="objectif" />
        </label>
        <select
          id="cadrage-objective"
          value={objective}
          onChange={(e) => onObjectiveChange(e.target.value as PostObjective)}
          disabled={isLoading}
        >
          {OBJECTIVES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-actions">
        <Button variant="primary" onClick={onNext} loading={isLoading} disabled={isLoading}>
          {isLoading ? "Génération en cours…" : "Suivant : structure"}
        </Button>
      </div>
    </div>
  );
}
