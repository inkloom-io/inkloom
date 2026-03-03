import { blankTemplate } from "./blank";
import { productDocsTemplate } from "./product-docs";
import { sdkApiDocsTemplate } from "./sdk-api-docs";

export type TemplateId = "blank" | "product-docs" | "sdk-api-docs";

export interface TemplateFolder {
  name: string;
  slug: string;
  path: string;
  position: number;
}

export interface TemplatePage {
  title: string;
  subtitle?: string;
  icon?: string;
  slug: string;
  path: string;
  folderPath?: string;
  position: number;
  isPublished: boolean;
  content: unknown[];
}

export interface Template {
  id: TemplateId;
  name: string;
  description: string;
  icon: "file" | "book" | "code";
  folders: TemplateFolder[];
  pages: TemplatePage[];
}

export const TEMPLATES: Template[] = [
  blankTemplate,
  productDocsTemplate,
  sdkApiDocsTemplate,
];

export function getTemplateById(id: TemplateId): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function getDefaultTemplate(): Template {
  return blankTemplate;
}
