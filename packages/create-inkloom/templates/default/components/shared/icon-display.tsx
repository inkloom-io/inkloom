import { icons, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function IconDisplay({ icon, className }: { icon: string; className?: string }) {
  if (icon.startsWith("lucide:")) {
    const iconName = icon.replace("lucide:", "");
    const LucideIcon = resolveLucideIcon(iconName);
    if (LucideIcon) return <LucideIcon className={cn("h-4 w-4", className)} />;
    return <CircleHelp className={cn("h-4 w-4", className)} />;
  }
  // Check if bare name matches a Lucide icon (backward compat)
  if (/^[a-z][a-z0-9-]*$/.test(icon)) {
    const LucideIcon = resolveLucideIcon(icon);
    if (LucideIcon) return <LucideIcon className={cn("h-4 w-4", className)} />;
    return <CircleHelp className={cn("h-4 w-4", className)} />;
  }
  // Emoji
  return <span className={cn("text-sm", className)}>{icon}</span>;
}
