import React, { forwardRef } from "react";

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  elevation?: 0 | 1 | 2 | 3;
  interactive?: boolean;
  accent?: boolean;
  as?: React.ElementType;
  /** Cible de navigation transmise telle quelle quand `as` est un composant de routing (ex. react-router `Link`). */
  to?: string;
}

/**
 * Surface standardisee (T009) : profondeur via tokens d'elevation,
 * micro-interaction au survol/focus si `interactive`, surface en gradient
 * d'accent si `accent`. Styles via classes/tokens (styles.css).
 */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { elevation = 1, interactive = false, accent = false, as, className, children, ...rest },
  ref
) {
  const Component = (as ?? "div") as React.ElementType;
  const interactiveProps =
    interactive && (as === "div" || as === undefined)
      ? { tabIndex: 0, role: "button" as const }
      : {};
  return (
    <Component
      ref={ref}
      className={["ds-card", className].filter(Boolean).join(" ")}
      data-elevation={elevation}
      data-interactive={interactive ? "true" : undefined}
      data-accent={accent ? "true" : undefined}
      {...interactiveProps}
      {...rest}
    >
      {children}
    </Component>
  );
});
