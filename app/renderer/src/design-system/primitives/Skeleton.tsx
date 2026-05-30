import React from "react";

export interface SkeletonProps {
  variant?: "text" | "card" | "block";
  count?: number;
  className?: string;
}

/**
 * Placeholder de chargement (T013). Reserve l'espace (aucun saut de layout).
 * Le shimmer est neutralise par la regle globale prefers-reduced-motion
 * (styles.css). `aria-hidden` : purement decoratif, le statut de chargement
 * est porte par le conteneur applicatif (aria-busy / region live).
 */
export function Skeleton({ variant = "text", count = 1, className }: SkeletonProps) {
  const items = Array.from({ length: Math.max(1, count) });
  return (
    <>
      {items.map((_, index) => (
        <span
          key={index}
          className={["ds-skeleton", className].filter(Boolean).join(" ")}
          data-variant={variant}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
