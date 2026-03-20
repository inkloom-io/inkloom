"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useBlockNoteEditor } from "@blocknote/react";
import { Tooltip as MantineTooltip } from "@mantine/core";
import { Smile } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@inkloom/ui/popover";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@inkloom/ui/tabs";
import { cn } from "@inkloom/ui/lib/utils";
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
  type LucideIcon,
} from "lucide-react";

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

const COMMON_EMOJIS = [
  "📚", "📖", "📝", "📄", "🚀", "⚡", "✨",
  "💡", "🎯", "🔧", "⚙️", "🔒", "🔑", "🛡️",
  "👤", "👥", "🏠", "📁", "💻", "🔗", "🔍",
  "✅", "❌", "⚠️", "ℹ️", "❓", "💬", "📢",
];

export function IconToolbarButton() {
  const t = useTranslations("editor.blockEditor.inlineToolbar");
  const editor = useBlockNoteEditor();
  const [open, setOpen] = useState(false);

  const handleInsertIcon = (iconName: string) => {
    (editor as any).insertInlineContent([
      {
        type: "icon",
        props: { icon: iconName, size: "16" },
      },
      " ", // Add a space after the icon for continued typing
    ]);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <MantineTooltip label={t("icon")} withinPortal={false} opened={!open ? undefined : false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="mantine-ActionIcon-root"
            style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Smile size={16} />
          </button>
        </PopoverTrigger>
      </MantineTooltip>
      <PopoverContent
        className="w-72 p-2"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Tabs defaultValue="icon" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="icon" className="flex-1">
              {t("iconTabIcons")}
            </TabsTrigger>
            <TabsTrigger value="emoji" className="flex-1">
              {t("iconTabEmoji")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="icon" className="mt-2">
            <div className="grid grid-cols-7 gap-1">
              {LUCIDE_ICONS.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleInsertIcon(`lucide:${name}`)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded hover:bg-accent"
                  )}
                  title={name}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="emoji" className="mt-2">
            <div className="grid grid-cols-7 gap-1">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleInsertIcon(emoji)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-accent"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
