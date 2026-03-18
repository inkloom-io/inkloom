import { icons } from "lucide-react";

// Convert kebab-case icon names to PascalCase for Lucide icon lookup
// e.g., "book-open" -> "BookOpen", "star" -> "Star"
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

interface InlineIconProps {
  icon: string;
  size?: string | number;
}

export function InlineIcon({ icon, size = 16 }: InlineIconProps) {
  const pascalName = toPascalCase(icon);
  const LucideIcon = icons[pascalName as keyof typeof icons];
  if (!LucideIcon) {
    // Fallback for unknown icon names
    return <span className="inline-icon-fallback">[{icon}]</span>;
  }
  return (
    <span className="inline-icon">
      <LucideIcon size={typeof size === "string" ? parseInt(size, 10) : size} />
    </span>
  );
}
