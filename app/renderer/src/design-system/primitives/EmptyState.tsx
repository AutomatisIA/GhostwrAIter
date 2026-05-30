import React from "react";
import { Button } from "./Button";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  illustration?: React.ReactNode;
}

/**
 * Etat vide pedagogique (T015, FR-013). Affiche par toute liste/ecran vide
 * et propose une prochaine action concrete.
 */
export function EmptyState({ title, description, action, illustration }: EmptyStateProps) {
  return (
    <div className="ds-empty-state" role="status">
      {illustration ? (
        <div className="ds-empty-state__illustration" aria-hidden="true">
          {illustration}
        </div>
      ) : null}
      <h3 className="ds-empty-state__title">{title}</h3>
      <p className="ds-empty-state__description">{description}</p>
      {action ? (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
