import { ENGINE_LABELS, formatChrono, formatSinceSeconds } from "./generation-phases";
import type { EngineSignal } from "../../create/useGenerationTelemetry";

type GenerationPulseProps = {
  /** Nom de la phase en cours, tel qu il est reellement connu. */
  phaseLabel: string;
  elapsedMs: number;
  signal: EngineSignal;
};

/**
 * Bloc d attente : la phase, le temps ecoule, le signe de vie du moteur.
 *
 * Aucun pourcentage. La duree d une generation va de vingt a cent secondes
 * selon le moteur, la longueur du texte et la charge de la machine : une barre
 * a valeur annoncerait une progression qu aucune mesure ne soutient. Le temps
 * ecoule, lui, est vrai a la seconde pres.
 *
 * Le chronometre n est pas dans une region annoncee : un compteur qui change
 * toutes les demi-secondes dans une region « polie » monopolise le lecteur
 * d ecran. Seul le nom de la phase l est, et il ne change que quatre fois.
 */
export function GenerationPulse({ phaseLabel, elapsedMs, signal }: GenerationPulseProps) {
  const engineLabel = signal.engine ? ENGINE_LABELS[signal.engine] : null;
  const signalText =
    engineLabel && signal.sinceMs !== null
      ? `${engineLabel}, dernier signal il y a ${formatSinceSeconds(signal.sinceMs)}`
      : "Aucun signal du moteur depuis le lancement";

  return (
    <section className="gen-pulse" aria-label="Génération en cours">
      <div className="gen-pulse__head">
        <div className="gen-pulse__phase">
          <span className="eyebrow gen-pulse__eyebrow" role="status">
            {phaseLabel}
          </span>
          <span className="gen-pulse__chrono">{formatChrono(elapsedMs)}</span>
        </div>
        <div className="gen-pulse__aside">
          <span className="gen-pulse__signal">{signalText}</span>
          <span className="gen-pulse__average">Durée observée en moyenne : 20 à 100 s</span>
        </div>
      </div>

      <div className="gen-pulse__track" aria-hidden="true">
        <span className="gen-pulse__bar" />
      </div>
    </section>
  );
}
