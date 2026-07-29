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
  folders: TemplateFolder[];
  pages: TemplatePage[];
}

function paragraph(id: string, text: string) {
  return {
    id,
    type: "paragraph",
    props: {},
    content: [{ type: "text", text, styles: {} }],
    children: [],
  };
}

function heading(id: string, text: string) {
  return {
    id,
    type: "heading",
    props: { level: 1 },
    content: [{ type: "text", text, styles: {} }],
    children: [],
  };
}

const blankTemplate: Template = {
  id: "blank",
  name: "Blank",
  description: "A clean project with one welcome page.",
  folders: [],
  pages: [
    {
      title: "Welcome",
      slug: "welcome",
      path: "/welcome",
      position: 0,
      isPublished: false,
      content: [
        heading("welcome-heading", "Welcome to [Product Name]"),
        paragraph(
          "welcome-body",
          "Start editing this page to create your documentation.",
        ),
      ],
    },
  ],
};

const productDocsTemplate: Template = {
  id: "product-docs",
  name: "Product docs",
  description: "A practical product-documentation starting point.",
  folders: [
    {
      name: "Guides",
      slug: "guides",
      path: "/guides",
      position: 0,
    },
  ],
  pages: [
    {
      title: "Welcome to [Product Name]",
      slug: "welcome",
      path: "/welcome",
      position: 0,
      isPublished: false,
      content: [
        heading("product-heading", "Welcome to [Product Name]"),
        paragraph(
          "product-body",
          "Explain what your product does and help readers find their next step.",
        ),
      ],
    },
    {
      title: "Quickstart",
      slug: "quickstart",
      path: "/guides/quickstart",
      folderPath: "/guides",
      position: 0,
      isPublished: false,
      content: [
        heading("quickstart-heading", "Quickstart"),
        paragraph(
          "quickstart-body",
          "Walk readers through their first successful workflow.",
        ),
      ],
    },
  ],
};

const sdkApiDocsTemplate: Template = {
  id: "sdk-api-docs",
  name: "SDK and API docs",
  description: "A starting point for developer documentation.",
  folders: [
    {
      name: "API reference",
      slug: "api-reference",
      path: "/api-reference",
      position: 0,
    },
  ],
  pages: [
    {
      title: "[Product Name] API",
      slug: "introduction",
      path: "/introduction",
      position: 0,
      isPublished: false,
      content: [
        heading("api-heading", "[Product Name] API"),
        paragraph(
          "api-body",
          "Describe authentication, base URLs, and the first API request.",
        ),
      ],
    },
    {
      title: "Endpoints",
      slug: "endpoints",
      path: "/api-reference/endpoints",
      folderPath: "/api-reference",
      position: 0,
      isPublished: false,
      content: [
        heading("endpoints-heading", "Endpoints"),
        paragraph(
          "endpoints-body",
          "Document your resources, parameters, responses, and errors.",
        ),
      ],
    },
  ],
};

const templates: Template[] = [
  blankTemplate,
  productDocsTemplate,
  sdkApiDocsTemplate,
];

export function getTemplateById(id: TemplateId): Template | undefined {
  return templates.find((template) => template.id === id);
}

export function getDefaultTemplate(): Template {
  return blankTemplate;
}
