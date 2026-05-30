import React, { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  iconLeading?: React.ReactNode;
  iconTrailing?: React.ReactNode;
}

/**
 * Bouton du design system (T008).
 * Hierarchie d'action coherente : `primary` = action dominante (gradient
 * d'accent + elevation). `loading` expose `aria-busy` et desactive l'action.
 * Styles via classes/tokens (styles.css), aucune valeur en dur.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    disabled = false,
    iconLeading,
    iconTrailing,
    className,
    children,
    type,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={["ds-button", className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "true" : undefined}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? <span className="ds-button__spinner" aria-hidden="true" /> : null}
      {!loading && iconLeading ? (
        <span className="ds-button__icon" aria-hidden="true">
          {iconLeading}
        </span>
      ) : null}
      {children}
      {!loading && iconTrailing ? (
        <span className="ds-button__icon" aria-hidden="true">
          {iconTrailing}
        </span>
      ) : null}
    </button>
  );
});
