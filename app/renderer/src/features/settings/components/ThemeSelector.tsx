import { useEffect, useState } from "react";
import type { ThemePreference } from "@shared/types/settings";
import { applyTheme } from "../../../app/theme";
import { Tabs } from "../../../design-system/primitives";

const options: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Système" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" }
];

/**
 * Le controle segmente, sans legende.
 *
 * Une phrase changeait sous les trois onglets pour dire ce que « Clair »,
 * « Sombre » et « Systeme » disent deja. La consequence du reglage tient dans
 * la phrase de section, une fois.
 */
export function ThemeSelector() {
  const [current, setCurrent] = useState<ThemePreference>("system");

  useEffect(() => {
    window.linkedinPoster.settings
      .getPreference("theme")
      .then(({ value }: { value: string | null }) => {
        if (value === "light" || value === "dark" || value === "system") {
          setCurrent(value);
        }
      })
      .catch(() => {});
  }, []);

  async function handleChange(preference: ThemePreference) {
    setCurrent(preference);
    applyTheme(preference);
    try {
      await window.linkedinPoster.settings.setPreference("theme", preference);
    } catch {
      // preference saved locally via applyTheme; IPC failure is non-blocking
    }
  }

  return (
    <div className="settings-theme">
      <Tabs
        aria-label="Apparence de l'application"
        items={options.map((option) => ({
          value: option.value,
          label: option.label
        }))}
        value={current}
        onChange={(value) => handleChange(value as ThemePreference)}
      />
    </div>
  );
}
