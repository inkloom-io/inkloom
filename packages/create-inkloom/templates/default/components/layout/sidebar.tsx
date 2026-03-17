import { cn } from "@/lib/utils";
import { SidebarContent } from "./sidebar-content";

export function Sidebar() {
  const stickyTop = "top-28";
  const sidebarHeight = "h-[calc(100vh-7rem)]";

  return (
    <aside
      className={cn(
        "site-sidebar sticky hidden w-64 shrink-0 overflow-y-auto lg:block",
        stickyTop,
        sidebarHeight
      )}
    >
      <SidebarContent />
    </aside>
  );
}
