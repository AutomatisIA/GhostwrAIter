import React, { useId, useState } from "react";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Info-bulle accessible (T014). Declenchee au survol ET au focus clavier ;
 * contenu lie a l'element declencheur via `aria-describedby` ; echappable
 * (Escape). Surface flottante en glassmorphism (tokens glass).
 */
export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  function show() {
    setOpen(true);
  }
  function hide() {
    setOpen(false);
  }
  function handleKeyDown(event: React.KeyboardEvent<HTMLSpanElement>) {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
    }
  }

  const trigger = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        "aria-describedby": open ? tooltipId : undefined
      })
    : children;

  return (
    <span
      className="ds-tooltip"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={handleKeyDown}
    >
      {trigger}
      {open ? (
        <span className="ds-tooltip__bubble" role="tooltip" id={tooltipId}>
          {content}
        </span>
      ) : null}
    </span>
  );
}
