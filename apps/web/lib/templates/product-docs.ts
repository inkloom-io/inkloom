import type { Template } from "./index";

export const productDocsTemplate: Template = {
  id: "product-docs",
  name: "Product Docs",
  description: "Guides, tutorials, and reference documentation",
  icon: "book",
  folders: [
    {
      name: "Getting Started",
      slug: "getting-started",
      path: "/getting-started",
      position: 0,
    },
    {
      name: "Guides",
      slug: "guides",
      path: "/guides",
      position: 1,
    },
    {
      name: "Reference",
      slug: "reference",
      path: "/reference",
      position: 2,
    },
  ],
  pages: [
    {
      title: "Introduction",
      subtitle: "[Product Name] helps you build better products faster. This documentation will guide you through everything you need to know.",
      icon: "lucide:book-open",
      slug: "index",
      path: "/",
      position: 0,
      isPublished: true,
      content: [
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Quick Links" }],
        },
        {
          type: "bulletListItem",
          content: [
            {
              type: "link",
              href: "/getting-started/quickstart",
              content: [{ type: "text", text: "Quickstart Guide" }],
            },
            { type: "text", text: " - Get up and running in 5 minutes" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            {
              type: "link",
              href: "/getting-started/core-concepts",
              content: [{ type: "text", text: "Core Concepts" }],
            },
            { type: "text", text: " - Understand the fundamentals" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            {
              type: "link",
              href: "/guides/configuration",
              content: [{ type: "text", text: "Configuration" }],
            },
            { type: "text", text: " - Customize your setup" },
          ],
        },
      ],
    },
    {
      title: "Quickstart",
      subtitle: "Get up and running with [Product Name] in just a few minutes.",
      icon: "lucide:rocket",
      slug: "quickstart",
      path: "/getting-started/quickstart",
      folderPath: "/getting-started",
      position: 0,
      isPublished: true,
      content: [
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Prerequisites" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Before you begin, make sure you have:",
            },
          ],
        },
        {
          type: "bulletListItem",
          content: [{ type: "text", text: "Node.js 18 or later" }],
        },
        {
          type: "bulletListItem",
          content: [{ type: "text", text: "npm or pnpm package manager" }],
        },
        {
          type: "bulletListItem",
          content: [{ type: "text", text: "A [Product Name] account" }],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Installation" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Install the package using your preferred package manager:",
            },
          ],
        },
        {
          type: "codeBlock",
          props: { language: "bash" },
          content: [{ type: "text", text: "npm install @your-org/product-name" }],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Basic Usage" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Here's a simple example to get you started:",
            },
          ],
        },
        {
          type: "codeBlock",
          props: { language: "javascript" },
          content: [
            {
              type: "text",
              text: "import { ProductName } from '@your-org/product-name';\n\nconst client = new ProductName({\n  apiKey: process.env.PRODUCT_API_KEY,\n});\n\nconst result = await client.doSomething();\nconsole.log(result);",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Next Steps" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Now that you're set up, explore the " },
            {
              type: "link",
              href: "/getting-started/core-concepts",
              content: [{ type: "text", text: "Core Concepts" }],
            },
            { type: "text", text: " to learn more." },
          ],
        },
      ],
    },
    {
      title: "Core Concepts",
      subtitle: "Understanding these fundamental concepts will help you get the most out of [Product Name].",
      icon: "lucide:lightbulb",
      slug: "core-concepts",
      path: "/getting-started/core-concepts",
      folderPath: "/getting-started",
      position: 1,
      isPublished: true,
      content: [
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Resources" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Resources are the primary objects in [Product Name]. They represent the data you work with and can be created, read, updated, and deleted.",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Authentication" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "All API requests require authentication. You can authenticate using API keys or OAuth tokens. See the Configuration guide for details.",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Rate Limits" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "[Product Name] enforces rate limits to ensure fair usage. The default limit is 100 requests per minute. Contact us for higher limits.",
            },
          ],
        },
      ],
    },
    {
      title: "Configuration",
      subtitle: "Learn how to configure [Product Name] to match your needs.",
      icon: "lucide:settings",
      slug: "configuration",
      path: "/guides/configuration",
      folderPath: "/guides",
      position: 0,
      isPublished: true,
      content: [
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Environment Variables" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Configure your application using environment variables:",
            },
          ],
        },
        {
          type: "codeBlock",
          props: { language: "bash" },
          content: [
            {
              type: "text",
              text: "# Required\nPRODUCT_API_KEY=your-api-key\n\n# Optional\nPRODUCT_ENVIRONMENT=production\nPRODUCT_TIMEOUT=30000",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Configuration Options" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "The following options can be passed to the client constructor:",
            },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "apiKey", styles: { code: true } },
            { type: "text", text: " - Your API key (required)" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "baseUrl", styles: { code: true } },
            { type: "text", text: " - Custom API endpoint" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "timeout", styles: { code: true } },
            { type: "text", text: " - Request timeout in milliseconds" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "retries", styles: { code: true } },
            { type: "text", text: " - Number of retry attempts" },
          ],
        },
      ],
    },
    {
      title: "FAQ",
      icon: "lucide:message-square",
      slug: "faq",
      path: "/reference/faq",
      folderPath: "/reference",
      position: 0,
      isPublished: true,
      content: [
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "General" }],
        },
        {
          type: "heading",
          props: { level: 3 },
          content: [{ type: "text", text: "What is [Product Name]?" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "[Product Name] is a powerful tool that helps you build better products. It provides a simple API and intuitive interface.",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 3 },
          content: [{ type: "text", text: "How do I get started?" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Check out our " },
            {
              type: "link",
              href: "/getting-started/quickstart",
              content: [{ type: "text", text: "Quickstart guide" }],
            },
            { type: "text", text: " to get up and running in minutes." },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Billing" }],
        },
        {
          type: "heading",
          props: { level: 3 },
          content: [{ type: "text", text: "Is there a free tier?" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Yes! We offer a generous free tier that includes 1,000 API calls per month. Perfect for getting started and small projects.",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 3 },
          content: [{ type: "text", text: "How do I upgrade my plan?" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "You can upgrade your plan at any time from your account settings. Changes take effect immediately.",
            },
          ],
        },
      ],
    },
    {
      title: "Glossary",
      subtitle: "Common terms and definitions used throughout [Product Name].",
      icon: "lucide:list",
      slug: "glossary",
      path: "/reference/glossary",
      folderPath: "/reference",
      position: 1,
      isPublished: true,
      content: [
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "API Key" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "A unique identifier used to authenticate requests to the [Product Name] API. Keep your API key secure and never expose it in client-side code.",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Resource" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "An object in the [Product Name] system that can be created, retrieved, updated, or deleted via the API.",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Webhook" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "An HTTP callback that [Product Name] sends to your server when certain events occur. Used for real-time notifications.",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Workspace" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "An organizational container that groups resources and team members. Each workspace has its own settings and permissions.",
            },
          ],
        },
      ],
    },
  ],
};
