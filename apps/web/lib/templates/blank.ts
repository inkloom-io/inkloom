import type { Template } from "./index";

export const blankTemplate: Template = {
  id: "blank",
  name: "Blank",
  description: "Start fresh with a single welcome page",
  icon: "file",
  folders: [],
  pages: [
    {
      title: "Welcome",
      subtitle: "Start editing your documentation here.",
      icon: "lucide:home",
      slug: "index",
      path: "/",
      position: 0,
      isPublished: true,
      content: [{ type: "paragraph", content: [] }],
    },
  ],
};
