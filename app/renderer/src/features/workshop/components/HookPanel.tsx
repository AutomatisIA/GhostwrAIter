import { motion } from "motion/react";
import type { HookOption } from "@shared/types/workshop";
import { Button, Card, Skeleton } from "../../../design-system/primitives";
import { InfoHint } from "../../../help";
import { fadeInUp, staggerContainer, useMotionVariants } from "../../../design-system/motion/variants";

type HookPanelProps = {
  hooks: HookOption[];
  selectedHookId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
  isLoadingNext: boolean;
};

export function HookPanel({
  hooks,
  selectedHookId,
  onSelect,
  onBack,
  onNext,
  isLoading,
  isLoadingNext
}: HookPanelProps) {
  const container = useMotionVariants(staggerContainer);
  const item = useMotionVariants(fadeInUp);

  return (
    <div className="workshop-step">
      <h2>
        Choisis ton accroche <InfoHint term="accroche" />
      </h2>
      <p className="step-description">
        L'accroche sert à faire entrer le lecteur dans le sujet. Le score
        donne un signal de potentiel, pas une vérité absolue.
      </p>
      {isLoading ? (
        <div className="list-selection" aria-busy="true" aria-label="Chargement des accroches">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      ) : (
        <motion.div
          className="list-selection"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {hooks.map((h) => {
            const selected = selectedHookId === h.id;
            return (
              <motion.div key={h.id} variants={item}>
                <Card
                  interactive
                  elevation={selected ? 2 : 1}
                  className={`selection-card list-card ${selected ? "selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onSelect(h.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(h.id);
                    }
                  }}
                >
                  <div className="status-label">{h.family}</div>
                  <p>{h.text}</p>
                  <div className="score-badge">{Math.round(h.score * 100)}%</div>
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
          disabled={isLoading || isLoadingNext || hooks.length === 0}
        >
          {isLoadingNext ? "Génération en cours…" : "Générer le draft final"}
        </Button>
      </div>
    </div>
  );
}
