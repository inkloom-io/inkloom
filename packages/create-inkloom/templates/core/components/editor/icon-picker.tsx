"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/components/ui/lib/utils";
import {
  Book,
  BookOpen,
  Code,
  Cog,
  FileText,
  Folder,
  Home,
  Lightbulb,
  Link,
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
  X,
  CircleHelp,
  icons,
  type LucideIcon,
} from "lucide-react";

// Common document-related emojis
const COMMON_EMOJIS = [
  "📚", "📖", "📝", "📄", "📃", "📑", "🔖",
  "🚀", "⚡", "✨", "💡", "🎯", "🔧", "⚙️",
  "🔒", "🔑", "🛡️", "👤", "👥", "🏠", "📁",
  "💻", "🖥️", "📱", "🔗", "🌐", "🔍", "📊",
  "✅", "❌", "⚠️", "ℹ️", "❓", "💬", "📢",
  "🎨", "🎮", "🎵", "📷", "🎬", "📦", "🧩",
];

// Lucide icons with their names
const LUCIDE_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: "book", icon: Book },
  { name: "book-open", icon: BookOpen },
  { name: "code", icon: Code },
  { name: "cog", icon: Cog },
  { name: "file-text", icon: FileText },
  { name: "folder", icon: Folder },
  { name: "home", icon: Home },
  { name: "lightbulb", icon: Lightbulb },
  { name: "link", icon: Link },
  { name: "list", icon: List },
  { name: "lock", icon: Lock },
  { name: "message-square", icon: MessageSquare },
  { name: "pencil", icon: Pencil },
  { name: "play", icon: Play },
  { name: "plus", icon: Plus },
  { name: "rocket", icon: Rocket },
  { name: "search", icon: Search },
  { name: "settings", icon: Settings },
  { name: "shield", icon: Shield },
  { name: "sparkles", icon: Sparkles },
  { name: "star", icon: Star },
  { name: "target", icon: Target },
  { name: "terminal", icon: Terminal },
  { name: "users", icon: Users },
  { name: "wrench", icon: Wrench },
  { name: "zap", icon: Zap },
];

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

interface IconPickerProps {
  value?: string;
  onChange: (icon: string | null) => void;
  trigger?: React.ReactNode;
}

export function IconPicker({ value, onChange, trigger }: IconPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (icon: string) => {
    onChange(icon);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            {value ? (
              <IconDisplay icon={value} className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Tabs defaultValue="emoji" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="emoji" className="flex-1">
              Emoji
            </TabsTrigger>
            <TabsTrigger value="icon" className="flex-1">
              Icon
            </TabsTrigger>
          </TabsList>
          <TabsContent value="emoji" className="mt-2">
            <div className="grid grid-cols-7 gap-1">
              {COMMON_EMOJIS.map((emoji: string) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSelect(emoji)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-accent",
                    value === emoji && "bg-accent"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="icon" className="mt-2">
            <div className="grid grid-cols-7 gap-1">
              {LUCIDE_ICONS.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelect(`lucide:${name}`)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded hover:bg-accent",
                    value === `lucide:${name}` && "bg-accent"
                  )}
                  title={name}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={handleClear}
          >
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface IconDisplayProps {
  icon: string;
  className?: string;
}

export function IconDisplay({ icon, className }: IconDisplayProps) {
  if (icon.startsWith("lucide:")) {
    const iconName = icon.replace("lucide:", "");
    const LucideIcon = resolveLucideIcon(iconName);
    if (LucideIcon) return <LucideIcon className={className} />;
    return <CircleHelp className={className} />;
  }
  // Check if bare name matches a Lucide icon (backward compat)
  if (/^[a-z][a-z0-9-]*$/.test(icon)) {
    const LucideIcon = resolveLucideIcon(icon);
    if (LucideIcon) return <LucideIcon className={className} />;
    return <CircleHelp className={className} />;
  }
  // Emoji
  return <span className={className}>{icon}</span>;
}
