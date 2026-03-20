import { icons } from "lucide-react";

// Convert kebab-case icon names to PascalCase for Lucide icon lookup
// e.g., "book-open" -> "BookOpen", "star" -> "Star"
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function resolveLucideIcon(name: string) {
  const pascalName = toPascalCase(name);
  return icons[pascalName as keyof typeof icons] ?? null;
}

interface InlineIconProps {
  icon: string;
  size?: string | number;
}

export function InlineIcon({ icon, size = 16 }: InlineIconProps) {
  const numericSize = typeof size === "string" ? parseInt(size, 10) : size;

  // Case 1: lucide: prefixed icon names (e.g., "lucide:star", "lucide:book-open")
  if (icon.startsWith("lucide:")) {
    const iconName = icon.slice(7);
    const LucideIcon = resolveLucideIcon(iconName);
    if (LucideIcon) {
      return (
        <span className="inline-icon">
          <LucideIcon size={numericSize} />
        </span>
      );
    }
    // Unknown lucide icon — render fallback
    return <span className="inline-icon-fallback">[{icon}]</span>;
  }

  // Case 2: Bare kebab-case icon names (backward compat, e.g., "star", "book-open")
  if (/^[a-z][a-z0-9-]*$/.test(icon)) {
    const LucideIcon = resolveLucideIcon(icon);
    if (LucideIcon) {
      return (
        <span className="inline-icon">
          <LucideIcon size={numericSize} />
        </span>
      );
    }
    // Looks like an icon name but not found — render fallback
    return <span className="inline-icon-fallback">[{icon}]</span>;
  }

  // Case 3: Emoji or other text (e.g., "🚀", "✨")
  return (
    <span className="inline-icon-emoji" style={{ fontSize: numericSize }}>
      {icon}
    </span>
  );
}
