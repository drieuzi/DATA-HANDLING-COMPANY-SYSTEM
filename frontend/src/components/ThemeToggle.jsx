import { useEffect, useState } from "react";

const THEME_KEY = "illuminux-color-theme";

function getSavedTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  } catch {
    // Continue with the device preference when storage is unavailable.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState(getSavedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // The mode still works for the current page when storage is unavailable.
    }
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <button
      className={`theme-toggle ${className}`.trim()}
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "day" : "night"} mode`}
      aria-pressed={isDark}
      title={`Switch to ${isDark ? "day" : "night"} mode`}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isDark ? "☀" : "☾"}
      </span>
      <span>{isDark ? "Day" : "Night"}</span>
    </button>
  );
}
