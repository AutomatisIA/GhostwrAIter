import type { ThemePreference } from "../../../shared/types/settings";

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

let mediaListener: (() => void) | null = null;

function resolveEffectiveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function setDataTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
}

export function applyTheme(preference: ThemePreference): void {
  if (mediaListener) {
    window.matchMedia(MEDIA_QUERY).removeEventListener("change", mediaListener);
    mediaListener = null;
  }

  setDataTheme(resolveEffectiveTheme(preference));

  if (preference === "system") {
    mediaListener = () => {
      setDataTheme(resolveEffectiveTheme("system"));
    };
    window.matchMedia(MEDIA_QUERY).addEventListener("change", mediaListener);
  }
}
