import { useEffect, useState } from "react";
import * as m from "../paraglide/messages";
export type ThemeMode = "auto" | "light" | "dark";
export function applyTheme(mode: ThemeMode) {
  const dark =
    mode === "dark" ||
    (mode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode | null>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      setMode(stored === "light" || stored === "dark" ? stored : "auto");
    } catch {
      setMode("auto");
    }
  }, []);
  useEffect(() => {
    if (mode === null) return;
    applyTheme(mode);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme(mode);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [mode]);
  const label =
    mode === null || mode === "auto"
      ? m.theme_auto()
      : mode === "dark"
        ? m.theme_dark()
        : m.theme_light();
  return (
    <button
      className="chip theme-toggle"
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        const next =
          mode === null || mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
        setMode(next);
        try {
          localStorage.setItem("theme", next);
        } catch {}
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {mode === null || mode === "auto" ? (
          <>
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </>
        ) : mode === "light" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
          </>
        ) : (
          <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
        )}
      </svg>
    </button>
  );
}
