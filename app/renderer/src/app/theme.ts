import type { ThemePreference } from "../../../shared/types/settings";

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

let mediaQueryList: MediaQueryList | null = null;
let mediaListener: (() => void) | null = null;

function resolveEffectiveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function setDataTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
}

export function applyTheme(preference: ThemePreference): void {
  if (mediaListener && mediaQueryList) {
    mediaQueryList.removeEventListener("change", mediaListener);
    mediaListener = null;
    mediaQueryList = null;
  }

  setDataTheme(resolveEffectiveTheme(preference));

  if (preference === "system") {
    mediaQueryList = window.matchMedia(MEDIA_QUERY);
    mediaListener = () => {
      setDataTheme(resolveEffectiveTheme("system"));
    };
    mediaQueryList.addEventListener("change", mediaListener);
  }
}
