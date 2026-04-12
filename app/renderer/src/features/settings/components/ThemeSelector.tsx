import { useEffect, useState } from "react";
import type { ThemePreference } from "@shared/types/settings";
import { applyTheme } from "../../../app/theme";

const options: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Systeme" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" }
];

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
    <div style={{ display: "flex", gap: "8px" }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={current === option.value ? "primary-button" : "secondary-button"}
          style={{ padding: "10px 16px" }}
          onClick={() => handleChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
