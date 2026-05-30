import React from "react";

export interface FieldProps {
  label: string;
  hint?: string;
  example?: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}

/**
 * Champ standard (T010) : label + slot d'aide (hint/example) + erreur liee
 * par `aria-describedby`. L'enfant (input/textarea/select) recoit l'id via
 * `htmlFor`. Aide a la saisie de qualite (FR-015).
 */
export function Field({ label, hint, example, error, htmlFor, children }: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const exampleId = example ? `${htmlFor}-example` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, exampleId, errorId].filter(Boolean).join(" ") || undefined;

  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: htmlFor,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined
      })
    : children;

  return (
    <div className="ds-field">
      <label className="ds-field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {hint ? (
        <p className="ds-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {child}
      {example ? (
        <p className="ds-field__example" id={exampleId}>
          {example}
        </p>
      ) : null}
      {error ? (
        <p className="ds-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
