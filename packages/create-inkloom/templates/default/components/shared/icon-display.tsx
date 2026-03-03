import {
  Book,
  BookOpen,
  Code,
  Cog,
  FileText,
  Folder,
  Home,
  Lightbulb,
  Link as LinkIcon,
  List,
  Lock,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  Rocket,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Target,
  Terminal,
  Users,
  Wrench,
  Zap,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Map Lucide icon names to components
export const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  book: Book,
  "book-open": BookOpen,
  code: Code,
  cog: Cog,
  "file-text": FileText,
  folder: Folder,
  home: Home,
  lightbulb: Lightbulb,
  link: LinkIcon,
  list: List,
  lock: Lock,
  "message-square": MessageSquare,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  rocket: Rocket,
  search: Search,
  settings: Settings,
  shield: Shield,
  sparkles: Sparkles,
  star: Star,
  target: Target,
  terminal: Terminal,
  users: Users,
  wrench: Wrench,
  zap: Zap,
};

export function IconDisplay({ icon, className }: { icon: string; className?: string }) {
  if (icon.startsWith("lucide:")) {
    const iconName = icon.replace("lucide:", "");
    const LucideIcon = LUCIDE_ICON_MAP[iconName];
    if (LucideIcon) return <LucideIcon className={cn("h-4 w-4", className)} />;
    return <CircleHelp className={cn("h-4 w-4", className)} />;
  }
  // Check if bare name matches a Lucide icon (backward compat)
  if (LUCIDE_ICON_MAP[icon]) {
    const LucideIcon = LUCIDE_ICON_MAP[icon];
    return <LucideIcon className={cn("h-4 w-4", className)} />;
  }
  // If it looks like an icon name (ASCII only) but wasn't found, show fallback
  if (/^[a-z][a-z0-9-]*$/.test(icon)) {
    return <CircleHelp className={cn("h-4 w-4", className)} />;
  }
  // Emoji
  return <span className={cn("text-sm", className)}>{icon}</span>;
}
