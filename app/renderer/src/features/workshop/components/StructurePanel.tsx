import { motion } from "motion/react";
import type { StructureOption } from "@shared/types/workshop";
import { Button, Card, Skeleton } from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
import { fadeInUp, staggerContainer, useMotionVariants } from "../../../design-system/motion/variants";

type StructurePanelProps = {
  structures: StructureOption[];
  selectedStructureKey: string;
  onSelect: (key: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
  isLoadingNext: boolean;
};

export function StructurePanel({
  structures,
  selectedStructureKey,
  onSelect,
  onBack,
  onNext,
  isLoading,
  isLoadingNext
}: StructurePanelProps) {
  const container = useMotionVariants(staggerContainer);
  const item = useMotionVariants(fadeInUp);

  return (
    <div className="workshop-step">
      <h3>
        Sélectionne une structure narrative <InfoHint term="structure" />
      </h3>
      <p className="step-description">
        La structure détermine l'ordre du raisonnement. Choisis celle qui
        sert le mieux l'idée et l'objectif retenu.
      </p>
      {isLoading ? (
        <div className="grid-selection" aria-busy="true" aria-label="Chargement des structures">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      ) : (
        <motion.div
          className="grid-selection"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {structures.map((s, index) => {
            const selected = selectedStructureKey === s.key;
            return (
              <motion.div key={s.key} variants={item}>
                <Card
                  interactive
                  elevation={selected ? 2 : 1}
                  className={`selection-card ${selected ? "selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onSelect(s.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(s.key);
                    }
                  }}
                >
                  {index === 0 ? (
                    <span className="recommended-badge">Recommandée</span>
                  ) : null}
                  <strong>{s.label}</strong>
                  <p>{s.rationale}</p>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
      <div className="form-actions">
        <Button variant="ghost" onClick={onBack}>
          Retour
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          loading={isLoadingNext}
          disabled={isLoading || isLoadingNext || structures.length === 0}
        >
          {isLoadingNext ? "Génération en cours…" : "Suivant : accroche"}
        </Button>
      </div>
    </div>
  );
}
