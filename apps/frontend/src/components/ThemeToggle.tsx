import { Moon, Sun } from "lucide-react";
import { toggleTheme, useTheme } from "../lib/theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useTheme() === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground ${className}`}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
