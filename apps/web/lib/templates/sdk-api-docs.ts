import type { Template } from "./index";

export const sdkApiDocsTemplate: Template = {
  id: "sdk-api-docs",
  name: "SDK/API Docs",
  description: "SDK reference, API endpoints, and code examples",
  icon: "code",
  folders: [
    {
      name: "Quick Start",
      slug: "quick-start",
      path: "/quick-start",
      position: 0,
    },
    {
      name: "SDK Reference",
      slug: "sdk-reference",
      path: "/sdk-reference",
      position: 1,
    },
    {
      name: "API Reference",
      slug: "api-reference",
      path: "/api-reference",
      position: 2,
    },
    {
      name: "Examples",
      slug: "examples",
      path: "/examples",
      position: 3,
    },
  ],
  pages: [
    {
      title: "Overview",
      subtitle: "Build powerful integrations with the [Product Name] SDK and REST API.",
      icon: "lucide:book-open",
      slug: "index",
      path: "/",
      position: 0,
      isPublished: true,
      content: [
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "SDKs" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "We provide official SDKs for the following languages:",
            },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "JavaScript/TypeScript", styles: { bold: true } },
            { type: "text", text: " - npm install @your-org/sdk" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "Python", styles: { bold: true } },
            { type: "text", text: " - pip install your-org-sdk" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "Go", styles: { bold: true } },
            { type: "text", text: " - go get github.com/your-org/sdk-go" },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "REST API" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "The REST API is available at ",
            },
            { type: "text", text: "https://api.example.com/v1", styles: { code: true } },
            {
              type: "text",
              text: ". All requests must include an API key in the Authorization header.",
            },
          ],
        },
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
              href: "/quick-start/installation",
              content: [{ type: "text", text: "Installation" }],
            },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            {
              type: "link",
              href: "/quick-start/authentication",
              content: [{ type: "text", text: "Authentication" }],
            },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            {
              type: "link",
              href: "/api-reference/endpoints",
              content: [{ type: "text", text: "API Endpoints" }],
            },
          ],
        },
      ],
    },
    {
      title: "Installation",
      subtitle: "Install the [Product Name] SDK for your preferred language.",
      icon: "lucide:play",
      slug: "installation",
      path: "/quick-start/installation",
      folderPath: "/quick-start",
      position: 0,
      isPublished: true,
      content: [
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "JavaScript / TypeScript" }],
        },
        {
          type: "codeBlock",
          props: { language: "bash" },
          content: [{ type: "text", text: "npm install @your-org/sdk\n# or\npnpm add @your-org/sdk\n# or\nyarn add @your-org/sdk" }],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Python" }],
        },
        {
          type: "codeBlock",
          props: { language: "bash" },
          content: [{ type: "text", text: "pip install your-org-sdk\n# or with Poetry\npoetry add your-org-sdk" }],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Go" }],
        },
        {
          type: "codeBlock",
          props: { language: "bash" },
          content: [{ type: "text", text: "go get github.com/your-org/sdk-go" }],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Requirements" }],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "Node.js: ", styles: { bold: true } },
            { type: "text", text: "v18 or later" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "Python: ", styles: { bold: true } },
            { type: "text", text: "3.8 or later" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "Go: ", styles: { bold: true } },
            { type: "text", text: "1.21 or later" },
          ],
        },
      ],
    },
    {
      title: "Authentication",
      subtitle: "All API requests require authentication. You can use API keys or OAuth tokens.",
      icon: "lucide:lock",
      slug: "authentication",
      path: "/quick-start/authentication",
      folderPath: "/quick-start",
      position: 1,
      isPublished: true,
      content: [
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "API Keys" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Create an API key in your dashboard. Include it in the Authorization header:",
            },
          ],
        },
        {
          type: "codeBlock",
          props: { language: "bash" },
          content: [{ type: "text", text: "curl -H \"Authorization: Bearer YOUR_API_KEY\" \\\n  https://api.example.com/v1/resources" }],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Using the SDK" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Pass your API key when initializing the client:",
            },
          ],
        },
        {
          type: "codeBlock",
          props: { language: "typescript" },
          content: [
            {
              type: "text",
              text: "import { Client } from '@your-org/sdk';\n\nconst client = new Client({\n  apiKey: process.env.API_KEY,\n});\n\n// Make authenticated requests\nconst resources = await client.resources.list();",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "OAuth (Coming Soon)" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "OAuth authentication is coming soon. This will allow you to build applications that access [Product Name] on behalf of users.",
            },
          ],
        },
      ],
    },
    {
      title: "Client Reference",
      subtitle: "The SDK client provides methods for interacting with all [Product Name] resources.",
      icon: "lucide:code",
      slug: "client",
      path: "/sdk-reference/client",
      folderPath: "/sdk-reference",
      position: 0,
      isPublished: true,
      content: [
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Constructor" }],
        },
        {
          type: "codeBlock",
          props: { language: "typescript" },
          content: [
            {
              type: "text",
              text: "new Client(options: ClientOptions): Client",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 3 },
          content: [{ type: "text", text: "Options" }],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "apiKey", styles: { code: true } },
            { type: "text", text: " (string, required) - Your API key" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "baseUrl", styles: { code: true } },
            { type: "text", text: " (string, optional) - API base URL" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "timeout", styles: { code: true } },
            { type: "text", text: " (number, optional) - Request timeout in ms (default: 30000)" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "maxRetries", styles: { code: true } },
            { type: "text", text: " (number, optional) - Max retry attempts (default: 3)" },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Properties" }],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "client.resources", styles: { code: true } },
            { type: "text", text: " - Resource management methods" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "client.users", styles: { code: true } },
            { type: "text", text: " - User management methods" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "client.webhooks", styles: { code: true } },
            { type: "text", text: " - Webhook management methods" },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Example" }],
        },
        {
          type: "codeBlock",
          props: { language: "typescript" },
          content: [
            {
              type: "text",
              text: "import { Client } from '@your-org/sdk';\n\nconst client = new Client({\n  apiKey: 'sk_live_xxxxx',\n  timeout: 60000,\n  maxRetries: 5,\n});\n\n// List all resources\nconst resources = await client.resources.list();\n\n// Create a new resource\nconst newResource = await client.resources.create({\n  name: 'My Resource',\n  type: 'example',\n});",
            },
          ],
        },
      ],
    },
    {
      title: "API Endpoints",
      icon: "lucide:zap",
      slug: "endpoints",
      path: "/api-reference/endpoints",
      folderPath: "/api-reference",
      position: 0,
      isPublished: true,
      subtitle: "All endpoints are relative to https://api.example.com/v1.",
      content: [
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Resources" }],
        },
        {
          type: "heading",
          props: { level: 3 },
          content: [{ type: "text", text: "List Resources" }],
        },
        {
          type: "codeBlock",
          props: { language: "http" },
          content: [{ type: "text", text: "GET /resources" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Returns a paginated list of resources.",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Query Parameters:", styles: { bold: true } },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "limit", styles: { code: true } },
            { type: "text", text: " (number) - Max items per page (1-100, default: 20)" },
          ],
        },
        {
          type: "bulletListItem",
          content: [
            { type: "text", text: "cursor", styles: { code: true } },
            { type: "text", text: " (string) - Pagination cursor" },
          ],
        },
        {
          type: "heading",
          props: { level: 3 },
          content: [{ type: "text", text: "Get Resource" }],
        },
        {
          type: "codeBlock",
          props: { language: "http" },
          content: [{ type: "text", text: "GET /resources/:id" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Returns a single resource by ID.",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 3 },
          content: [{ type: "text", text: "Create Resource" }],
        },
        {
          type: "codeBlock",
          props: { language: "http" },
          content: [{ type: "text", text: "POST /resources" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Request Body:", styles: { bold: true } },
          ],
        },
        {
          type: "codeBlock",
          props: { language: "json" },
          content: [
            {
              type: "text",
              text: "{\n  \"name\": \"string\",\n  \"type\": \"string\",\n  \"metadata\": {}\n}",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 3 },
          content: [{ type: "text", text: "Delete Resource" }],
        },
        {
          type: "codeBlock",
          props: { language: "http" },
          content: [{ type: "text", text: "DELETE /resources/:id" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Permanently deletes a resource.",
            },
          ],
        },
      ],
    },
    {
      title: "Code Examples",
      subtitle: "Common patterns and examples using the [Product Name] SDK.",
      icon: "lucide:terminal",
      slug: "code-examples",
      path: "/examples/code-examples",
      folderPath: "/examples",
      position: 0,
      isPublished: true,
      content: [
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Pagination" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "All list endpoints support cursor-based pagination:",
            },
          ],
        },
        {
          type: "codeBlock",
          props: { language: "typescript" },
          content: [
            {
              type: "text",
              text: "async function* getAllResources(client: Client) {\n  let cursor: string | undefined;\n  \n  do {\n    const { data, nextCursor } = await client.resources.list({\n      limit: 100,\n      cursor,\n    });\n    \n    for (const resource of data) {\n      yield resource;\n    }\n    \n    cursor = nextCursor;\n  } while (cursor);\n}\n\n// Usage\nfor await (const resource of getAllResources(client)) {\n  console.log(resource.name);\n}",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Error Handling" }],
        },
        {
          type: "codeBlock",
          props: { language: "typescript" },
          content: [
            {
              type: "text",
              text: "import { Client, APIError, RateLimitError } from '@your-org/sdk';\n\ntry {\n  const resource = await client.resources.get('invalid-id');\n} catch (error) {\n  if (error instanceof RateLimitError) {\n    console.log('Rate limited. Retry after:', error.retryAfter);\n  } else if (error instanceof APIError) {\n    console.log('API error:', error.message, error.code);\n  } else {\n    throw error;\n  }\n}",
            },
          ],
        },
        {
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Webhooks" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Handle webhook events in your application:",
            },
          ],
        },
        {
          type: "codeBlock",
          props: { language: "typescript" },
          content: [
            {
              type: "text",
              text: "import { Webhook } from '@your-org/sdk';\n\nconst webhook = new Webhook(process.env.WEBHOOK_SECRET);\n\n// Express.js example\napp.post('/webhooks', (req, res) => {\n  const signature = req.headers['x-signature'];\n  \n  try {\n    const event = webhook.verify(req.body, signature);\n    \n    switch (event.type) {\n      case 'resource.created':\n        console.log('Resource created:', event.data);\n        break;\n      case 'resource.deleted':\n        console.log('Resource deleted:', event.data.id);\n        break;\n    }\n    \n    res.status(200).send('OK');\n  } catch (error) {\n    res.status(400).send('Invalid signature');\n  }\n});",
            },
          ],
        },
      ],
    },
  ],
};
