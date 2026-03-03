import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/src/theme-provider";

const cycle = { system: "light", light: "dark", dark: "system" } as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label =
    theme === "light"
      ? "Switch to dark mode"
      : theme === "dark"
        ? "Switch to system mode"
        : "Switch to light mode";

  return (
    <button
      onClick={() => setTheme(cycle[theme])}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] cursor-pointer"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
