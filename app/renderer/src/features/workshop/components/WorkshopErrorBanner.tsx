import type { WorkshopError } from "../hooks/useWorkshopFlow";

type WorkshopErrorBannerProps = {
  error: WorkshopError;
  onDismiss: () => void;
};

export function WorkshopErrorBanner({ error, onDismiss }: WorkshopErrorBannerProps) {
  return (
    <article className="error-banner" role="alert">
      <div className="error-banner-body">
        <strong>{error.message}</strong>
        <code className="error-banner-code">{error.code}</code>
      </div>
      <button type="button" className="secondary-button" onClick={onDismiss}>
        Fermer
      </button>
    </article>
  );
}
